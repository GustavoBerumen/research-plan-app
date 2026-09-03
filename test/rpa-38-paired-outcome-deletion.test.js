'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DRAFT_KEY,
  bootApp,
  listInputs,
  setValue,
  waitFor,
} = require('./app-harness');

function listNumbers(document, key) {
  return Array.from(document.querySelectorAll(
    '.list-rows[data-list-key="' + key + '"] > .list-row > .list-num'
  )).map((number) => number.textContent);
}

function methodsGroups(document) {
  return Array.from(document.querySelectorAll('.methods-group'));
}

function methodValues(group) {
  return Array.from(group.querySelectorAll('.list-input'))
    .map((input) => input.value)
    .filter(Boolean);
}

function addListRow(document, key) {
  const list = document.querySelector('.list-rows[data-list-key="' + key + '"]');
  list.closest('.field').querySelector('.add-btn').click();
}

function removeQuestion(document, index) {
  const row = listInputs(document, 'researchQuestions')[index].closest('.list-row');
  const button = row.querySelector('.list-remove');
  button.focus();
  button.click();
  return button;
}

function populateThreePairs(app, options = {}) {
  const { document, window } = app;
  addListRow(document, 'researchQuestions');
  addListRow(document, 'researchQuestions');

  ['Question one', 'Question two', 'Question three'].forEach((value, index) => {
    setValue(window, listInputs(document, 'researchQuestions')[index], value);
  });
  (options.outcomes || ['Outcome one', 'Outcome two', 'Outcome three'])
    .forEach((value, index) => setValue(window, listInputs(document, 'outcomes')[index], value));

  const values = options.methods || ['Method one', 'Method two', 'Method three'];
  methodsGroups(document).forEach((group, index) => {
    if (values[index]) setValue(window, group.querySelector('.list-input'), values[index]);
  });
}

function evaluationResult() {
  return {
    metrics: [{ name: 'Alignment', score: 2, desc: 'Deterministic result' }],
    recommendations: ['Keep the positional pairs explicit.'],
  };
}

async function evaluateOutcomes(app) {
  const field = app.document
    .querySelector('.list-rows[data-list-key="outcomes"]')
    .closest('.field');
  const button = field.querySelector('.eval-btn');
  button.click();
  await waitFor(() => app.evaluationRequests.length === 1);
  await waitFor(() => !button.disabled);
}

test('deleting a Question with an empty paired Outcome immediately removes the exact pair', async (t) => {
  const app = await bootApp({
    confirm: () => { throw new Error('An empty linked pair should not require confirmation'); },
  });
  t.after(() => app.close());
  populateThreePairs(app, {
    outcomes: ['Outcome one', '', 'Outcome three'],
    methods: ['Method one', '', 'Method three'],
  });

  removeQuestion(app.document, 1);

  assert.deepEqual(listInputs(app.document, 'researchQuestions').map((input) => input.value), [
    'Question one',
    'Question three',
  ]);
  assert.deepEqual(listInputs(app.document, 'outcomes').map((input) => input.value), [
    'Outcome one',
    'Outcome three',
  ]);
  assert.deepEqual(listNumbers(app.document, 'researchQuestions'), ['1.', '2.']);
  assert.deepEqual(listNumbers(app.document, 'outcomes'), ['1.', '2.']);
  assert.deepEqual(methodsGroups(app.document).map(methodValues), [['Method one'], ['Method three']]);
  assert.deepEqual(
    methodsGroups(app.document).map((group) => group.querySelector('.methods-group-q').title),
    ['Question one', 'Question three']
  );
});

test('confirming deletion removes a populated Outcome and its exact Methods group', async (t) => {
  const confirmations = [];
  const app = await bootApp({
    confirm: (message) => {
      confirmations.push(message);
      return true;
    },
  });
  t.after(() => app.close());
  populateThreePairs(app);
  addListRow(app.document, 'outcomes');
  setValue(app.window, listInputs(app.document, 'outcomes')[3], 'Legitimate extra Outcome');

  removeQuestion(app.document, 1);

  assert.equal(confirmations.length, 1);
  assert.equal(
    confirmations[0],
    'Deleting Research Question 2 will also delete:\n\n- Outcome 2\n- Methods RQ2'
  );
  assert.deepEqual(listInputs(app.document, 'researchQuestions').map((input) => input.value), [
    'Question one',
    'Question three',
  ]);
  assert.deepEqual(listInputs(app.document, 'outcomes').map((input) => input.value), [
    'Outcome one',
    'Outcome three',
    'Legitimate extra Outcome',
  ]);
  assert.deepEqual(methodsGroups(app.document).map(methodValues), [['Method one'], ['Method three']]);

  const extraRemove = listInputs(app.document, 'outcomes')[2]
    .closest('.list-row').querySelector('.list-remove');
  assert.equal(extraRemove.disabled, false);
  extraRemove.click();
  assert.deepEqual(listInputs(app.document, 'outcomes').map((input) => input.value), [
    'Outcome one',
    'Outcome three',
  ]);
});

