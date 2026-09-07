'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, listInputs, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const inputs = (app, key) => listInputs(app.document, key);
const values = (app, key) => inputs(app, key).map(input => input.value);
const groups = app => Array.from(app.document.querySelectorAll('.methods-group'));
const add = (app, key = 'researchQuestions') => inputs(app, key)[0].closest('.field').querySelector('.add-btn').click();
const remove = (app, index = 0) => {
  const button = inputs(app, 'researchQuestions')[index].closest('.list-row').querySelector('.list-remove');
  button.focus(); button.click(); return button;
};
function populate(app, outcomes = ['O1', 'O2', 'O3'], methods = ['M1', 'M2', 'M3']) {
  add(app); add(app);
  ['Q1', 'Q2', 'Q3'].forEach((v, i) => setValue(app.window, inputs(app, 'researchQuestions')[i], v));
  outcomes.forEach((v, i) => setValue(app.window, inputs(app, 'outcomes')[i], v));
  methods.forEach((v, i) => setValue(app.window, groups(app)[i].querySelector('.list-input'), v));
}
function paired(app, qs, os, ms) {
  assert.deepEqual(values(app, 'researchQuestions'), qs);
  assert.deepEqual(values(app, 'outcomes'), os);
  assert.deepEqual(groups(app).map(g => g.querySelector('.list-input').value), ms);
  for (const key of ['researchQuestions', 'outcomes']) {
    inputs(app, key).forEach((input, i) => {
      assert.equal(input.closest('.list-row').querySelector('.list-num').textContent, `${i + 1}.`);
      assert.match(input.getAttribute('aria-label'), new RegExp(` ${i + 1}$`));
    });
  }
  groups(app).forEach((g, i) => assert.equal(g.querySelector('.methods-group-q').title, qs[i]));
}

test('first deletion confirms exact populated group, preserves surviving nodes and extra Outcomes, and focuses next Question', async t => {
  const messages = [];
  const app = await bootApp({ confirm: message => { messages.push(message); return true; } });
  t.after(() => app.close()); populate(app);
  add(app, 'outcomes'); setValue(app.window, inputs(app, 'outcomes')[3], 'Extra');
  const surviving = inputs(app, 'researchQuestions').slice(1);
  const survivingMethods = groups(app).slice(1);
  remove(app);
  assert.deepEqual(messages, ['Deleting Research Question 1 will also delete:\n\n- Outcome 1\n- Methods RQ1']);
  paired(app, ['Q2', 'Q3'], ['O2', 'O3', 'Extra'], ['M2', 'M3']);
  assert.deepEqual(inputs(app, 'researchQuestions'), surviving);
  assert.deepEqual(groups(app), survivingMethods);
  assert.equal(app.document.activeElement, surviving[0]);
  const extra = inputs(app, 'outcomes')[2].closest('.list-row').querySelector('.list-remove');
  assert.equal(extra.disabled, false); extra.click();
  assert.deepEqual(values(app, 'outcomes'), ['O2', 'O3']);
});

test('cancellation preserves DOM, values, numbering, focus, draft and Last updated', async t => {
  const app = await bootApp({ confirm: () => false });
  t.after(() => app.close()); populate(app);
  await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY));
  const saved = app.window.localStorage.getItem(DRAFT_KEY);
  const markup = app.document.body.innerHTML;
  const nodes = Array.from(app.document.querySelectorAll('.list-row, .methods-group'));
  const button = remove(app);
  assert.equal(app.document.activeElement, button);
  assert.equal(app.document.body.innerHTML, markup);
  assert.deepEqual(Array.from(app.document.querySelectorAll('.list-row, .methods-group')), nodes);
  paired(app, ['Q1', 'Q2', 'Q3'], ['O1', 'O2', 'O3'], ['M1', 'M2', 'M3']);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), saved);
});

for (const methodsOnly of [false, true]) {
  test(methodsOnly ? 'Methods-only first group requires confirmation' : 'empty linked first group requires no confirmation', async t => {
    const messages = [];
    const app = await bootApp({ confirm: message => { messages.push(message); return true; } });
    t.after(() => app.close()); populate(app, ['', 'O2', 'O3'], [methodsOnly ? 'M1' : '', 'M2', 'M3']);
    remove(app);
    assert.deepEqual(messages, methodsOnly ? ['Deleting Research Question 1 will also delete:\n\n- Methods RQ1'] : []);
    paired(app, ['Q2', 'Q3'], ['O2', 'O3'], ['M2', 'M3']);
  });
}

