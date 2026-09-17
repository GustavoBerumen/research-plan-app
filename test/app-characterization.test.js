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
  // The group also holds the question's participant lists since RPA-116.
  return Array.from(group.querySelectorAll('.list-rows[data-list-key="methods"] .list-input')).map((input) => input.value);
}

function evaluationResult() {
  return {
    metrics: [{ name: 'Current quality', score: 2, desc: 'Characterized response' }],
    recommendations: ['Keep the current structure.'],
  };
}

async function runEvaluation(app, container) {
  const controls = container.matches('.eval-controls') ? container : container.querySelector('.eval-controls');
  const initial = controls.querySelector('.eval-btn');
  const hasResult = !controls.querySelector('.eval-result-summary').hidden;
  const button = hasResult ? controls.querySelector('.eval-quick-reevaluate-btn')
    : !initial.hidden ? initial : controls.closest('.acc').querySelector('.section-eval-btn');
  const count = app.evaluationRequests.length;
  button.click();
  await waitFor(() => app.evaluationRequests.length > count);
  await waitFor(() => !button.disabled);
}

test('renders the complete form from the real index, template, rubric, and methods list', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  assert.deepEqual(app.scriptSources, [
    'test-profiles.js',
    'plan-model.js',
    'plan-workflow.js',
    'score-classification.js',
    'textarea-autosize.js',
    'submission-contract.js',
    'submission-ui.js',
    'app.js',
  ]);
  assert.deepEqual(app.executedScripts, [
    'test-profiles.js',
    'plan-model.js',
    'plan-workflow.js',
    'score-classification.js',
    'textarea-autosize.js',
    'submission-contract.js',
    'submission-ui.js',
    'app.js',
  ]);
  assert.equal(document.querySelector('.doc-loading'), null);
  assert.equal(document.querySelectorAll('.doc-header').length, 1);
  // RPA-55: the title's guidance is a hint outside the control, not a
  // placeholder inside it.
  assert.equal(document.querySelector('[data-field="researchTitle"]').hasAttribute('placeholder'), false);
  const titleHint = document.querySelector('#field-researchTitle-hint');
  assert.ok(titleHint && titleHint.textContent.trim().length > 0, 'the title renders a hint');
  assert.equal(
    document.querySelector('[data-field="researchTitle"]').getAttribute('aria-describedby'),
    'field-researchTitle-hint'
  );

  assert.deepEqual(
    Array.from(document.querySelectorAll('.acc-title')).map((element) => element.textContent),
    // RPA-55: opens with what a researcher can write; Alignment (identifiers
    // and sign-off) closes; the two deadlines moved up into the header.
    // Alignment became the review step (RPA-55), which is deliberately not an
    // accordion, so it no longer appears among the collapsible sections.
    ['Context', 'Research', 'Studies', 'Methodology', 'Execution']
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('.acc-count')).map((element) => element.textContent),
    // Execution counts 3, not 4: Additional information is declared there but
    // belongs to the document, so renderSchema lifts it out of the accordion
    // and renders it after the sections (RPA-55).
    // Research reads 3 with Hypothesis dormant (RPA-117).
    ['3 fields', '3 fields', '2 fields', '3 fields', '2 fields']
  );
  assert.deepEqual(
    Array.from(document.querySelectorAll('.mlabel, .clbl, .flabel')).map(ownText),
    [
      // The page before the plan asks its one question as its heading (RPA-99).
      'What is your email address?',
      // Each field Gus has written the words for asks its question as its
      // heading (RPA-119); its name is kept for error messages and the check page.
      'Last updated', 'What is the name of your research plan?', 'Which project or initiative does this research support?',
      // Whether others are involved asks its question in its legend (RPA-141).
      'Who is leading this research?', 'Are other researchers involved in this research?', 'Researcher names', 'Who requested this research?',
      'When will the findings be used to make a decision?', 'When will the findings be shared with the team?',
      // One Additional information hatch closes each section (RPA-101).
      'What do people need to know about this project?', 'What is the goal of this project?', 'What problem are you trying to solve?', 'Additional information',
      // Hypothesis is dormant too (RPA-117, later the same day).
      'What do you want to learn from this research?', 'What questions do you need this research to answer?', 'What deliverables will answer your research questions?', 'Additional information',
      // Studies (RPA-142): the radios ask their question in the legend; the
      // studies field's own label is for assistive technology.
      'How many studies will you run?', 'Study questions',
      // Theory and Action Points are dormant (RPA-117).
      // Sample Size asks its question in its legend (RPA-118).
      // Who takes part is one question since RPA-119, where it was Characteristics and User Groups.
      'Which research methods will you use for this study?', 'Who should take part in this study?', 'How many participants do you need?', 'Additional information',
      'Planned Schedule',
      'Previous Knowledge', 'Additional information',
      // The review step closes the document, and Feedback closes the review
      // step — below the approvals, so a reader arrives at it having read the
      // whole plan (RPA-55).
      // Two declarations close the plan, one per role, each above its approval (RPA-115).
      // Feedback on the plan is dormant since RPA-98's rework; feedback on the tool has no field label.
      // The sign-off asks who you are before it asks you to sign (RPA-139).
      'Which of these are you?', 'What is the other person\u2019s email address?',
      'Declaration: Lead researcher', 'Sign off: Lead researcher', 'Declaration: Project requester', 'Sign off: Project requester',
    ]
  );
  // Column keys and types are in the DOM so they can be checked and styled.
  // The stylesheet sizes a column by what it holds rather than by the table's
  // id, which would tie CSS to a field key that no test scans for.
  //
  // Two columns, not three: RPA-55 cut Status. A signed, printed plan cannot
  // hold live state, and nothing has happened at the point the question is
  // asked. The type itself is still part of the template language, and keeps
  // its coverage in rpa-55-action-points.test.js.
  // Action Points is dormant (RPA-117); its column keys keep their coverage in
  // rpa-55-action-points.test.js, which brings the field back in a fixture.

  assert.deepEqual(
    Array.from(document.querySelectorAll('.dtbl')).map((table) => table.id),
    ['stageTimeline-table', 'previousKnowledge-table']
  );
  assert.equal(
    document.querySelector('.custom-fields-list[data-list-key="additionalResources"]')
      .closest('.field').querySelector('.add-btn').textContent,
    '+ Add additional information'
  );
  // Six, not seven: Hypothesis is an evaluated field and dormant (RPA-117).
  assert.equal(document.querySelectorAll('.eval-controls').length, 6);

  // RPA-55: a textarea can declare how tall it starts, in the template, as a
  // hint about how much answer its question expects. Autosize grows it from
  // there; a field that declares nothing keeps the shared default.
  assert.deepEqual(
    ['background', 'goal', 'problemStatement', 'objective'].map((key) => {
      const ta = document.querySelector(`[data-field="${key}"]`);
      return [key, ta.rows, ta.classList.contains('finput-rows')];
    }),
    [
      ['background', 2, true],
      ['goal', 2, true],
      ['problemStatement', 2, true],
      ['objective', 2, true],
    ]
  );
  // The Participants group is gone: its three fields are asked per research
  // question, inside the question's group under Methods (RPA-116).
  assert.equal(document.querySelector('.field-group-title'), null);
  assert.deepEqual(Array.from(document.querySelectorAll('.methods-group .field-per-question .flabel')).map(ownText), ['Which research methods will you use for this study?', 'Who should take part in this study?', 'How many participants do you need?']);

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