test('cancelling populated deletion leaves values, numbering, controls, and focus unchanged', async (t) => {
  const confirmations = [];
  const app = await bootApp({
    confirm: (message) => {
      confirmations.push(message);
      return false;
    },
  });
  t.after(() => app.close());
  populateThreePairs(app);

  const questionRows = Array.from(app.document.querySelectorAll(
    '.list-rows[data-list-key="researchQuestions"] > .list-row'
  ));
  const outcomeRows = Array.from(app.document.querySelectorAll(
    '.list-rows[data-list-key="outcomes"] > .list-row'
  ));
  const groups = methodsGroups(app.document);
  const removeButton = removeQuestion(app.document, 1);

  assert.equal(confirmations.length, 1);
  assert.equal(app.document.activeElement, removeButton);
  assert.deepEqual(
    Array.from(app.document.querySelectorAll('.list-rows[data-list-key="researchQuestions"] > .list-row')),
    questionRows
  );
  assert.deepEqual(
    Array.from(app.document.querySelectorAll('.list-rows[data-list-key="outcomes"] > .list-row')),
    outcomeRows
  );
  assert.deepEqual(methodsGroups(app.document), groups);
  assert.deepEqual(listInputs(app.document, 'researchQuestions').map((input) => input.value), [
    'Question one', 'Question two', 'Question three',
  ]);
  assert.deepEqual(listInputs(app.document, 'outcomes').map((input) => input.value), [
    'Outcome one', 'Outcome two', 'Outcome three',
  ]);
  assert.deepEqual(listNumbers(app.document, 'researchQuestions'), ['1.', '2.', '3.']);
  assert.deepEqual(listNumbers(app.document, 'outcomes'), ['1.', '2.', '3.']);
  assert.deepEqual(methodsGroups(app.document).map(methodValues), [
    ['Method one'], ['Method two'], ['Method three'],
  ]);
  assert.ok(questionRows.every((row) => row.querySelector('.list-remove')));
  assert.ok(outcomeRows.every((row) => row.querySelector('.list-remove')));
  assert.ok(groups.every((group) => group.querySelector('.add-btn')));
});

test('the confirmed structure saves, restores, and evaluates without re-pairing later entries', async (t) => {
  const first = await bootApp({
    confirm: () => true,
    evaluate: () => evaluationResult(),
  });
  populateThreePairs(first);
  removeQuestion(first.document, 1);
  await evaluateOutcomes(first);

  assert.deepEqual(first.evaluationRequests[0].body.entries, [
    { number: 1, text: 'Outcome one' },
    { number: 2, text: 'Outcome three' },
  ]);
  assert.deepEqual(first.evaluationRequests[0].body.researchQuestions, [
    { number: 1, text: 'Question one' },
    { number: 2, text: 'Question three' },
  ]);

  const savedRaw = await waitFor(() => first.window.localStorage.getItem(DRAFT_KEY), {
    timeout: 1500,
    message: 'The confirmed deletion was not saved',
  });
  const saved = JSON.parse(savedRaw);
  first.close();

  const restored = await bootApp({ draft: saved });
  t.after(() => restored.close());
  assert.deepEqual(listInputs(restored.document, 'researchQuestions').map((input) => input.value), [
    'Question one', 'Question three',
  ]);
  assert.deepEqual(listInputs(restored.document, 'outcomes').map((input) => input.value), [
    'Outcome one', 'Outcome three',
  ]);
  assert.deepEqual(methodsGroups(restored.document).map(methodValues), [
    ['Method one'], ['Method three'],
  ]);
  assert.deepEqual(
    methodsGroups(restored.document).map((group) => group.querySelector('.methods-group-q').title),
    ['Question one', 'Question three']
  );
});

test('test-profile loading still builds matching Question, Outcome, and Methods structures', async (t) => {
  const app = await bootApp({ url: 'https://research-plan.test/?test' });
  t.after(() => app.close());
  const select = app.document.querySelector('.test-profile-select');
  const button = app.document.querySelector('.test-profile-controls button');
  const profile = app.window.TEST_PROFILES[select.value];

  button.click();

  assert.deepEqual(
    listInputs(app.document, 'researchQuestions').map((input) => input.value),
    Array.from(profile.fields.researchQuestions)
  );
  assert.deepEqual(
    listInputs(app.document, 'outcomes').map((input) => input.value),
    Array.from(profile.fields.outcomes)
  );
  assert.equal(methodsGroups(app.document).length, profile.fields.researchQuestions.length);
  assert.ok(Array.from(app.document.querySelectorAll('.eval-btn')).every((evalButton) => !evalButton.hidden));
});
