'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  bootApp,
  listInputs,
  setValue,
  waitFor,
} = require('./app-harness');

function evaluationResult(metricName, score = 3) {
  return {
    metrics: [{ name: metricName, score, desc: metricName + ' description' }],
    recommendations: [metricName + ' recommendation'],
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function controlsForField(document, key) {
  const input = document.querySelector('[data-field="' + key + '"]');
  const list = document.querySelector('.list-rows[data-list-key="' + key + '"]');
  const field = (input || list).closest('.field');
  return field.querySelector('.eval-controls');
}

async function runEvaluation(app, controls) {
  const requestCount = app.evaluationRequests.length;
  const initialButton = controls.querySelector('.eval-btn');
  const quickButton = controls.querySelector('.eval-quick-reevaluate-btn');
  const button = initialButton.hidden ? quickButton : initialButton;
  button.click();
  await waitFor(() => app.evaluationRequests.length === requestCount + 1);
  await waitFor(() => !button.disabled);
}

function assertStale(controls) {
  assert.equal(controls.querySelector('.eval-result-summary').hidden, false);
  assert.equal(controls.querySelector('.eval-result-btn').classList.contains('eval-result-stale'), true);
  assert.equal(controls.querySelector('.eval-stale-status').hidden, false);
  assert.equal(controls.querySelector('.eval-stale-status').textContent, 'Results out of date');
  assert.equal(controls.querySelector('.eval-like-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-dislike-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-save-btn').disabled, true);
}

function assertReset(controls, label) {
  assert.equal(controls.querySelector('.eval-btn').hidden, false);
  assert.equal(controls.querySelector('.eval-btn').disabled, false);
  assert.equal(controls.querySelector('.eval-btn').textContent.trim(), 'Evaluate ' + label);
  assert.equal(controls.querySelector('.eval-result-summary').hidden, true);
  assert.equal(controls.querySelector('.eval-result-btn').getAttribute('aria-expanded'), 'false');
  assert.equal(controls.querySelector('.eval-result-btn').hasAttribute('aria-label'), false);
  assert.equal(controls.querySelector('.eval-stale-status').hidden, true);
  assert.equal(controls.querySelector('.eval-panel').hidden, true);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-dislike-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-save-btn').disabled, true);
}

test('marks a scalar result stale and replaces it in one click without blanking the old result', async (t) => {
  const replacement = deferred();
  let callCount = 0;
  const app = await bootApp({
    evaluate: () => {
      callCount++;
      return callCount === 1 ? evaluationResult('Original metric') : replacement.promise;
    },
  });
  t.after(() => app.close());
  const { document, window } = app;
  const background = document.querySelector('[data-field="background"]');
  const controls = controlsForField(document, 'background');
  const resultButton = controls.querySelector('.eval-result-btn');
  const panel = controls.querySelector('.eval-panel');
  const quickButton = controls.querySelector('.eval-quick-reevaluate-btn');

  setValue(window, background, 'Original background');
  await runEvaluation(app, controls);
  assert.equal(panel.hidden, true);
  assert.equal(resultButton.getAttribute('aria-expanded'), 'false');
  assert.equal(quickButton.hidden, false);
  assert.equal(controls.querySelector('.eval-mname').textContent, 'Original metric');
  assert.equal(controls.querySelector('.eval-like-btn').disabled, false);

  setValue(window, background, 'Changed background');
  assertStale(controls);
  assert.match(resultButton.getAttribute('aria-label'), /Results out of date/);
  assert.equal(quickButton.textContent, 'Update evaluation');

  const requestCount = app.evaluationRequests.length;
  quickButton.click();
  await waitFor(() => app.evaluationRequests.length === requestCount + 1);
  assert.equal(panel.hidden, true);
  assert.equal(controls.querySelector('.eval-mname').textContent, 'Original metric');
  assert.equal(controls.querySelector('.eval-rec').textContent, 'Original metric recommendation');

  resultButton.click();
  assert.equal(panel.hidden, false);
  assert.equal(resultButton.getAttribute('aria-expanded'), 'true');
  assert.equal(quickButton.hidden, true);
  assert.equal(controls.querySelector('.eval-mname').textContent, 'Original metric');

  replacement.resolve(evaluationResult('Replacement metric', 2));
  await waitFor(() => controls.querySelector('.eval-mname').textContent === 'Replacement metric');
  await waitFor(() => !quickButton.disabled);
  assert.equal(panel.hidden, true);
  assert.equal(resultButton.getAttribute('aria-expanded'), 'false');
  assert.equal(quickButton.hidden, false);
  assert.equal(controls.querySelector('.eval-stale-status').hidden, true);
  assert.equal(resultButton.classList.contains('eval-result-stale'), false);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, false);
  assert.equal(app.evaluationRequests[1].body.text, 'Changed background');
});

test('Research Question edits, additions, and removals make the aggregate stale', async (t) => {
  const app = await bootApp({ evaluate: () => evaluationResult('Question metric') });
  t.after(() => app.close());
  const { document, window } = app;
  const list = document.querySelector('.list-rows[data-list-key="researchQuestions"]');
  const field = list.closest('.field');
  const controls = controlsForField(document, 'researchQuestions');

  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  await runEvaluation(app, controls);
  setValue(window, listInputs(document, 'researchQuestions')[0], 'Edited question one');
  assertStale(controls);

  await runEvaluation(app, controls);
  field.querySelector('.add-btn').click();
  assertStale(controls);
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Question two');

  await runEvaluation(app, controls);
  listInputs(document, 'researchQuestions')[1].closest('.list-row').querySelector('.list-remove').click();
  assertStale(controls);
});

test('cancelling a populated Question removal does not stale an unchanged evaluation', async (t) => {
  const app = await bootApp({
    confirm: () => false,
    evaluate: () => evaluationResult('Question metric'),
  });
  t.after(() => app.close());
  const { document, window } = app;
  const list = document.querySelector('.list-rows[data-list-key="researchQuestions"]');
  const field = list.closest('.field');
  const controls = controlsForField(document, 'researchQuestions');

  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  field.querySelector('.add-btn').click();
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Question two');
  setValue(window, listInputs(document, 'outcomes')[1], 'Populated linked outcome');
  await runEvaluation(app, controls);

  listInputs(document, 'researchQuestions')[1]
    .closest('.list-row').querySelector('.list-remove').click();

  assert.equal(listInputs(document, 'researchQuestions').length, 2);
  assert.equal(controls.querySelector('.eval-result-btn').classList.contains('eval-result-stale'), false);
  assert.equal(controls.querySelector('.eval-stale-status').hidden, true);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, false);
  assert.equal(controls.querySelector('.eval-dislike-btn').disabled, false);
  assert.equal(controls.querySelector('.eval-save-btn').disabled, false);
});

