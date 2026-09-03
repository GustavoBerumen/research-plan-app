'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EVAL_TOOL,
  OUTCOMES_EVAL_TOOL,
  QUESTION_SET_CRITERIA,
  RESEARCH_QUESTIONS_EVAL_TOOL,
  buildOutcomesPrompt,
  buildPrompt,
  buildResearchQuestionsPrompt,
  formatOutcomesResult,
  formatResearchQuestionResult,
  formatScalarResult,
  outcomesEvalTool,
  researchQuestionsEvalTool,
  scalarEvalTool,
} = loadEvaluationModule();
const { bootApp, setValue, waitFor } = require('./app-harness');

const RUBRIC = [
  { name: 'Specific', desc: 'The content is precise and bounded.' },
  { name: 'Feasible', desc: 'The content is achievable in the research effort.' },
];

function loadEvaluationModule() {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = previousKey || 'rpa-36-test-key';
  const evaluation = require('../server');
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousKey;
  return evaluation;
}

function metrics(scores, rubric = RUBRIC) {
  return rubric.map((criterion, index) => ({
    name: criterion.name,
    score: scores[index],
    desc: `${criterion.name} scored ${scores[index]}.`,
  }));
}

function entryEvaluation(number, scores) {
  return { number, metrics: metrics(scores) };
}

function questionSetMetrics(scores) {
  return metrics(scores, QUESTION_SET_CRITERIA);
}

function shapeError(fn) {
  assert.throws(fn, /unexpected evaluation shape/i);
}

async function runEvaluation(app, controls) {
  const button = controls.querySelector('.eval-btn');
  button.click();
  await waitFor(() => app.evaluationRequests.length === 1);
  await waitFor(() => !button.disabled);
}

test('structured-output schemas and prompts allow zero to two supported recommendations', () => {
  [EVAL_TOOL, RESEARCH_QUESTIONS_EVAL_TOOL, OUTCOMES_EVAL_TOOL].forEach((tool) => {
    const recommendations = tool.input_schema.properties.recommendations;
    assert.equal(recommendations.minItems, 0);
    assert.equal(recommendations.maxItems, 2);
    assert.ok(recommendations.items.required.includes('criterionName'));
  });

  assert.deepEqual(
    scalarEvalTool(RUBRIC).input_schema.properties.recommendations.items.properties.criterionName.enum,
    ['Specific', 'Feasible']
  );
  assert.deepEqual(
    outcomesEvalTool(RUBRIC).input_schema.properties.recommendations.items.properties.criterionName.enum,
    ['Specific', 'Feasible']
  );
  assert.deepEqual(
    researchQuestionsEvalTool(1, RUBRIC)
      .input_schema.properties.recommendations.items.properties.criterionName.enum,
    ['Specific', 'Feasible']
  );

  const scalarPrompt = buildPrompt('Background', 'A complete background.', RUBRIC);
  const questionPrompt = buildResearchQuestionsPrompt(
    [{ number: 1, text: 'Why do shoppers abandon checkout?' }],
    RUBRIC,
    'Identify checkout barriers.'
  );
  const outcomePrompt = buildOutcomesPrompt(
    [{ number: 1, text: 'A prioritised barrier list.' }],
    [{ number: 1, text: 'Why do shoppers abandon checkout?' }],
    RUBRIC,
    'Identify checkout barriers.'
  );
  [scalarPrompt, questionPrompt, outcomePrompt].forEach((prompt) => {
    assert.match(prompt, /zero, one, or two concrete recommendations/i);
    assert.match(prompt, /empty recommendations array/i);
    assert.match(prompt, /never invent advice/i);
    assert.doesNotMatch(prompt, /exactly (2|two) concrete recommendations/i);
  });
});

test('scalar evaluations accept zero, one, or two supported recommendations and reject malformed extras', () => {
  assert.deepEqual(formatScalarResult({
    metrics: metrics([3, 3]),
    recommendations: [],
  }, RUBRIC).recommendations, []);

  assert.deepEqual(formatScalarResult({
    metrics: metrics([2, 3]),
    recommendations: [
      { criterionName: 'Specific', text: 'Name the affected checkout stage.' },
    ],
  }, RUBRIC).recommendations, [
    'Specific: Name the affected checkout stage.',
  ]);

  assert.deepEqual(formatScalarResult({
    metrics: metrics([2, 1]),
    recommendations: [
      { criterionName: 'Specific', text: 'Name the affected checkout stage.' },
      { criterionName: 'Feasible', text: 'Limit the study to new shoppers.' },
    ],
  }, RUBRIC).recommendations, [
    'Specific: Name the affected checkout stage.',
    'Feasible: Limit the study to new shoppers.',
  ]);

  shapeError(() => formatScalarResult({
    metrics: metrics([2, 1]),
    recommendations: [
      { criterionName: 'Specific', text: 'First.' },
      { criterionName: 'Feasible', text: 'Second.' },
      { criterionName: 'Specific', text: 'Third.' },
    ],
  }, RUBRIC));
  shapeError(() => formatScalarResult({ metrics: metrics([3, 3]) }, RUBRIC));
  shapeError(() => formatScalarResult({
    metrics: metrics([3, 3]),
    recommendations: [{ criterionName: 'Specific', text: 'Invented advice.' }],
  }, RUBRIC));
});

