'use strict';

// RPA-137. A link per party. It identifies a role on one plan and nothing
// else: it does not authenticate, which is the choice already made in
// RPA-99, and the page it opens says whose it is. The author can withdraw a
// link and issue a new one, and every issue and withdrawal is on the
// record, so who could open the plan and when is part of the audit.
//
// Two things the copy must not promise, because they are not true yet: that
// a link reaches the other person (sending is RPA-84) and that it opens
// anywhere but the browser that wrote the plan (the plan is not on a server
// until RPA-136). A link nobody recognises opens nothing of the plan.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../plan-workflow');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const linkBlock = (d) => d.querySelector('.sign-off-link');
const linkUrl = (d) => text(d.querySelector('.sign-off-link-url'));
const linkButtons = (d) => Array.from(d.querySelectorAll('.sign-off-link-actions button')).map(text);
const noteOf = (d) => text(d.querySelector('.sign-off-note'));
const buttons = (d) => Array.from(d.querySelectorAll('.sign-off-actions button')).map(text);
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 220));
const KEYS = {
  leadResearcher: { declaration: 'declarationResearcher', name: 'signOffResearcher' },
  projectRequester: { declaration: 'declarationRequester', name: 'signOffProjectOwner' },
};
function press(d, label) {
  const button = Array.from(d.querySelectorAll('.sign-off-actions button, .sign-off-link-actions button')).find((b) => text(b) === label);
  assert.ok(button, 'no "' + label + '" button');
  button.click();
}
async function onReview(app) {
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Priya Nair');
  setValue(window, d.querySelector('[data-field="projectRequester"]'), 'Tom Okafor');
  window.location.hash = '#review';
  await waitFor(() => steps(d)[6].hidden === false);
  await settle();
}
function startAndSign(app, role = 'leadResearcher') {
  const { document: d, window } = app;
  d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
  press(d, 'Continue');
  const box = d.querySelector('[data-field="' + KEYS[role].declaration + '"]');
  if (!box.checked) { box.checked = true; box.dispatchEvent(new window.Event('change', { bubbles: true })); }
  setValue(window, d.querySelector('[data-field="' + KEYS[role].name + '"]'), 'PN');
  press(d, 'Continue');
  setValue(window, d.getElementById('sign-off-other-email'), 'tom@example.com');
  press(d, 'Sign and send');
}
// A plan sent to Tom, and the draft it was saved in.
async function sent(t) {
  const app = await bootApp({});
  t.after(() => app.close());
  await onReview(app);
  startAndSign(app);
  const draft = await waitFor(() => { const dr = draftOf(app.window); return dr && dr.signOff && dr.signOff.status === 'awaitingCounterparty' && dr; });
  return { app, draft };
}

// ---------- the record ----------
const parties = { leadResearcher: { email: 'priya@example.com' }, projectRequester: { email: 'tom@example.com' } };
const plan = () => W.createPlan({ id: 'p', at: 'day-1', authorRole: 'leadResearcher', parties, tokens: { leadResearcher: 'token-priya', projectRequester: 'token-tom' } }).plan;

test('a plan is created with a link for each party, and a link says which role it belongs to', () => {
  const p = plan();
  assert.deepEqual(p.parties.projectRequester, { email: 'tom@example.com', displayName: '', token: 'token-tom', issuedAt: 'day-1', revokedAt: null });
  assert.deepEqual(W.roleForToken(p, 'token-tom'), { role: 'projectRequester', revoked: false });
  assert.deepEqual(W.roleForToken(p, 'token-priya'), { role: 'leadResearcher', revoked: false });
  assert.equal(W.roleForToken(p, 'token-nobody'), null, 'a link nobody issued belongs to nobody');
  assert.equal(W.roleForToken(p, ''), null);
  assert.equal(W.roleForToken(p, '   '), null, 'and nor does an empty one');

  const none = W.createPlan({ id: 'p', at: 'day-1', authorRole: 'leadResearcher', parties }).plan;
  assert.equal(none.parties.projectRequester.token, null, 'a plan can exist before its links do');
  assert.equal(W.roleForToken(none, ''), null);
});