test('repeat first deletion to one, add again, preserve unrelated list and Methods controls and question warning', async t => {
  const app = await bootApp(); t.after(() => app.close()); populate(app);
  add(app); const warning = inputs(app, 'researchQuestions')[0].closest('.field').querySelector('.field-warning');
  assert.equal(warning.hidden, false); remove(app, 3); assert.equal(warning.hidden, true);
  add(app, 'characteristics');
  const unrelated = inputs(app, 'characteristics')[0].closest('.field');
  const before = unrelated.innerHTML;
  remove(app); remove(app);
  paired(app, ['Q3'], ['O3'], ['M3']);
  const lone = inputs(app, 'researchQuestions')[0].closest('.list-row').querySelector('.list-remove');
  assert.equal(lone.disabled, true); lone.click(); assert.equal(inputs(app, 'researchQuestions').length, 1);
  add(app); assert.equal(lone.disabled, false); assert.equal(lone.classList.contains('list-remove-spacer'), false);
  assert.equal(inputs(app, 'outcomes').length, 2); assert.equal(groups(app).length, 2);
  assert.equal(unrelated.innerHTML, before);
  const methodGroup = groups(app)[0]; methodGroup.querySelector('.add-btn').click();
  assert.equal(methodGroup.querySelectorAll('.list-input').length, 2);
  methodGroup.querySelectorAll('.list-remove')[1].click();
  assert.equal(methodGroup.querySelectorAll('.list-input').length, 1);
});

test('first deletion stales evaluations and saves/reloads positional payloads; profile and Clear Form rebuild controls', async t => {
  const app = await bootApp({ url: 'https://research-plan.test/?test', evaluate: () => ({ metrics: [{name: 'Alignment', score: 2, desc: 'Mock'}], recommendations: [] }) });
  t.after(() => app.close()); populate(app);
  const section = inputs(app, 'researchQuestions')[0].closest('.acc').querySelector('.section-eval-btn');
  section.click(); await waitFor(() => app.evaluationRequests.length === 2 && !section.disabled);
  remove(app);
  for (const key of ['researchQuestions', 'outcomes']) {
    assert.equal(inputs(app, key)[0].closest('.field').querySelector('.eval-stale-status').hidden, false);
  }
  section.click(); await waitFor(() => app.evaluationRequests.length === 4 && !section.disabled);
  const payload = app.evaluationRequests[3].body;
  assert.deepEqual(payload.entries, [{number: 1, text: 'O2'}, {number: 2, text: 'O3'}]);
  assert.deepEqual(payload.researchQuestions, [{number: 1, text: 'Q2'}, {number: 2, text: 'Q3'}]);
  const saved = await waitFor(() => {
    const raw = app.window.localStorage.getItem(DRAFT_KEY);
    return raw && JSON.parse(raw).lists.researchQuestions[0] === 'Q2' && raw;
  });
  const restored = await bootApp({ draft: saved }); t.after(() => restored.close());
  paired(restored, ['Q2', 'Q3'], ['O2', 'O3'], ['M2', 'M3']);
  assert.equal(inputs(restored, 'researchQuestions')[0].closest('.list-row').querySelector('.list-remove').disabled, false);
  app.document.querySelector('.test-profile-controls button').click();
  const profile = app.window.TEST_PROFILES[app.document.querySelector('.test-profile-select').value];
  assert.deepEqual(values(app, 'researchQuestions'), Array.from(profile.fields.researchQuestions));
  remove(app);
  assert.deepEqual(values(app, 'researchQuestions'), Array.from(profile.fields.researchQuestions).slice(1));
  app.document.getElementById('clear-btn').click();
  assert.deepEqual(values(app, 'researchQuestions'), ['']);
  assert.deepEqual(values(app, 'outcomes'), ['']);
  assert.equal(groups(app).length, 1);
  assert.equal(inputs(app, 'researchQuestions')[0].closest('.list-row').querySelector('.list-remove').disabled, true);
  assert.ok(Array.from(app.document.querySelectorAll('.eval-result-summary')).every(el => el.hidden));
  add(app); assert.equal(inputs(app, 'researchQuestions')[0].closest('.list-row').querySelector('.list-remove').disabled, false);
});