test('Research Questions evaluations validate optional recommendations against their numbered target', () => {
  const entries = [
    { number: 1, text: 'Why do shoppers abandon checkout?' },
    { number: 2, text: 'Which payment requirements confuse shoppers?' },
  ];
  const allStrong = {
    entryEvaluations: [entryEvaluation(1, [3, 3]), entryEvaluation(2, [3, 3])],
    setMetrics: questionSetMetrics([3, 3, 3, 3]),
    recommendations: [],
  };
  assert.deepEqual(formatResearchQuestionResult(allStrong, entries, RUBRIC).recommendations, []);

  const lowerScores = {
    entryEvaluations: [entryEvaluation(1, [2, 3]), entryEvaluation(2, [3, 3])],
    setMetrics: questionSetMetrics([3, 3, 3, 2]),
  };
  assert.deepEqual(formatResearchQuestionResult({
    ...lowerScores,
    recommendations: [
      { questionNumber: 1, criterionName: 'Specific', text: 'Name the checkout stage.' },
    ],
  }, entries, RUBRIC).recommendations, [
    'Question 1 — Specific: Name the checkout stage.',
  ]);
  assert.deepEqual(formatResearchQuestionResult({
    ...lowerScores,
    recommendations: [
      { questionNumber: 1, criterionName: 'Specific', text: 'Name the checkout stage.' },
      { questionNumber: 0, criterionName: 'Overall Scope', text: 'Limit the set to payment.' },
    ],
  }, entries, RUBRIC).recommendations, [
    'Question 1 — Specific: Name the checkout stage.',
    'Question set — Overall Scope: Limit the set to payment.',
  ]);

  shapeError(() => formatResearchQuestionResult({
    ...lowerScores,
    recommendations: [{ questionNumber: 3, criterionName: 'Specific', text: 'Invalid target.' }],
  }, entries, RUBRIC));
  shapeError(() => formatResearchQuestionResult({
    ...lowerScores,
    recommendations: [
      { questionNumber: 1, criterionName: 'Specific', text: 'First.' },
      { questionNumber: 0, criterionName: 'Overall Scope', text: 'Second.' },
      { questionNumber: 1, criterionName: 'Specific', text: 'Third.' },
    ],
  }, entries, RUBRIC));

  const singleEntry = [entries[0]];
  shapeError(() => formatResearchQuestionResult({
    entryEvaluations: [entryEvaluation(1, [2, 3])],
    setMetrics: [],
    recommendations: [
      { questionNumber: 0, criterionName: 'Specific', text: 'Invalid set target.' },
    ],
  }, singleEntry, RUBRIC));
});

test('Outcomes evaluations validate zero, one, or two recommendations and numbered targets', () => {
  const entries = [
    { number: 1, text: 'A prioritised barrier list.' },
    { number: 2, text: 'Payment-field requirements.' },
  ];
  assert.deepEqual(formatOutcomesResult({
    entryEvaluations: [entryEvaluation(1, [3, 3]), entryEvaluation(2, [3, 3])],
    recommendations: [],
  }, entries, RUBRIC).recommendations, []);

  const lowerScores = {
    entryEvaluations: [entryEvaluation(1, [2, 3]), entryEvaluation(2, [3, 1])],
  };
  assert.deepEqual(formatOutcomesResult({
    ...lowerScores,
    recommendations: [
      { outcomeNumber: 1, criterionName: 'Specific', text: 'Name the ranking method.' },
    ],
  }, entries, RUBRIC).recommendations, [
    'Outcome 1 — Specific: Name the ranking method.',
  ]);
  assert.deepEqual(formatOutcomesResult({
    ...lowerScores,
    recommendations: [
      { outcomeNumber: 1, criterionName: 'Specific', text: 'Name the ranking method.' },
      { outcomeNumber: 2, criterionName: 'Feasible', text: 'Reduce the required artefacts.' },
    ],
  }, entries, RUBRIC).recommendations, [
    'Outcome 1 — Specific: Name the ranking method.',
    'Outcome 2 — Feasible: Reduce the required artefacts.',
  ]);

  shapeError(() => formatOutcomesResult({
    ...lowerScores,
    recommendations: [{ outcomeNumber: 3, criterionName: 'Specific', text: 'Invalid target.' }],
  }, entries, RUBRIC));
  shapeError(() => formatOutcomesResult({
    ...lowerScores,
    recommendations: [
      { outcomeNumber: 1, criterionName: 'Specific', text: 'First.' },
      { outcomeNumber: 2, criterionName: 'Feasible', text: 'Second.' },
      { outcomeNumber: 1, criterionName: 'Specific', text: 'Third.' },
    ],
  }, entries, RUBRIC));
});

test('client accepts and saves an evaluation with no recommendations without showing an empty section', async (t) => {
  const app = await bootApp({
    evaluate: () => ({
      metrics: [{ name: 'Complete', score: 3, desc: 'No material issue.' }],
      recommendations: [],
    }),
  });
  t.after(() => app.close());
  const { document, window } = app;
  const background = document.querySelector('[data-field="background"]');
  const controls = background.closest('.field').querySelector('.eval-controls');
  setValue(window, background, 'Checkout abandonment rose after the payment redesign.');

  await runEvaluation(app, controls);

  assert.equal(controls.querySelector('.eval-error').hidden, true);
  assert.equal(controls.querySelector('.eval-result-btn').hidden, false);
  controls.querySelector('.eval-result-btn').click();
  assert.equal(controls.querySelector('.eval-panel').hidden, false);
  assert.equal(controls.querySelector('.eval-rlabel').hidden, true);
  assert.equal(controls.querySelector('.eval-recs').hidden, true);
  assert.equal(controls.querySelectorAll('.eval-rec').length, 0);

  let calibrationPayload;
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (url.pathname === '/api/calibration') {
      calibrationPayload = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return originalFetch(input, init);
  };
  controls.querySelector('.eval-save-btn').click();
  await waitFor(() => calibrationPayload);
  assert.deepEqual(calibrationPayload.recommendations, []);
});
