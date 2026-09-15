'use strict';

// RPA-139. The state machine of RPA-135 on the page people finish on.
// Whoever wrote the plan says who they are and who else must approve it,
// signs, and sends it; the other signs or asks for changes; the plan is
// approved when both signatures name the revision that stands. The status
// is the design system's tag, here and in the task list, and the plan
// prints what was signed and when.
//
// Both parties are faked on one device: the links that would bring the
// second person are RPA-137 and the server that would hold the plan is
// RPA-136. "Acting as" switches sides; everything else is the real module.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const panel = (d) => d.querySelector('.sign-off');
const tagOf = (d) => text(panel(d).querySelector('.sign-off-head .tag'));
const stateOf = (d) => text(d.querySelector('.sign-off-state'));
const noticeLines = (d) => Array.from(d.querySelectorAll('.sign-off-notice p')).map(text);
const printedLines = (d) => Array.from(d.querySelectorAll('.sign-off-printed-line')).map(text);
const buttons = (d) => Array.from(d.querySelectorAll('.sign-off-actions button')).map(text);
const summaryOf = (d) => d.querySelector('.sign-off .error-summary');
const reviewRow = (d) => text(d.getElementById('task-status-review'));
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const pairFor = (d, role) => d.querySelector('[data-field="' + KEYS[role].name + '"]').closest('.sign-off-pair');
const settle = () => new Promise((r) => setTimeout(r, 220));
const KEYS = {
  leadResearcher: { declaration: 'declarationResearcher', name: 'signOffResearcher' },
  projectRequester: { declaration: 'declarationRequester', name: 'signOffProjectOwner' },
};

function press(d, label) {
  const button = Array.from(d.querySelectorAll('.sign-off-actions button')).find((b) => text(b) === label);
  assert.ok(button, 'no "' + label + '" button; there is ' + JSON.stringify(buttons(d)));
  button.click();
}
// Ticks the declaration and gives the name, the way the person would, then signs.
function sign(app, role, initials) {
  const { document: d, window } = app;
  const box = d.querySelector('[data-field="' + KEYS[role].declaration + '"]');
  if (!box.checked) { box.checked = true; box.dispatchEvent(new window.Event('change', { bubbles: true })); }
  setValue(window, d.querySelector('[data-field="' + KEYS[role].name + '"]'), initials);
  press(d, role === 'leadResearcher' ? 'Sign and send' : 'Sign');
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
  return steps(d)[6];
}
// Says who is signing and who else must approve, then hands back the panel.
function start(app, role = 'leadResearcher', other = 'tom@example.com') {
  const { document: d, window } = app;
  d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
  setValue(window, d.getElementById('sign-off-other-email'), other);
  press(d, 'Continue');
}

