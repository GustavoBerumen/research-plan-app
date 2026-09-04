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

function ownText(element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('')
    .trim();
}

function addListRow(document, key) {
  const list = document.querySelector('.list-rows[data-list-key="' + key + '"]');
  const button = list.closest('.field').querySelector('.add-btn');
  button.click();
}

function methodValues(group) {
  return Array.from(group.querySelectorAll('.list-input')).map((input) => input.value);
}

function evaluationResult() {
  return {
    metrics: [{ name: 'Current quality', score: 2, desc: 'Characterized response' }],
    recommendations: ['Keep the current structure.'],
  };
}

async function runEvaluation(app, container) {
  const requestCount = app.evaluationRequests.length;
  const button = container.querySelector('.eval-btn');
  button.click();
  await waitFor(() => app.evaluationRequests.length === requestCount + 1);
  await waitFor(() => !button.disabled);
}

test('renders the complete form from the real index, template, rubric, and methods list', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  assert.deepEqual(app.scriptSources, [
    'https://accounts.google.com/gsi/client',
    'https://apis.google.com/js/api.js',
    'test-profiles.js',
    'score-classification.js',
    'textarea-autosize.js',
    'app.js',
  ]);
  assert.deepEqual(app.executedScripts, [
    'test-profiles.js',
    'score-classification.js',
    'textarea-autosize.js',
    'app.js',
  ]);
  assert.equal(document.querySelector('.doc-loading'), null);
  assert.equal(document.querySelectorAll('.doc-header').length, 1);
  assert.equal(document.querySelector('[data-field="title"]').placeholder, 'Title for your research plan');

  assert.deepEqual(
    Array.from(document.querySelectorAll('.acc-title')).map((element) => element.textContent),
    // RPA-55: opens with what a researcher can write; Alignment (identifiers
    // and sign-off) closes; the two deadlines moved up into the header.
    ['Project Context', 'Research', 'Methodology', 'Execution', 'Resources', 'Alignment']
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('.acc-count')).map((element) => element.textContent),
    ['3 fields', '4 fields', '5 fields', '3 fields', '2 fields', '4 fields']
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('.mlabel, .clbl, .flabel')).map(ownText),
    [
      'Last Updated', 'Researcher', 'Project Owner', 'Project Decision', 'Report Research',
      'Background', 'Goal', 'Problem Statement',
      'Objective', 'Hypothesis', 'Research Questions', 'Outcomes',
      'Theory', 'Methods', 'Characteristics', 'User Groups', 'Sample Size',
      'Requirements', 'Stage Timeline', 'Action Points',
      'Previous Knowledge',
      'Project', 'Jira Project', 'Sign off: Project Owner', 'Sign off: Researcher',
      'Comments',
    ]
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('.dtbl')).map((table) => table.id),
    ['requirements-table', 'stageTimeline-table', 'actionPoints-table', 'previousKnowledge-table']
  );
  assert.equal(
    document.querySelector('.custom-fields-list[data-list-key="additionalResources"]')
      .closest('.field').querySelector('.add-btn').textContent,
    '+ Add additional section'
  );
  assert.equal(document.querySelectorAll('.eval-controls').length, 7);
  assert.equal(document.querySelector('.field-group-title').textContent, 'Participants');

  const methodInput = document.querySelector('.methods-group .list-input');
  assert.equal(methodInput.getAttribute('role'), 'combobox');
  setValue(window, methodInput, 'Backcast');
  assert.ok(
    Array.from(document.querySelectorAll('.combo-item'))
      .some((item) => item.textContent === 'Backcasting')
  );
  assert.deepEqual(app.alerts, []);
  assert.deepEqual(app.jsdomErrors, []);
});

