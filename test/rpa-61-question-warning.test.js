'use strict';

// RPA-61. The three-question recommendation used to sit permanently beside the
// Add button in a "?" bubble you had to hover to read — invisible on touch, in
// print, and to anyone who never thought to hover. The tip went in PR #38 and
// its advice moved into the field hint; this moves the recommendation into the
// warning that already fires on the fourth question, so it reaches people at
// the moment it applies.
//
// The part that needed care is the announcement. The tip was reachable: a span
// with role="note", an aria-label carrying the text, and tabindex="0". The
// warning was a bare div appearing in response to a click — visible only.
// Removing one and relying on the other would have been an accessibility
// regression, so the warning is a live region now.
//
// Two consequences of that, both load-bearing:
//   * it is built once and left in the document, because a region inserted and
//     filled in the same breath is announced unreliably;
//   * it is emptied rather than hidden, because assistive technology ignores a
//     hidden region — hiding it would silence the next warning too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, listInputs } = require('./app-harness');

function questions(document) {
  return document.querySelector('.list-rows[data-list-key="researchQuestions"]');
}

function field(document) {
  return questions(document).closest('.field');
}

function addBtn(document) {
  return field(document).querySelector('.add-btn');
}

function warning(document) {
  // Not '[role="status"]': an eval field already holds three of those from
  // its evaluation controls, so that selector identifies nothing.
  return field(document).querySelector('.rq-warning');
}

function addQuestions(document, n) {
  for (let i = 0; i < n; i += 1) addBtn(document).click();
}

test('no tip sits beside the Add button', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  assert.equal(field(app.document).querySelectorAll('.info-tip').length, 0);
  // The whole mechanism went with it rather than being left unreachable.
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(source, /renderInfoTip/);
});

test('nothing is said until there is something to say', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  assert.equal(listInputs(document, 'researchQuestions').length, 1);
  const region = warning(document);
  assert.ok(region, 'the live region exists from the start, ready to be filled');
  assert.equal(region.textContent, '');

  addQuestions(document, 2);
  assert.equal(listInputs(document, 'researchQuestions').length, 3);
  assert.equal(warning(document).textContent, '', 'three questions is the recommendation, not a problem');
});

test('the fourth question carries the recommendation and the reason', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  addQuestions(document, 3);
  assert.equal(listInputs(document, 'researchQuestions').length, 4);

  const region = warning(document);
  assert.match(region.textContent, /three questions/i, 'states the recommendation');
  assert.match(region.textContent, /too long/, 'and why it matters');
  assert.ok(region.classList.contains('field-warning'), 'and looks like a warning');

  // Beside the question it is about, not at the foot of the list.
  const rows = questions(document).querySelectorAll('.list-row');
  assert.equal(rows[3].nextElementSibling, region);
});

test('it is announced, not merely displayed', async (t) => {
  // The regression this ticket exists to avoid. The tip was reachable by
  // keyboard and carried its text in an aria-label; a bare div replacing it
  // would have been visible-only.
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  addQuestions(document, 3);
  const region = warning(document);
  assert.equal(region.getAttribute('role'), 'status');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.getAttribute('aria-atomic'), 'true');
  assert.equal(region.hidden, false, 'a hidden live region announces nothing');
});

test('the region is the same element throughout, and never hidden', async (t) => {
  // Both properties are what make the *second* warning work. A region that is
  // replaced, or hidden between uses, announces the first time and then goes
  // quiet.
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const atStart = warning(document);
  addQuestions(document, 3);
  assert.equal(warning(document), atStart, 'same node once shown');

  field(document).querySelectorAll('.list-remove')[3].click();
  assert.equal(warning(document), atStart, 'same node once emptied');
  assert.equal(atStart.hidden, false, 'emptied, not hidden');
  assert.equal(atStart.textContent, '');
  assert.equal(atStart.classList.contains('field-warning'), false,
    'and unstyled while empty, or the stylesheet would draw a stray warning mark');

  addQuestions(document, 1);
  assert.equal(warning(document), atStart, 'still the same node the second time');
  assert.match(atStart.textContent, /three questions/i);
});

test('a fifth question does not stack a second warning', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  addQuestions(document, 5);
  assert.equal(listInputs(document, 'researchQuestions').length, 6);
  assert.equal(field(document).querySelectorAll('.rq-warning').length, 1);
  assert.equal(field(document).querySelectorAll('.field-warning').length, 1);
});

test('nothing is blocked — the fourth question is still added', async (t) => {
  // This app does not gate progress on quality anywhere, and does not start
  // here. The warning is guidance.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  addQuestions(document, 3);
  const inputs = listInputs(document, 'researchQuestions');
  assert.equal(inputs.length, 4);

  inputs[3].value = 'How do returning customers describe the checkout?';
  inputs[3].dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(inputs[3].disabled, false);
  assert.equal(listInputs(document, 'researchQuestions')[3].value,
    'How do returning customers describe the checkout?');
});
