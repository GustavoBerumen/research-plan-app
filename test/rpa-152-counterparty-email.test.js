'use strict';

// RPA-152. The address the author gives for the other person is what
// identifies them, so it has to be one. Before this, "asdf" created and
// signed the plan and was written into its record and ledger, from where
// the draft, a backup and whatever delivers the link would carry it. Now
// the same shape check the author's own address passed at the start
// (RPA-99) stands in front of the record: nothing is created until the
// address is an address, the refusal is said in the summary and at the
// field, and the summary's line takes the person to the box.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const panel = (d) => d.querySelector('.sign-off');
const tagOf = (d) => text(panel(d).querySelector('.sign-off-head .tag'));
const summaryOf = (d) => d.querySelector('.sign-off .error-summary');
const summaryLines = (d) => Array.from(summaryOf(d).querySelectorAll('li')).map(text);
const otherBox = (d) => d.getElementById('sign-off-other-email');
const otherField = (d) => otherBox(d).closest('.field');
const fieldError = (d) => otherField(d).querySelector(':scope > .field-error');
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 220));
const KEYS = {
  leadResearcher: { declaration: 'declarationResearcher', name: 'signOffResearcher' },
  projectRequester: { declaration: 'declarationRequester', name: 'signOffProjectOwner' },
};
const FORMAT = 'Enter an email address in the correct format, like name@example.com';
const EMPTY = 'Enter the other person’s email address.';

function press(d, label) {
  const button = Array.from(d.querySelectorAll('.sign-off-actions button')).find((b) => text(b) === label);
  assert.ok(button, 'no "' + label + '" button');
  button.click();
}
async function onReview(app) {
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5, 6]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Priya Nair');
  setValue(window, d.querySelector('[data-field="projectRequester"]'), 'Tom Okafor');
  window.location.hash = '#review';
  await waitFor(() => steps(d)[7].hidden === false);
  await settle();
}
// Which of the two you are, your declaration and initials, and then the
// page that asks for the other person's address, without answering it.
function toTheAddress(app, role) {
  const { document: d, window } = app;
  d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
  press(d, 'Continue');
  const box = d.querySelector('[data-field="' + KEYS[role].declaration + '"]');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));
  setValue(window, d.querySelector('[data-field="' + KEYS[role].name + '"]'), role === 'leadResearcher' ? 'PN' : 'TO');
  press(d, 'Continue');
}
function offer(app, value) {
  setValue(app.window, otherBox(app.document), value);
  press(app.document, 'Sign for local review');
}
// Nothing was made: no tag, no record in the draft, the address page still open.
function nothingCreated(app, value) {
  const { document: d, window } = app;
  assert.equal(tagOf(d), 'Not started', value + ': no record');
  assert.equal(d.querySelector('.sign-off-setup').hidden, false, value + ': the step stays open');
  assert.equal(otherField(d).hidden, false, value + ': on the address');
  assert.equal((draftOf(window) || {}).signOff || null, null, value + ': nothing in the draft');
}
function interceptDownload(app) {
  let download;
  app.window.URL.createObjectURL = (blob) => { download = { blob }; return 'blob:local-backup'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () { download.name = this.download; };
  return async () => {
    app.document.getElementById('download-backup-btn').click();
    assert.ok(download, text(app.document.getElementById('backup-status')));
    const body = await new Promise((resolve, reject) => {
      const reader = new app.window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(download.blob);
    });
    return { text: body, data: JSON.parse(body) };
  };
}

test('an address that is not one does not create or sign the plan, and is refused in the summary and at the field', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  toTheAddress(app, 'leadResearcher');

  for (const value of ['asdf', 'name@', '@example.com', 'name@example', 'na me@example.com', 'name@exam ple.com']) {
    offer(app, value);
    assert.deepEqual(summaryLines(d), [FORMAT], value);
    assert.equal(d.activeElement, summaryOf(d), value + ': the summary takes focus');
    assert.equal(text(fieldError(d)), 'Error: ' + FORMAT, value + ': said at the field too');
    assert.ok(otherField(d).classList.contains('field-invalid'), value + ': the field is marked');
    assert.ok((otherBox(d).getAttribute('aria-describedby') || '').split(/\s+/).includes(fieldError(d).id), value + ': the box is described by it');
    nothingCreated(app, value);
  }
  // Said once, however many times it is refused.
  assert.equal(otherField(d).querySelectorAll('.field-error').length, 1);

  // The summary's line is a link to the box.
  const link = summaryOf(d).querySelector('li a.error-summary-link');
  assert.ok(link, 'the message is a link');
  link.click();
  assert.equal(d.activeElement, otherBox(d), 'and it puts focus in the box');

  // Empty is still asked for in its own words, at the field as well.
  offer(app, '');
  assert.deepEqual(summaryLines(d), [EMPTY]);
  assert.equal(text(fieldError(d)), 'Error: ' + EMPTY);
  nothingCreated(app, 'empty');

  // A real address clears the refusal and makes the record.
  offer(app, 'tom@example.com');
  await settle();
  assert.equal(summaryOf(d).hidden, true);
  assert.equal(fieldError(d), null, 'the field is clear');
  assert.ok(!otherField(d).classList.contains('field-invalid'));
  assert.equal(tagOf(d), 'Awaiting sign-off from the project requester');
  const saved = await waitFor(() => (draftOf(window) || {}).signOff);
  assert.equal(saved.parties.projectRequester.email, 'tom@example.com');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a well-formed address with spaces around it is trimmed and accepted', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onReview(app);
  toTheAddress(app, 'leadResearcher');
  offer(app, '   tom@example.com  ');
  await settle();
  assert.equal(summaryOf(d).hidden, true);
  const saved = await waitFor(() => (draftOf(window) || {}).signOff);
  assert.equal(saved.parties.projectRequester.email, 'tom@example.com');
  assert.equal(saved.history[0].email, 'name@example.com', 'the ledger names the author by the address given at the start');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the shape is checked first, and the rule that the two must differ still runs after it', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  toTheAddress(app, 'leadResearcher');
  // The author's own address, differently cased, is a well-formed address
  // that names the same person: the module's refusal, in its own words.
  offer(app, 'NAME@example.com');
  assert.deepEqual(summaryLines(d), ['Enter a different email address for the other person. One person cannot sign for both.']);
  nothingCreated(app, 'the same person');
  // A malformed one never reaches the module.
  offer(app, 'name@');
  assert.deepEqual(summaryLines(d), [FORMAT]);
  nothingCreated(app, 'name@');
  assert.deepEqual(app.jsdomErrors, []);
});

