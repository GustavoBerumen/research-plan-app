'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyEvaluation, styleForScore } = require('../score-classification');
const { bootApp, listInputs, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const previousKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = 'offline-test-placeholder';
const { formatResearchQuestionResult, formatOutcomesResult, QUESTION_SET_CRITERIA } = require('../server');
if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
else process.env.ANTHROPIC_API_KEY = previousKey;
const rubrics = {
  researchQuestions: ['Clear', 'Focused', 'Specific'],
  outcomes: ['Actionalble', 'Format', 'Alignment'],
};
const novice = ['What do users think about the checkout?', 'What would make the checkout better?'];
function fixture(key, scores) {
  const rubric = rubrics[key].map(name => ({ name, desc: name }));
  const entries = scores.map((_, i) => ({ number: i + 1, text: novice[i] || 'Strong peer' }));
  const input = {
    entryEvaluations: scores.map((values, i) => ({ number: i + 1, metrics: values.map((score, j) => ({ name: rubric[j].name, score, desc: `Original justification ${i}-${j}` })) })),
    setMetrics: scores.length > 1 ? QUESTION_SET_CRITERIA.map(c => ({ name: c.name, score: 3, desc: `Original ${c.name} justification` })) : [],
    recommendations: [],
  };
  const before = structuredClone(input);
  const result = (key === 'outcomes' ? formatOutcomesResult : formatResearchQuestionResult)(input, entries, rubric);
  assert.deepEqual(input, before);
  assert.deepEqual(result.metrics.slice(0, scores.length * 3).map(({score, desc}) => ({score, desc})), input.entryEvaluations.flatMap(e => e.metrics.map(({score, desc}) => ({score, desc}))));
  return result;
}
for (const key of Object.keys(rubrics)) {
  test(`${key}: weak peer cannot be masked, all-3 remains Ready, alignment is untouched`, () => {
    for (const count of [2, 4, 10]) {
      const scores = Array.from({length: count}, () => [3, 3, 3]);
      scores[0][1] = 1;
      const result = fixture(key, scores);
      assert.equal(classifyEvaluation(key, result.metrics).label, 'Developing');
      assert.equal(classifyEvaluation(key, result.metrics).tone, 'warning');
      for (const m of result.metrics.filter(m => m.scope === 'alignment')) {
        assert.equal(m.score, 3);
        assert.match(m.desc, /Original/);
      }
    }
    assert.equal(classifyEvaluation(key, fixture(key, [[3,3,3],[3,3,3]]).metrics).label, 'Ready');
    assert.equal(classifyEvaluation(key, fixture(key, [[2,3,3],[3,3,3]]).metrics).label, 'Ready');
  });
  test(`${key}: Novice and multiple critical metrics stay non-green`, () => {
    const scores = key === 'outcomes' ? [[1,1,3],[2,1,3]] : [[3,1,1],[3,2,1]];
    const result = classifyEvaluation(key, fixture(key, scores).metrics);
    assert.equal(result.label, 'Developing');
    assert.equal(result.tone, 'warning');
    assert.match(result.explanation, /1 of 3/);
    assert.equal(classifyEvaluation(key, fixture(key, [[1,1,1]]).metrics).label, 'Needs Work');
  });
  test(`${key}: real evaluation, save, stale update, autosave and restored draft`, async t => {
    let response = fixture(key, [[3,1,3],[3,3,3]]);
    const app = await bootApp({ evaluate: () => response });
    t.after(() => app.close());
    const qList = app.document.querySelector('[data-list-key="researchQuestions"]');
    qList.closest('.field').querySelector('.add-btn').click();
    listInputs(app.document, 'researchQuestions').forEach((input, i) => setValue(app.window, input, novice[i]));
    if (key === 'outcomes') listInputs(app.document, key).forEach((input, i) => setValue(app.window, input, ['A report about checkout.', 'Ideas to make checkout better.'][i]));
    const controls = app.document.querySelector(`[data-list-key="${key}"]`).closest('.field').querySelector('.eval-controls');
    controls.querySelector('.eval-btn').click();
    await waitFor(() => controls.querySelector('.eval-badge').textContent === 'Developing');
    assert.ok(controls.querySelector('.eval-panel').classList.contains('eval-tone-warning'));
    assert.ok(controls.querySelector('.eval-result-btn').classList.contains('eval-result-warning'));
    assert.match(controls.querySelector('.eval-result-btn').getAttribute('aria-label'), /Developing/);
    assert.match(controls.querySelector('.eval-explanation').textContent, /critical entry/);
    assert.equal(controls.querySelector('.eval-recs').hidden, true);
    assert.deepEqual(Array.from(controls.querySelectorAll('.eval-mdesc'), n => n.textContent), response.metrics.map(m => m.desc));
    let saved;
    const fetch = app.window.fetch;
    app.window.fetch = async (url, init) => {
      if (url === '/api/calibration') { saved = JSON.parse(init.body); return {ok: true, json: async () => ({ok: true})}; }
      return fetch(url, init);
    };
    controls.querySelector('.eval-save-btn').click();
    await waitFor(() => saved);
    assert.deepEqual(saved.metrics, response.metrics);
    assert.deepEqual(saved.recommendations, []);
    assert.equal(classifyEvaluation(key, JSON.parse(JSON.stringify(saved)).metrics).label, 'Developing');
    await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY));
    const draft = app.window.localStorage.getItem(DRAFT_KEY);
    const restored = await bootApp({draft, evaluate: () => response});
    t.after(() => restored.close());
    assert.deepEqual(listInputs(restored.document, key).map(n => n.value), listInputs(app.document, key).map(n => n.value));
    const restoredControls = restored.document.querySelector(`[data-list-key="${key}"]`).closest('.field').querySelector('.eval-controls');
    assert.equal(restoredControls.querySelector('.eval-result-btn').hidden, true);
    restoredControls.querySelector('.eval-btn').click();
    await waitFor(() => restoredControls.querySelector('.eval-badge').textContent === 'Developing');
    setValue(app.window, listInputs(app.document, key)[0], 'Revised entry');
    assert.ok(controls.querySelector('.eval-result-btn').classList.contains('eval-result-stale'));
    assert.equal(controls.querySelector('.eval-save-btn').disabled, true);
    response = fixture(key, [[3,3,3],[3,3,3]]);
    controls.querySelector('.eval-reevaluate-btn').click();
    await waitFor(() => controls.querySelector('.eval-badge').textContent === 'Ready');
    assert.equal(controls.querySelector('.eval-explanation').hidden, true);
    assert.ok(controls.querySelector('.eval-panel').classList.contains('eval-tone-success'));
  });
}
test('guardrail boundaries preserve worse statuses and scalar bands; relationship/set weaknesses do not trigger entry guardrail', () => {
  for (const scores of [[1,1], [1,2], [1,3], [1,2,3,3], [1,3,3,3,3,3,3,3], [1,3,3,3,3,3,3,3,3,3]]) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const metrics = scores.map(score => ({scope:'entry-quality', score}));
    assert.equal(classifyEvaluation('researchQuestions', metrics).label, styleForScore(Math.min(average,2)).label);
    assert.equal(classifyEvaluation('background', metrics).label, styleForScore(average).label);
  }
  for (const scope of ['alignment','set-quality']) {
    const metrics = [{scope,score:1}, ...Array.from({length:9}, () => ({scope:'entry-quality',score:3}))];
    assert.equal(classifyEvaluation('outcomes',metrics).label,'Ready');
    assert.equal(classifyEvaluation('outcomes',metrics).explanation,'');
  }
});