test('before anything is sent, the panel asks who you are and who else must approve, and nothing else', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  assert.ok(panel(d), 'the review step ends with the sign-off');
  assert.equal(text(panel(d).querySelector('.sign-off-h')), 'Sign-off');
  assert.equal(tagOf(d), 'Not started');
  assert.equal(reviewRow(d), 'Not started', 'and the task list says the same');
  assert.equal(d.querySelector('.sign-off-setup').hidden, false);
  assert.deepEqual(Array.from(d.querySelectorAll('.sign-off-setup .flabel')).map(text),
    ['Which of these are you?', 'What is the other person’s email address?']);
  assert.equal(d.querySelector('.sign-off-note').hidden, true, 'no note about two people until there is a plan to sign');
  assert.deepEqual(buttons(d), ['Continue']);
  for (const role of Object.keys(KEYS)) assert.equal(pairFor(d, role).hidden, true, role + ': no declaration until it is their turn');
  assert.deepEqual(printedLines(d), ['This plan is unsigned.'], 'and that is what the paper says');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the setup asks for both answers, then the plan is the author’s to sign', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  press(d, 'Continue');
  assert.equal(summaryOf(d).hidden, false);
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text),
    ['Select which of these you are.', 'Enter the other person’s email address.']);
  assert.equal(tagOf(d), 'Not started', 'nothing was started');

  // One person cannot sign for both, and the refusal is the module's own.
  start(app, 'leadResearcher', 'name@example.com');
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text),
    ['Enter a different email address for the other person. One person cannot sign for both.']);
  assert.equal(tagOf(d), 'Not started');

  start(app);
  await settle();
  assert.equal(summaryOf(d).hidden, true);
  assert.equal(tagOf(d), 'Not signed');
  assert.equal(reviewRow(d), 'Not signed');
  assert.equal(stateOf(d), 'Not yet sent. Priya Nair signs first.');
  assert.equal(d.querySelector('.sign-off-setup').hidden, true, 'asked once');
  assert.equal(text(d.querySelector('.sign-off-note')), 'Both people sign on this one device for now. A plan sent for real reaches the other person through a link of their own.');
  assert.equal(pairFor(d, 'leadResearcher').hidden, false, 'the author signs');
  assert.equal(pairFor(d, 'projectRequester').hidden, true, 'the other person does not, yet');
  assert.deepEqual(buttons(d), ['Sign and send']);
  const saved = await waitFor(() => { const dr = draftOf(app.window); return dr && dr.signOff && dr.signOff; });
  assert.equal(saved.status, 'draft');
  assert.equal(saved.authorRole, 'leadResearcher');
  assert.equal(saved.parties.projectRequester.email, 'tom@example.com');
  assert.equal(saved.parties.leadResearcher.email, 'name@example.com', 'the author is whoever gave their address at the start (RPA-99)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the author signs and sends, and the panel turns to the other person: their declaration, and only theirs', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  start(app);
  sign(app, 'leadResearcher', 'PN');
  await settle();
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester');
  assert.equal(reviewRow(d), 'Awaiting sign-off from the project requester');
  assert.match(stateOf(d), /^Sent to Tom Okafor on \d+ \w+ \d{4}\. Revision 1\.$/);
  assert.deepEqual(noticeLines(d).filter((l) => /^Signed by/.test(l)).length ? [true] : [false], [true], 'the signature is on the record');
  assert.match(noticeLines(d)[0], /^Signed by Priya Nair on .+, revision 1\.$/);
  // The plan is with the other person now, so that is whose side shows:
  // there is nothing to choose, and nothing asks.
  assert.equal(pairFor(d, 'projectRequester').hidden, false);
  assert.equal(pairFor(d, 'leadResearcher').hidden, true, 'one declaration at a time, the one whose turn it is');
  assert.deepEqual(buttons(d), ['Sign', 'Request changes']);
  assert.deepEqual(printedLines(d), ['Not yet approved. Revision 1.', 'Signed by Priya Nair on ' + printedLines(d)[1].split(' on ')[1]]);

  // Ticking their own declaration is not an edit to the plan: the
  // apparatus of signing is not what the two of them are agreeing about.
  const box = d.querySelector('[data-field="declarationRequester"]');
  box.checked = true;
  box.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  setValue(app.window, d.querySelector('[data-field="signOffProjectOwner"]'), 'TO');
  await settle();
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester', 'the plan has not moved under them');
  assert.deepEqual(buttons(d), ['Sign', 'Request changes'], 'so they can still sign it');
  assert.deepEqual(app.jsdomErrors, []);
});

test('asking for changes sends it back with the reason, and the author signs a new revision once the plan has moved', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  start(app);
  sign(app, 'leadResearcher', 'PN');
  await settle();
  press(d, 'Request changes');
  press(d, 'Send request');
  assert.equal(summaryOf(d).hidden, false);
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text), ['Enter what needs to change.']);
  setValue(window, d.getElementById('sign-off-change-note'), 'The sample size does not match the questions.');
  press(d, 'Send request');
  await settle();
  assert.equal(tagOf(d), 'Changes requested');
  assert.equal(reviewRow(d), 'Changes requested');
  assert.equal(stateOf(d), 'Back with Priya Nair to change.');
  assert.match(noticeLines(d)[0], /^Tom Okafor asked for changes on .+, revision 1\.$/);
  assert.equal(noticeLines(d)[1], 'The sample size does not match the questions.');
  // And the plan turns back to its author, who is the one who must act.
  assert.equal(pairFor(d, 'projectRequester').hidden, true);
  assert.deepEqual(buttons(d), ['Sign and send']);
  assert.equal(pairFor(d, 'leadResearcher').hidden, false, 'the author answers the request');
  setValue(window, d.querySelector('[data-field="goal"]'), 'A goal that answers the request.');
  await settle();
  sign(app, 'leadResearcher', 'PN');
  await settle();
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester');
  assert.match(stateOf(d), /Revision 2\.$/, 'the plan moved, so the revision did');
  assert.equal(noticeLines(d).filter((l) => /asked for changes/.test(l)).length, 0, 'the request is answered');
  assert.deepEqual(app.jsdomErrors, []);
});

test('both signatures approve the plan, it prints what was signed, and reopening takes the approval back', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  start(app);
  sign(app, 'leadResearcher', 'PN');
  await settle();
  sign(app, 'projectRequester', 'TO');
  await settle();
  assert.equal(tagOf(d), 'Approved');
  assert.equal(reviewRow(d), 'Approved');
  assert.equal(stateOf(d), 'Both people have signed revision 1.');
  const signatures = noticeLines(d).filter((l) => /^Signed by/.test(l));
  assert.equal(signatures.length, 2);
  assert.match(signatures[0], /^Signed by Priya Nair on .+, revision 1\.$/);
  assert.match(signatures[1], /^Signed by Tom Okafor on .+, revision 1\.$/);
  assert.equal(printedLines(d)[0], 'Approved. Revision 1.', 'the paper says so too');
  assert.equal(printedLines(d).length, 3);
  assert.match(text(d.querySelector('.task-list-progress')), /completed 6 of 6 sections/, 'and the plan is done');

  assert.deepEqual(buttons(d), ['Reopen']);
  assert.equal(pairFor(d, 'projectRequester').hidden, true, 'nothing left to sign');
  press(d, 'Reopen');
  await settle();
  assert.equal(tagOf(d), 'Not signed');
  assert.equal(noticeLines(d).filter((l) => /^Signed by/.test(l)).length, 0, 'approval does not survive being reopened');
  assert.equal(d.querySelector('[data-field="declarationRequester"]').checked, true, 'the boxes are still ticked');
  assert.match(text(d.querySelector('.task-list-progress')), /completed 5 of 6 sections/,
    'and the plan is unfinished again: the review step is done when the plan is approved, not when four boxes are filled');
  assert.deepEqual(printedLines(d), ['This plan is unsigned.']);
  const saved = draftOf(window);
  assert.equal(saved.signOff.history.filter((h) => h.transition === 'sign').length, 2, 'but the ledger keeps both signatures');
  assert.deepEqual(app.jsdomErrors, []);
});