test('as the project requester too, and a refused address is nowhere: not in the draft, its ledger or a backup', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const backup = interceptDownload(app);
  await onReview(app);
  toTheAddress(app, 'projectRequester');
  assert.equal(text(otherField(d).querySelector('.flabel')), 'What is Priya Nair’s email address?');

  offer(app, 'priya@example');
  assert.deepEqual(summaryLines(d), [FORMAT]);
  assert.equal(text(fieldError(d)), 'Error: ' + FORMAT);
  nothingCreated(app, 'priya@example');
  await settle();
  const draft = draftOf(window);
  assert.equal(draft.signOff, null, 'no record, so no parties and no history');
  assert.ok(!JSON.stringify(draft).includes('priya@example'), 'the draft holds nothing of it');
  const file = await backup();
  assert.equal(file.data.signOff, null, 'a backup taken now carries no record');
  assert.ok(!file.text.includes('priya@example'), 'and nothing of the address');

  // A real address, and the plan is created and signed by the requester.
  offer(app, 'priya@example.com');
  await settle();
  assert.equal(summaryOf(d).hidden, true);
  assert.equal(tagOf(d), 'Awaiting sign-off from the lead researcher');
  const saved = await waitFor(() => (draftOf(window) || {}).signOff);
  assert.equal(saved.authorRole, 'projectRequester');
  assert.equal(saved.parties.leadResearcher.email, 'priya@example.com');
  assert.equal(saved.parties.projectRequester.email, 'name@example.com');
  assert.equal(saved.history.length, 2, 'created and signed, nothing before');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the declaration page says its messages the same way: at the field, with a link to it', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  await onReview(app);
  d.querySelector('.sign-off-setup input[value="leadResearcher"]').click();
  press(d, 'Continue');
  press(d, 'Continue');
  const lines = summaryOf(d).querySelectorAll('li a.error-summary-link');
  assert.equal(lines.length, 2, 'the declaration and the initials, each a link');
  const name = d.querySelector('[data-field="signOffResearcher"]');
  assert.ok(name.closest('.field').querySelector(':scope > .field-error'), 'said at the field');
  lines[1].click();
  assert.equal(d.activeElement, name, 'the second line puts focus in the initials box');
  assert.deepEqual(app.jsdomErrors, []);
});