test('keeps Methods grouped under their studies, each study naming the questions it answers', async (t) => {
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
  // Groups follow studies since RPA-142: two studies, one question each.
  document.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  const studyGroups = document.querySelectorAll('.study-group');
  studyGroups[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups[1].querySelectorAll('.study-question-input')[1].click();

  const groups = Array.from(document.querySelectorAll('.methods-group'));
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => Array.from(group.querySelectorAll('.methods-group-text li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim())),
    [['RQ1 What causes checkout abandonment?'], ['RQ2 How do shoppers interpret payment requirements?']]
  );

  setValue(window, groups[0].querySelector('.list-input'), 'Interviews');
  groups[0].querySelector('.add-btn').click();
  setValue(window, groups[0].querySelectorAll('.list-input')[1], 'Survey');
  setValue(window, groups[1].querySelector('.list-input'), 'Usability Testing');

  assert.deepEqual(methodValues(groups[0]), ['Interviews', 'Survey']);
  assert.deepEqual(methodValues(groups[1]), ['Usability Testing']);
  assert.match(groups[0].getAttribute('aria-label'), /^Methods for Study 1: RQ1 /);
  assert.match(groups[1].getAttribute('aria-label'), /^Methods for Study 2: RQ2 /);
});

test('round-trips a draft with Research Questions restored before dependent rows', async (t) => {
  const first = await bootApp();
  const { document, window } = first;

  setValue(window, document.querySelector('[data-field="researchTitle"]'), 'Checkout study');
  setValue(window, document.querySelector('[data-field="background"]'), 'Current checkout context');
  setValue(window, listInputs(document, 'researchQuestions')[0], 'Question one');
  addListRow(document, 'researchQuestions');
  setValue(window, listInputs(document, 'researchQuestions')[1], 'Question two');
  setValue(window, listInputs(document, 'outcomes')[0], 'Outcome one');
  setValue(window, listInputs(document, 'outcomes')[1], 'Outcome two');
  document.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  const studyGroups = document.querySelectorAll('.study-group');
  studyGroups[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups[1].querySelectorAll('.study-question-input')[1].click();

  const groups = Array.from(document.querySelectorAll('.methods-group'));
  setValue(window, groups[0].querySelector('.list-input'), 'Interviews');
  setValue(window, groups[1].querySelector('.list-input'), 'Usability Testing');
  groups[1].querySelector('.add-btn').click();
  setValue(window, groups[1].querySelectorAll('.list-input')[1], 'Survey');

  // The address given before the plan is already saved (RPA-99): wait for the last edit.
  const savedRaw = await waitFor(() => { const r = window.localStorage.getItem(DRAFT_KEY); return r && r.includes('Survey') && r; }, {
    timeout: 5000,
    message: 'The draft was not saved',
  });
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.version, 11);
  assert.match(saved.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(saved.studies.map((s) => s.questions), [[1], [2]], 'each study says which question it answers, by number');

  const { researchQuestions, outcomes, ...otherLists } = saved.lists;
  saved.lists = { outcomes, ...otherLists, researchQuestions };
  first.close();

  const restored = await bootApp({ draft: saved });
  t.after(() => restored.close());
  assert.equal(restored.document.querySelector('[data-field="researchTitle"]').value, 'Checkout study');
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
    restoredGroups.map((group) => Array.from(group.querySelectorAll('.methods-group-text li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim())),
    [['RQ1 Question one'], ['RQ2 Question two']]
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
  const backgroundField = document.querySelector('[data-field="background"]').closest('.field');
  await runEvaluation(app, researchQuestionsField);
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
    { fieldKey: 'objective', fieldLabel: 'Objective', text: 'Choose the checkout direction' },
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
  assert.equal(evaluateButton.hidden, true);
  assert.equal(evaluateButton.disabled, false);
  assert.equal(evaluateButton.textContent.trim(), 'Retry Background');
  assert.equal(resultButton.hidden, true);
  assert.equal(resultButton.getAttribute('aria-expanded'), 'false');
  assert.equal(resultButton.hasAttribute('aria-label'), false);
  assert.equal(panel.hidden, true);
  assert.equal(controls.querySelector('.eval-like-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-dislike-btn').disabled, true);
  assert.equal(controls.querySelector('.eval-save-btn').disabled, true);
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null);
});