test('the author withdraws a link and issues another; the one before it stops working, and both acts are on the record', () => {
  const p = plan();
  const gone = W.apply(p, { transition: 'revokeLink', role: 'leadResearcher', forRole: 'projectRequester', at: 'day-2', version: p.version });
  assert.equal(gone.ok, true);
  assert.deepEqual(W.roleForToken(gone.plan, 'token-tom'), { role: 'projectRequester', revoked: true },
    'a withdrawn link is recognisably withdrawn, not merely unknown');
  assert.equal(gone.plan.parties.projectRequester.revokedAt, 'day-2');
  assert.equal(gone.plan.status, 'draft', 'withdrawing a link does not move the plan');
  assert.deepEqual(gone.plan.history[1], { at: 'day-2', transition: 'revokeLink', role: 'leadResearcher', email: 'priya@example.com', from: 'draft', to: 'draft', forRole: 'projectRequester' });

  const again = W.apply(gone.plan, { transition: 'issueLink', role: 'leadResearcher', forRole: 'projectRequester', token: 'token-tom-2', at: 'day-3', version: gone.plan.version });
  assert.equal(again.ok, true);
  assert.deepEqual(W.roleForToken(again.plan, 'token-tom-2'), { role: 'projectRequester', revoked: false });
  assert.equal(W.roleForToken(again.plan, 'token-tom'), null, 'the one before it belongs to nobody now');
  assert.equal(again.plan.parties.projectRequester.issuedAt, 'day-3');
  assert.equal(again.plan.parties.projectRequester.revokedAt, null);
  assert.deepEqual(again.plan.history.map((h) => h.transition), ['create', 'revokeLink', 'issueLink'], 'who could open the plan, and when');
});

test('only the author manages links, and there must be a link to withdraw', () => {
  const p = plan();
  const at = 'day-2';
  const version = p.version;
  assert.equal(W.apply(p, { transition: 'revokeLink', role: 'projectRequester', forRole: 'leadResearcher', at, version }).code, 'not-author');
  assert.equal(W.apply(p, { transition: 'issueLink', role: 'projectRequester', forRole: 'leadResearcher', token: 'x', at, version }).code, 'not-author');
  assert.equal(W.apply(p, { transition: 'issueLink', role: 'leadResearcher', forRole: 'somebody', token: 'x', at, version }).code, 'unknown-role');
  assert.equal(W.apply(p, { transition: 'issueLink', role: 'leadResearcher', forRole: 'projectRequester', token: '  ', at, version }).code, 'missing-token');

  const gone = W.apply(p, { transition: 'revokeLink', role: 'leadResearcher', forRole: 'projectRequester', at, version }).plan;
  const twice = W.apply(gone, { transition: 'revokeLink', role: 'leadResearcher', forRole: 'projectRequester', at: 'day-3', version: gone.version });
  assert.equal(twice.code, 'no-link');
  assert.equal(twice.message, 'There is no link to that person to withdraw.');
  assert.equal(gone.history.length, 2, 'and a refusal writes nothing');
});

test('withdrawing the plan withdraws both links: a withdrawn plan is nobody’s to open', () => {
  const p = plan();
  const gone = W.apply(p, { transition: 'withdraw', role: 'leadResearcher', at: 'day-9', version: p.version }).plan;
  assert.equal(gone.status, 'withdrawn');
  assert.equal(gone.parties.leadResearcher.revokedAt, 'day-9');
  assert.equal(gone.parties.projectRequester.revokedAt, 'day-9');
  assert.deepEqual(W.roleForToken(gone, 'token-tom'), { role: 'projectRequester', revoked: true });
});

