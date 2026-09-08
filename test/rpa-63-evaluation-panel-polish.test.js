'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, listInputs, setValue, waitFor } = require('./app-harness');
const { evaluationFixture } = require('./rpa-63-fixtures.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const controlsFor = (document, key) => (document.querySelector(`[data-field="${key}"]`) || document.querySelector(`[data-list-key="${key}"]`)).closest('.field').querySelector('.eval-controls');
async function evaluatedApp(t, key = 'background', scenario = 'guardrail', evaluate) {
  const app = await bootApp({ evaluate: evaluate || (body => evaluationFixture(body, scenario)) });
  t.after(() => app.close());
  if (key === 'background') setValue(app.window, app.document.querySelector('[data-field="background"]'), 'Checkout research context.');
  else {
    const list = app.document.querySelector('[data-list-key="researchQuestions"]');
    list.closest('.field').querySelector('.add-btn').click();
    list.closest('.field').querySelector('.add-btn').click();
    for (const listKey of key === 'outcomes' ? ['researchQuestions', 'outcomes'] : ['researchQuestions']) {
      const inputs = listInputs(app.document, listKey);
      setValue(app.window, inputs[0], 'First populated entry');
      setValue(app.window, inputs[2], 'Third populated entry');
    }
  }
  const controls = controlsFor(app.document, key);
  controls.closest('.acc').querySelector('.section-eval-btn').click();
  await waitFor(() => controls.querySelector('.eval-badge').textContent && !controls.querySelector('.eval-reevaluate-btn').disabled);
  controls.querySelector('.eval-result-btn').click();
  return { ...app, controls };
}
for (const key of ['background', 'researchQuestions', 'outcomes']) {
  test(`${key}: named panel, heading order, exact scores and positional labels`, async t => {
    const app = await evaluatedApp(t, key);
    const panel = app.controls.querySelector('.eval-panel');
    assert.equal(panel.getAttribute('role'), 'region');
    assert.equal(app.document.getElementById(panel.getAttribute('aria-labelledby')), panel.querySelector('h3'));
    const body = app.evaluationRequests.find(request => request.body.fieldKey === key).body;
    const expected = evaluationFixture(body);
    assert.deepEqual([...panel.querySelectorAll('.eval-mname')].map(e => e.textContent), expected.metrics.map(m => m.name));
    assert.deepEqual([...panel.querySelectorAll('.eval-mdesc')].map(e => e.textContent), expected.metrics.map(m => m.desc));
    assert.deepEqual([...panel.querySelectorAll('.eval-dots')].map(e => e.getAttribute('aria-label')), expected.metrics.map(m => `Scored ${m.score} out of 3`));
    assert.deepEqual([...panel.querySelectorAll('.eval-rec')].map(e => e.textContent), expected.recommendations);
    for (const metric of panel.querySelectorAll('.eval-metric')) assert.deepEqual([...metric.children].map(e => e.className), ['eval-mname', 'eval-dots', 'eval-mdesc']);
    if (key !== 'background') {
      assert.deepEqual(body.entries.map(e => e.number), [1, 3]);
      assert.equal(panel.querySelector('.eval-badge').textContent, 'Developing');
      assert.match(panel.querySelector('.eval-explanation').textContent, /Resolve critical entry weaknesses/);
    }
    for (const kind of ['like', 'dislike', 'save']) {
      const button = panel.querySelector(`.eval-${kind}-btn`);
      assert.equal(button.type, 'button');
      assert.match(button.textContent, new RegExp(kind, 'i'));
      assert.equal(button.querySelector('svg').getAttribute('aria-hidden'), 'true');
      assert.equal(button.querySelector('svg').getAttribute('focusable'), 'false');
      assert.equal(button.disabled, false);
    }
    panel.querySelector('.eval-x').click();
    assert.equal(app.document.activeElement, app.controls.querySelector('.eval-result-btn'));
    assert.equal(panel.hidden, true);
  });
}
test('Ready without recommendations has no visible empty heading, list or guardrail explanation', async t => {
  const { controls } = await evaluatedApp(t, 'researchQuestions', 'ready');
  assert.equal(controls.querySelector('.eval-badge').textContent, 'Ready');
  for (const selector of ['.eval-rlabel', '.eval-recs', '.eval-explanation']) assert.equal(controls.querySelector(selector).hidden, true);
  assert.equal(controls.querySelectorAll('.eval-rec').length, 0);
});
for (const [kind, completed] of [['like', 'Liked'], ['dislike', 'Disliked'], ['save', 'Saved']]) {
  test(`${kind}: saving, saved and disabled semantics preserve exact calibration payload and reset on new results`, async t => {
    const app = await evaluatedApp(t);
    const save = deferred(); let payload; let calls = 0;
    const fetch = app.window.fetch;
    app.window.fetch = (url, init) => {
      if (url === '/api/calibration') { calls++; payload = JSON.parse(init.body); return save.promise; }
      return fetch(url, init);
    };
    const button = app.controls.querySelector(`.eval-${kind}-btn`);
    button.click(); button.click();
    assert.equal(calls, 1);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.match(app.controls.querySelector('[role="status"].eval-feedback-status').textContent, /Saving/);
    assert.ok([...app.controls.querySelectorAll('.eval-fb-btn')].every(e => e.disabled));
    assert.deepEqual(payload.metrics, evaluationFixture(app.evaluationRequests[0].body).metrics);
    assert.deepEqual(payload.recommendations, evaluationFixture(app.evaluationRequests[0].body).recommendations);
    assert.equal(payload.feedback, kind === 'save' ? null : kind);
    save.resolve({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => button.title === completed);
    assert.equal(button.getAttribute('aria-busy'), 'false');
    assert.equal(button.textContent, completed);
    assert.equal(button.disabled, true);
    if (kind !== 'save') assert.equal(button.getAttribute('aria-pressed'), 'true');
    setValue(app.window, app.document.querySelector('[data-field="background"]'), 'Changed context');
    assert.equal(button.textContent, completed);
    assert.equal(app.controls.querySelector('.eval-stale-status').hidden, false);
    app.controls.querySelector('.eval-reevaluate-btn').click();
    assert.equal(app.controls.querySelector('.eval-reevaluate-btn').getAttribute('aria-busy'), 'true');
    await waitFor(() => !app.controls.querySelector('.eval-reevaluate-btn').disabled);
    assert.equal(app.controls.querySelector('.eval-feedback-status').textContent, '');
    for (const kind of ['like', 'dislike']) assert.equal(app.controls.querySelector(`.eval-${kind}-btn`).getAttribute('aria-pressed'), 'false');
    assert.ok([...app.controls.querySelectorAll('.eval-fb-btn')].every(e => !e.disabled && !e.classList.contains('active')));
  });
}
test('save failure announces failure, clears busy and enables a manual retry', async t => {
  const app = await evaluatedApp(t);
  const fetch = app.window.fetch;
  app.window.fetch = (url, init) => url === '/api/calibration' ? Promise.resolve({ ok: false, json: async () => ({ error: 'Offline failure' }) }) : fetch(url, init);
  const save = app.controls.querySelector('.eval-save-btn');
  save.click();
  await waitFor(() => app.alerts.length);
  assert.equal(save.textContent, 'Save');
  assert.equal(save.getAttribute('aria-busy'), 'false');
  assert.equal(app.controls.querySelector('.eval-feedback-status').textContent, 'Evaluation could not be saved.');
  assert.ok([...app.controls.querySelectorAll('.eval-fb-btn')].every(e => !e.disabled));
});
test('reevaluation failure preserves selected feedback, rendered result and recovery semantics', async t => {
  let fail = false;
  const app = await evaluatedApp(t, 'background', 'guardrail', body => { if (fail) throw new Error('Offline failure.'); return evaluationFixture(body); });
  const fetch = app.window.fetch;
  app.window.fetch = (url, init) => url === '/api/calibration' ? Promise.resolve({ ok: true, json: async () => ({ ok: true }) }) : fetch(url, init);
  const like = app.controls.querySelector('.eval-like-btn');
  like.click(); await waitFor(() => like.title === 'Liked');
  const before = app.controls.querySelector('.eval-metrics').innerHTML;
  fail = true;
  app.controls.querySelector('.eval-reevaluate-btn').click();
  assert.equal(like.getAttribute('aria-pressed'), 'true');
  assert.equal(app.controls.querySelector('.eval-metrics').innerHTML, before);
  await waitFor(() => !app.controls.querySelector('.eval-reevaluate-btn').disabled);
  assert.equal(like.getAttribute('aria-pressed'), 'true');
  assert.equal(like.disabled, true);
  assert.equal(app.controls.querySelector('.eval-error').getAttribute('role'), 'alert');
  assert.equal(app.controls.querySelector('.eval-reevaluate-btn').getAttribute('aria-busy'), 'false');
  fail = false;
  app.controls.querySelector('.eval-btn').click();
  await waitFor(() => !like.disabled);
  assert.equal(like.getAttribute('aria-pressed'), 'false');
});