test('keeps Outcome rows aligned positionally with Research Questions in valid states', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  addListRow(document, 'researchQuestions');
  addListRow(document, 'researchQuestions');
  const questions = listInputs(document, 'researchQuestions');
  setValue(window, questions[1], 'Question two');
  setValue(window, questions[2], 'Question three');

  let outcomes = listInputs(document, 'outcomes');
  assert.equal(outcomes.length, 3);
  assert.deepEqual(
    Array.from(document.querySelectorAll('.list-rows[data-list-key="outcomes"] .list-num'))
      .map((number) => number.textContent),
    ['1.', '2.', '3.']
  );
  setValue(window, outcomes[0], 'Outcome one');
  setValue(window, outcomes[1], 'Outcome two');

  questions[2].closest('.list-row').querySelector('.list-remove').click();
  outcomes = listInputs(document, 'outcomes');
  assert.deepEqual(listInputs(document, 'researchQuestions').map((input) => input.value), [
    'Question one',
    'Question two',
  ]);
  assert.deepEqual(outcomes.map((input) => input.value), ['Outcome one', 'Outcome two']);
});

test('keeps Methods grouped under their Research Question positions', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setValue(
    window,
    listInputs(document, 'researchQuestions')[0],
    'What causes checkout abandonment?'
  );
  addListRow(document, 'researchQuestions');
  setValue(
    window,
    listInputs(document, 'researchQuestions')[1],
    'How do shoppers interpret payment requirements?'
  );

  const groups = Array.from(document.querySelectorAll('.methods-group'));
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.querySelector('.methods-group-q').title),
    ['What causes checkout abandonment?', 'How do shoppers interpret payment requirements?']
  );

  setValue(window, groups[0].querySelector('.list-input'), 'Interviews');
  groups[0].querySelector('.add-btn').click();
  setValue(window, groups[0].querySelectorAll('.list-input')[1], 'Survey');
  setValue(window, groups[1].querySelector('.list-input'), 'Usability Testing');

  assert.deepEqual(methodValues(groups[0]), ['Interviews', 'Survey']);
  assert.deepEqual(methodValues(groups[1]), ['Usability Testing']);
  assert.match(groups[0].getAttribute('aria-label'), /^Methods for RQ1/);
  assert.match(groups[1].getAttribute('aria-label'), /^Methods for RQ2/);
});

test('round-trips a draft-v3 with Research Questions restored before dependent rows', async (t) => {
  const first = await bootApp();
  const { document, window } = first;

  setValue(window, document.querySelector('[data-field="title"]'), 'Checkout study');
  setValue(window, document.querySelector('[data-field="background"]'), 'Current checkout context');
  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  addListRow(document, 'researchQuestions');
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Question two');
  setValue(window, listInputs(document, 'outcomes')[0], 'Outcome one');
  setValue(window, listInputs(document, 'outcomes')[1], 'Outcome two');

  const groups = Array.from(document.querySelectorAll('.methods-group'));
  setValue(window, groups[0].querySelector('.list-input'), 'Interviews');
  setValue(window, groups[1].querySelector('.list-input'), 'Usability Testing');
  groups[1].querySelector('.add-btn').click();
  setValue(window, groups[1].querySelectorAll('.list-input')[1], 'Survey');

  const savedRaw = await waitFor(() => window.localStorage.getItem(DRAFT_KEY), {
    timeout: 1500,
    message: 'The v3 draft was not saved',
  });
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.version, 3);
  assert.match(saved.savedAt, /^\d{4}-\d{2}-\d{2}T/);

  const { researchQuestions, outcomes, ...otherLists } = saved.lists;
  saved.lists = { outcomes, ...otherLists, researchQuestions };
  first.close();

  const restored = await bootApp({ draft: saved });
  t.after(() => restored.close());
  assert.equal(restored.document.querySelector('[data-field="title"]').value, 'Checkout study');
  assert.equal(restored.document.querySelector('[data-field="background"]').value, 'Current checkout context');
  assert.deepEqual(listInputs(restored.document, 'researchQuestions').map((input) => input.value), [
    'Question one',
    'Question two',
  ]);
  assert.deepEqual(listInputs(restored.document, 'outcomes').map((input) => input.value), [
    'Outcome one',
    'Outcome two',
  ]);
  const restoredGroups = Array.from(restored.document.querySelectorAll('.methods-group'));
  assert.deepEqual(restoredGroups.map(methodValues), [
    ['Interviews'],
    ['Usability Testing', 'Survey'],
  ]);
  assert.deepEqual(
    restoredGroups.map((group) => group.querySelector('.methods-group-q').title),
    ['Question one', 'Question two']
  );
});