test('changing the plan after it is sent says so, and the module’s own words come back when it refuses', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  start(app);
  sign(app, 'leadResearcher', 'PN');
  await settle();
  const written = d.querySelector('[data-field="background"]').value;

  setValue(window, d.querySelector('[data-field="background"]'), 'Something the other person has not read.');
  await settle();
  assert.equal(tagOf(d), 'Not signed');
  assert.equal(stateOf(d), 'The plan has changed since it was last signed. Priya Nair signs it again to send it.');
  assert.equal(reviewRow(d), 'Not signed');
  assert.equal(pairFor(d, 'projectRequester').hidden, true, 'the other person cannot sign what they have not been sent');
  assert.deepEqual(buttons(d), ['Sign and send'], 'it is the author\'s move again');

  setValue(window, d.querySelector('[data-field="background"]'), written);
  await settle();
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester', 'undoing the change puts it back, signature intact');
  assert.equal(draftOf(window).signOff.revisions.length, 1, 'and no new revision was ever minted');

  assert.deepEqual(buttons(d), ['Sign', 'Request changes'], 'and it is the other person\'s move again, on the signature that never moved');
  assert.equal(pairFor(d, 'projectRequester').hidden, false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the sign-off travels in the draft and comes back with it; Clear Form clears it', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  start(app);
  sign(app, 'leadResearcher', 'PN');
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.signOff && dr.signOff.status === 'awaitingCounterparty' && dr; });
  assert.equal(saved.version, 9, 'the draft format carries it from version 9');

  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  again.window.location.hash = '#review';
  await waitFor(() => steps(again.document)[6].hidden === false);
  await settle();
  assert.equal(tagOf(again.document), 'Awaiting sign-off from the project requester', 'a reload knows where the plan had got to');
  assert.equal(again.document.querySelector('.sign-off-setup').hidden, true, 'and does not ask again');
  assert.match(stateOf(again.document), /Revision 1\.$/);

  d.getElementById('clear-btn').click();
  await settle();
  assert.equal(tagOf(d), 'Not started', 'clearing the plan clears the sign-off: a signature is about a plan');
  assert.equal(d.querySelector('.sign-off-setup').hidden, false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('signing does not re-date the plan: Last updated is for edits', async (t) => {
  const first = await bootApp({});
  t.after(() => first.close());
  await onReview(first);
  start(first);
  sign(first, 'leadResearcher', 'PN');
  const sent = await waitFor(() => { const dr = draftOf(first.window); return dr && dr.signOff && dr.signOff.status === 'awaitingCounterparty' && dr; });
  const older = JSON.parse(JSON.stringify(sent));
  older.fields.lastUpdated = '2020-01-01';
  older.lastUpdatedManual = false;

  const app = await bootApp({ draft: older });
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#review';
  await waitFor(() => steps(d)[6].hidden === false);
  await settle();
  sign(app, 'projectRequester', 'TO');
  await settle();
  assert.equal(tagOf(d), 'Approved');
  assert.equal(d.querySelector('[data-field="lastUpdated"]').value, '2020-01-01', 'a signature is not an edit');
  assert.equal(draftOf(window).fields.lastUpdated, '2020-01-01', 'and the draft is not re-stamped either');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the status is the design system’s tag, and print shows the signatures without the machinery', () => {
  assert.match(CSS, /\.tag\{[^}]*text-transform:uppercase/);
  for (const cls of ['tag-blue', 'tag-orange', 'tag-green']) assert.match(CSS, new RegExp('\\.' + cls + '\\{background:'), cls);
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  const all = CSS.slice(CSS.indexOf('@media print{.sign-off-printed'));
  assert.match(all, /\.sign-off-printed\{display:block!important\}/, 'what was signed prints');
  assert.match(all, /\.sign-off-note,\.sign-off-actions,\.sign-off-setup,\.sign-off-state\{display:none!important\}/, 'the buttons and the working notes do not');
  assert.doesNotMatch(print, /\.review-signoffs/, 'the declarations and names still print with the plan');
});
