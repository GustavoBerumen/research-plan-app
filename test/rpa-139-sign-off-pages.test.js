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
// The three things asked before a plan is sent, in order: which of the two
// you are, your own declaration and name, and then where it goes. The last
// press creates the record and signs it in one act.
function startAndSign(app, options = {}) {
  const { document: d, window } = app;
  const role = options.role || 'leadResearcher';
  d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
  press(d, 'Continue');
  const box = d.querySelector('[data-field="' + KEYS[role].declaration + '"]');
  if (!box.checked) { box.checked = true; box.dispatchEvent(new window.Event('change', { bubbles: true })); }
  setValue(window, d.querySelector('[data-field="' + KEYS[role].name + '"]'), options.initials || 'PN');
  press(d, 'Continue');
  setValue(window, d.getElementById('sign-off-other-email'), options.other || 'tom@example.com');
  press(d, 'Sign and send');
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
  // One question at a time, and the first of the three is who you are.
  assert.deepEqual(Array.from(d.querySelectorAll('.sign-off-setup .field')).filter((x) => !x.hidden).map((x) => text(x.querySelector('.flabel'))),
    ['Which of these are you?']);
  assert.match(CSS, /\.sign-off-setup \.field\[hidden\],\.sign-off \.field\[hidden\]\{display:none\}/,
    'and a hidden question is hidden on screen: .field sets its own display, which beats the plain attribute');
  assert.equal(d.getElementById('sign-off-other-email').closest('.field').hidden, true,
    'where it goes is asked after the person has signed, not before (Gus, 15 September 2026)');
  assert.equal(d.querySelector('.sign-off-note').hidden, true, 'no note about two people until there is a plan to sign');
  assert.deepEqual(buttons(d), ['Continue']);
  for (const role of Object.keys(KEYS)) assert.equal(pairFor(d, role).hidden, true, role + ': no declaration until it is their turn');
  assert.deepEqual(printedLines(d), ['This plan is unsigned.'], 'and that is what the paper says');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the three steps come in the order a person does them: who you are, your sign-off, then where it goes', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  // Asked by what is actually on screen, not by the hidden property alone:
  // a class that sets display beats the plain attribute, which is how both
  // questions once showed at the same time (found in the browser).
  const onScreen = (x) => !x.hidden && window.getComputedStyle(x).display !== 'none';
  const shownLabels = () => Array.from(d.querySelectorAll('.sign-off-setup .field, .sign-off-pair')).filter(onScreen)
    .map((x) => text(x.querySelector('.flabel')));

  press(d, 'Continue');
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text), ['Select which of these you are.']);
  d.querySelector('.sign-off-setup input[value="leadResearcher"]').click();
  press(d, 'Continue');
  assert.deepEqual(shownLabels(), ['Declaration: Lead researcher'], 'their own declaration, and the name below it');
  assert.equal(pairFor(d, 'projectRequester').hidden, true, 'never the other person’s');
  assert.equal(tagOf(d), 'Not started', 'nothing is committed yet');

  press(d, 'Continue');
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text),
    ['Confirm the declaration: lead researcher', 'Enter the sign off: lead researcher'], 'the sign-off is asked for before the address');

  const box = d.querySelector('[data-field="declarationResearcher"]');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));
  setValue(window, d.querySelector('[data-field="signOffResearcher"]'), 'PN');
  press(d, 'Continue');
  // The question names the other person, because the first question already
  // said which of the two you are: Plan details names them Tom Okafor.
  assert.deepEqual(shownLabels(), ['What is Tom Okafor’s email address?'], 'and only now, where it goes');
  assert.equal(stateOf(d), 'You have signed. Send the plan to Tom Okafor to approve.');
  assert.deepEqual(buttons(d), ['Sign and send', 'Back']);

  press(d, 'Back');
  assert.deepEqual(shownLabels(), ['Declaration: Lead researcher'], 'Back returns to the sign-off');
  // Say you are the other one instead, and the question turns round.
  press(d, 'Back');
  d.querySelector('.sign-off-setup input[value="projectRequester"]').click();
  press(d, 'Continue');
  assert.deepEqual(shownLabels(), ['Declaration: Project requester'], 'the declaration follows the role');
  const theirBox = d.querySelector('[data-field="declarationRequester"]');
  theirBox.checked = true;
  theirBox.dispatchEvent(new window.Event('change', { bubbles: true }));
  setValue(window, d.querySelector('[data-field="signOffProjectOwner"]'), 'TO');
  press(d, 'Continue');
  assert.deepEqual(shownLabels(), ['What is Priya Nair’s email address?'], 'and so does the address it asks for');
  assert.equal(stateOf(d), 'You have signed. Send the plan to Priya Nair to approve.');

  press(d, 'Back');
  press(d, 'Back');
  d.querySelector('.sign-off-setup input[value="leadResearcher"]').click();
  press(d, 'Continue');
  press(d, 'Continue');
  press(d, 'Sign and send');
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text), ['Enter the other person’s email address.']);
  assert.equal(tagOf(d), 'Not started', 'and still nothing is committed');

  // One person cannot sign for both, and the refusal is the module's own.
  setValue(window, d.getElementById('sign-off-other-email'), 'name@example.com');
  press(d, 'Sign and send');
  assert.deepEqual(Array.from(summaryOf(d).querySelectorAll('li')).map(text),
    ['Enter a different email address for the other person. One person cannot sign for both.']);

  setValue(window, d.getElementById('sign-off-other-email'), 'tom@example.com');
  press(d, 'Sign and send');
  await settle();
  // Signing and sending were the one act, so the plan arrives signed and sent.
  assert.equal(summaryOf(d).hidden, true);
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester');
  assert.equal(reviewRow(d), 'Awaiting sign-off from the project requester');
  assert.equal(d.querySelector('.sign-off-setup').hidden, true, 'asked once');
  const saved = await waitFor(() => { const dr = draftOf(app.window); return dr && dr.signOff && dr.signOff; });
  assert.equal(saved.status, 'awaitingCounterparty');
  assert.equal(saved.authorRole, 'leadResearcher');
  assert.equal(saved.signatures.leadResearcher.revision, 1);
  assert.equal(saved.parties.projectRequester.email, 'tom@example.com');
  assert.equal(saved.parties.leadResearcher.email, 'name@example.com', 'the author is whoever gave their address at the start (RPA-99)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('with nobody named, the question asks by role instead, and it is asked afresh each time', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  d.querySelector('.sign-off-setup input[value="leadResearcher"]').click();
  press(d, 'Continue');
  const box = d.querySelector('[data-field="declarationResearcher"]');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));
  setValue(window, d.querySelector('[data-field="signOffResearcher"]'), 'PN');
  press(d, 'Continue');
  const label = () => text(d.getElementById('sign-off-other-email').closest('.field').querySelector('.flabel'));
  assert.equal(label(), 'What is Tom Okafor’s email address?');

  // Plan details requires both names, so this is the state a restored plan
  // can be in rather than one a person types their way into. The question
  // still has to say who it means.
  setValue(window, d.querySelector('[data-field="projectRequester"]'), '');
  press(d, 'Back');
  press(d, 'Continue');
  assert.equal(label(), 'What is the project requester’s email address?', 'the role, when there is no name to use');
  assert.equal(stateOf(d), 'You have signed. Send the plan to the project requester to approve.');

  setValue(window, d.querySelector('[data-field="projectRequester"]'), 'Max Spiegel');
  press(d, 'Back');
  press(d, 'Continue');
  assert.equal(label(), 'What is Max Spiegel’s email address?', 'and the name again as soon as there is one');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the author signs and sends, and the panel turns to the other person: their declaration, and only theirs', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  startAndSign(app);
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
  startAndSign(app);
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
  startAndSign(app);
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
  // And what was agreed to, not only who agreed: the declarations only show
  // on screen for whoever's turn it is, so the record's copy prints.
  assert.deepEqual(Array.from(d.querySelectorAll('.sign-off-printed-declaration')).map(text), [
    'I confirm this plan is complete and current, and I will conduct the research as it describes.',
    'I confirm this plan meets the needs of the project I am responsible for, and I approve it.',
  ]);
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
  startAndSign(app);
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
  startAndSign(app);
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
  startAndSign(first);
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
  // One question at a time means one column: the two roles no longer sit
  // side by side, and the words should not wrap at half the width they have.
  assert.match(CSS, /\.sign-off-fields\{display:block/);
  for (const cls of ['tag-blue', 'tag-orange', 'tag-green']) assert.match(CSS, new RegExp('\\.' + cls + '\\{background:'), cls);
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  const all = CSS.slice(CSS.indexOf('@media print{.sign-off-printed'));
  assert.match(all, /\.sign-off-printed\{display:block!important\}/, 'what was signed prints');
  assert.match(all, /\.sign-off-note,\.sign-off-actions,\.sign-off-setup,\.sign-off-state\{display:none!important\}/, 'the buttons and the working notes do not');
  assert.doesNotMatch(print, /\.review-signoffs/, 'the declarations and names still print with the plan');
});