test('sends current payload shapes for Research Questions, Outcomes, and a scalar field', async (t) => {
  const app = await bootApp({ evaluate: () => evaluationResult() });
  t.after(() => app.close());
  const { document, window } = app;

  setValue(window, document.querySelector('[data-field="objective"]'), 'Choose the checkout direction');
  setValue(window, document.querySelector('[data-field="background"]'), 'Checkout abandonment is rising.');
  setValue(window, listInputs(document, 'researchQuestions')[0], 'Why do shoppers abandon?');
  addListRow(document, 'researchQuestions');
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Which fields confuse shoppers?');
  setValue(window, listInputs(document, 'outcomes')[0], 'Prioritized issue list');
  setValue(window, listInputs(document, 'outcomes')[1], 'Field requirements');

  const researchQuestionsField = document
    .querySelector('.list-rows[data-list-key="researchQuestions"]')
    .closest('.field');
  const outcomesField = document
    .querySelector('.list-rows[data-list-key="outcomes"]')
    .closest('.field');
  const backgroundField = document.querySelector('[data-field="background"]').closest('.field');
  await runEvaluation(app, researchQuestionsField);
  await runEvaluation(app, outcomesField);
  await runEvaluation(app, backgroundField);

  const payloads = app.evaluationRequests.map((request) => request.body);
  payloads.forEach((payload) => {
    assert.ok(payload.rubric.length > 0);
    payload.rubric.forEach((criterion) => {
      assert.equal(typeof criterion.name, 'string');
      assert.equal(typeof criterion.desc, 'string');
    });
  });
  assert.deepEqual(payloads.map(({ rubric, ...payload }) => payload), [
    {
      fieldKey: 'researchQuestions',
      fieldLabel: 'Research Questions',
      entries: [
        { number: 1, text: 'Why do shoppers abandon?' },
        { number: 2, text: 'Which fields confuse shoppers?' },
      ],
      context: { objective: 'Choose the checkout direction' },
    },
    {
      fieldKey: 'outcomes',
      fieldLabel: 'Outcomes',
      entries: [
        { number: 1, text: 'Prioritized issue list' },
        { number: 2, text: 'Field requirements' },
      ],
      context: { objective: 'Choose the checkout direction' },
      researchQuestions: [
        { number: 1, text: 'Why do shoppers abandon?' },
        { number: 2, text: 'Which fields confuse shoppers?' },
      ],
    },
    {
      fieldKey: 'background',
      fieldLabel: 'Background',
      text: 'Checkout abandonment is rising.',
    },
  ]);
  assert.ok(app.evaluationRequests.every((request) => request.method === 'POST'));
  assert.deepEqual(app.alerts, []);
});

test('Clear Form resets evaluation state', async (t) => {
  const app = await bootApp({ evaluate: () => evaluationResult() });
  t.after(() => app.close());
  const { document, window } = app;
  const background = document.querySelector('[data-field="background"]');
  const controls = background.closest('.field').querySelector('.eval-controls');
  const evaluateButton = controls.querySelector('.eval-btn');
  const resultButton = controls.querySelector('.eval-result-btn');
  const panel = controls.querySelector('.eval-panel');

  setValue(window, background, 'Context to evaluate');
  await runEvaluation(app, controls);
  assert.equal(evaluateButton.hidden, true);
  assert.equal(resultButton.hidden, false);
  resultButton.click();
  assert.equal(panel.hidden, false);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, false);

  document.getElementById('clear-btn').click();

  assert.equal(background.value, '');
  assert.equal(evaluateButton.hidden, false);
  assert.equal(evaluateButton.disabled, false);
  assert.equal(evaluateButton.textContent.trim(), 'Evaluate Background');
  assert.equal(resultButton.hidden, true);
  assert.equal(resultButton.getAttribute('aria-expanded'), 'false');
  assert.equal(resultButton.hasAttribute('aria-label'), false);
  assert.equal(panel.hidden, true);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-dislike-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-save-btn').disabled, true);
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null);
});