// ---------- the page ----------
test('sending a plan gives the author a link to pass on, saying plainly what it cannot do yet', async (t) => {
  const { app, draft } = await sent(t);
  const d = app.document;
  const token = draft.signOff.parties.projectRequester.token;
  assert.ok(token && token.length >= 16, 'long and random: ' + token);
  assert.notEqual(token, draft.signOff.parties.leadResearcher.token, 'one each, not one between them');

  assert.equal(linkBlock(d).hidden, false);
  assert.equal(text(d.querySelector('.sign-off-link-head')), 'Send this link to Tom Okafor');
  assert.equal(linkUrl(d), 'https://research-plan.test/?as=' + token + '#review');
  const hint = text(d.querySelector('.sign-off-link-hint'));
  assert.match(hint, /read and sign, as themselves/);
  assert.match(hint, /cannot be emailed yet/, 'sending is RPA-84, and the page says so');
  assert.match(hint, /only opens in this browser until the plan is kept on a server/, 'and the plan is not on a server until RPA-136');
  assert.deepEqual(linkButtons(d), ['Copy link', 'Withdraw link']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the other person’s link opens the plan as them, and says whose link it was', async (t) => {
  const { draft } = await sent(t);
  const token = draft.signOff.parties.projectRequester.token;
  const theirs = await bootApp({ draft, url: 'https://research-plan.test/?as=' + token + '#review' });
  t.after(() => theirs.close());
  const d = theirs.document;
  await waitFor(() => steps(d)[6].hidden === false);
  await settle();
  assert.deepEqual(visible(d), ['review']);
  assert.equal(noteOf(d),
    'You are signing as Tom Okafor, the project requester, because that is whose link opened this plan. Not you? Tell the person who sent it.');
  assert.deepEqual(buttons(d), ['Sign', 'Request changes'], 'and it is their turn');
  assert.equal(d.querySelector('[data-field="signOffProjectOwner"]').closest('.sign-off-pair').hidden, false);
  assert.equal(linkBlock(d).hidden, true, 'the link to pass on is the author’s business, not theirs');
  assert.deepEqual(theirs.jsdomErrors, []);
});

test('a link names you even when the plan is waiting on the other person', async (t) => {
  const { draft } = await sent(t);
  const token = draft.signOff.parties.leadResearcher.token;
  const mine = await bootApp({ draft, url: 'https://research-plan.test/?as=' + token + '#review' });
  t.after(() => mine.close());
  const d = mine.document;
  await waitFor(() => steps(d)[6].hidden === false);
  await settle();
  assert.match(noteOf(d), /^You are signing as Priya Nair, the lead researcher/);
  assert.equal(text(d.querySelector('.sign-off-waiting')), 'Nothing for you to do. This plan is with Tom Okafor.');
  assert.deepEqual(buttons(d), [], 'their own link does not let them sign for the other person');
  assert.equal(linkBlock(d).hidden, false, 'but it is still their plan to send');
});

test('a withdrawn link opens nothing of the plan, and a new one can be issued in its place', async (t) => {
  const { app, draft } = await sent(t);
  const d = app.document;
  const first = draft.signOff.parties.projectRequester.token;
  press(d, 'Withdraw link');
  await settle();
  assert.equal(text(d.querySelector('.sign-off-link-head')), 'The link to Tom Okafor has been withdrawn');
  assert.equal(d.querySelector('.sign-off-link-url').hidden, true, 'and there is nothing left to send');
  assert.deepEqual(linkButtons(d), ['Issue a new link']);
  assert.equal(text(d.querySelector('.sign-off-link-status')), 'The link has been withdrawn. Nobody can open the plan with it.');
  const withdrawn = await waitFor(() => { const dr = draftOf(app.window); return dr.signOff.parties.projectRequester.revokedAt ? dr : null; });

  const dead = await bootApp({ draft: withdrawn, url: 'https://research-plan.test/?as=' + first + '#review' });
  t.after(() => dead.close());
  const dd = dead.document;
  await waitFor(() => dd.querySelector('.dead-link').hidden === false);
  assert.deepEqual(visible(dd), [], 'nothing of the plan');
  assert.equal(dd.querySelector('.sign-off'), null, 'not hidden: gone');
  assert.equal(dd.querySelector('[data-field="researchTitle"]'), null);
  assert.equal(text(dd.querySelector('.dead-link .step-heading')), 'This link no longer works');
  assert.equal(text(dd.querySelector('.dead-link-body')), 'The person who sent it has withdrawn it. Ask them for a new one: name@example.com.');
  assert.equal(dd.querySelector('.dead-link-back').getAttribute('href'), '/', 'and a way back to your own plan');
  assert.equal(dd.body.textContent.includes('Usability'), false, 'not even the name of the study');

  press(d, 'Issue a new link');
  await settle();
  const second = draftOf(app.window).signOff.parties.projectRequester.token;
  assert.notEqual(second, first);
  assert.equal(linkUrl(d), 'https://research-plan.test/?as=' + second + '#review');
  assert.equal(text(d.querySelector('.sign-off-link-status')), 'A new link. The one before it no longer works.');
  const reissued = await waitFor(() => { const dr = draftOf(app.window); return dr.signOff.parties.projectRequester.token === second ? dr : null; });
  const stale = await bootApp({ draft: reissued, url: 'https://research-plan.test/?as=' + first + '#review' });
  t.after(() => stale.close());
  await waitFor(() => stale.document.querySelector('.dead-link').hidden === false);
  assert.equal(text(stale.document.querySelector('.dead-link-body')),
    'It may have been withdrawn, or it may be for a plan this browser does not hold. Ask the person who sent it.',
    'a link this browser cannot place is not told it was withdrawn');
});

test('Copy link copies it, and says so; without a clipboard it says to copy it by hand', async (t) => {
  const { app, draft } = await sent(t);
  const d = app.document;
  const token = draft.signOff.parties.projectRequester.token;
  const copied = [];
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: { writeText: (v) => { copied.push(v); return Promise.resolve(); } } });
  press(d, 'Copy link');
  await waitFor(() => copied.length === 1);
  assert.equal(copied[0], 'https://research-plan.test/?as=' + token + '#review');
  await waitFor(() => text(d.querySelector('.sign-off-link-status')) === 'Link copied. Send it to Tom Okafor.');

  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: undefined });
  press(d, 'Copy link');
  assert.equal(text(d.querySelector('.sign-off-link-status')), 'Select the link above and copy it.');
  assert.equal(d.querySelector('.sign-off-link-url').getAttribute('tabindex'), '0', 'and it can be reached by keyboard to select');
});

test('none of the link machinery prints', () => {
  const print = CSS.slice(CSS.indexOf('@media print{.sign-off-printed'));
  assert.match(print, /\.sign-off-link[,{]/, 'the link block is for the screen');
  const all = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(all, /\.dead-link/, 'and a dead link has nothing to print');
});