test('Outcome edits, additions, and removals make the aggregate stale', async (t) => {
  const app = await bootApp({ evaluate: () => evaluationResult('Outcome metric') });
  t.after(() => app.close());
  const { document, window } = app;
  const list = document.querySelector('.list-rows[data-list-key="outcomes"]');
  const field = list.closest('.field');
  const controls = controlsForField(document, 'outcomes');

  setValue(window, listInputs(document, 'outcomes')[0], 'Outcome one');
  await runEvaluation(app, controls);
  setValue(window, listInputs(document, 'outcomes')[0], 'Edited outcome one');
  assertStale(controls);

  await runEvaluation(app, controls);
  field.querySelector('.add-btn').click();
  assertStale(controls);
  setValue(window, listInputs(document, 'outcomes')[1], 'Outcome two');

  await runEvaluation(app, controls);
  listInputs(document, 'outcomes')[1].closest('.list-row').querySelector('.list-remove').click();
  assertStale(controls);
});

test('Method edits, additions, and removals make the aggregate stale', async (t) => {
  // Methods evaluation is intentionally not enabled by the current template
  // (that belongs to a separate ticket). Exercise the already-supported eval
  // rendering path with a fixture override so RPA-39 covers it without
  // changing production scope.
  const template = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
  const app = await bootApp({
    evaluate: () => evaluationResult('Method metric'),
    textAssets: {
      'research-plan-template.md': template.replace('Methods (list):', 'Methods (list, eval):'),
    },
  });
  t.after(() => app.close());
  const { document, window } = app;
  const controls = controlsForField(document, 'methods');
  const group = document.querySelector('.methods-group');

  setValue(window, group.querySelector('.list-input'), 'Interviews');
  await runEvaluation(app, controls);
  setValue(window, group.querySelector('.list-input'), 'Moderated interviews');
  assertStale(controls);

  await runEvaluation(app, controls);
  group.querySelector('.add-btn').click();
  assertStale(controls);
  setValue(window, group.querySelectorAll('.list-input')[1], 'Survey');

  await runEvaluation(app, controls);
  group.querySelectorAll('.list-input')[1].closest('.list-row').querySelector('.list-remove').click();
  assertStale(controls);
});

test('re-evaluates all three questions and renders their set-level metrics', async (t) => {
  const metricNames = [
    'Research Question 1',
    'Research Question 2',
    'Research Question 3',
    'Duplication',
    'Coherence',
    'Alignment',
    'Overall Scope',
  ];
  let callCount = 0;
  const app = await bootApp({
    evaluate: () => {
      callCount++;
      if (callCount === 1) return evaluationResult('Research Question 1');
      return {
        metrics: metricNames.map((name) => ({ name, score: 2, desc: name + ' description' })),
        recommendations: ['Keep the three-question set focused.'],
      };
    },
  });
  t.after(() => app.close());
  const { document, window } = app;
  const field = document.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field');
  const controls = controlsForField(document, 'researchQuestions');

  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  await runEvaluation(app, controls);
  field.querySelector('.add-btn').click();
  field.querySelector('.add-btn').click();
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Question two');
  setValue(window, listInputs(document, 'researchQuestions')[2], 'Question three');
  assertStale(controls);

  await runEvaluation(app, controls);
  assert.deepEqual(app.evaluationRequests[1].body.entries, [
    { number: 1, text: 'Question one' },
    { number: 2, text: 'Question two' },
    { number: 3, text: 'Question three' },
  ]);
  assert.deepEqual(
    Array.from(controls.querySelectorAll('.eval-mname')).map((element) => element.textContent),
    metricNames
  );
});

test('Clear Form and test profiles still fully reset stale evaluation state', async (t) => {
  const app = await bootApp({
    evaluate: () => evaluationResult('Reset metric'),
    url: 'https://research-plan.test/?test',
  });
  t.after(() => app.close());
  const { document, window } = app;
  const background = document.querySelector('[data-field="background"]');
  const controls = controlsForField(document, 'background');

  setValue(window, background, 'First background');
  await runEvaluation(app, controls);
  setValue(window, background, 'Stale background');
  assertStale(controls);

  window.applyTestProfile('experienced');
  assert.equal(background.value, window.TEST_PROFILES.experienced.fields.background);
  assertReset(controls, 'Background');

  await runEvaluation(app, controls);
  setValue(window, background, 'Another stale background');
  assertStale(controls);
  document.getElementById('clear-btn').click();
  assert.equal(background.value, '');
  assertReset(controls, 'Background');
});
