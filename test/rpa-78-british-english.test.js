'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { bootApp, listInputs, waitFor, DRAFT_KEY } = require('./app-harness');
const { evaluationFixture } = require('./rpa-63-fixtures.cjs');
const baseline = require('./fixtures/rpa-78-pre-change.json');
const { classifyEvaluation } = require('../score-classification');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Exercise the real prompt builders, including private suggestion builders,
// without changing production exports or constructing a live provider client.
const serverRequire = createRequire(path.join(root, 'server.js'));
const serverModule = { exports: {} };
vm.runInNewContext(read('server.js') + `
  Object.assign(module.exports, { buildFrameworkMatchPrompt, buildFrameworkDraftPrompt,
    buildCoveragePrompt, buildGapSearchPrompt });
`, {
  module: serverModule, __dirname: root, console,
  process: { env: { ANTHROPIC_API_KEY: 'offline-test-placeholder' } },
  require: name => name === '@anthropic-ai/sdk' ? class {
    messages = { create: () => { throw new Error('Provider calls are forbidden in RPA-78 tests'); } };
  } : serverRequire(name),
});
const server = serverModule.exports;
const plain = value => JSON.parse(JSON.stringify(value));

function keyContract(document) {
  const keys = Object.fromEntries(['data-field', 'data-list-key', 'data-field-key'].map(attr => [
    attr, [...new Set([...document.querySelectorAll('[' + attr + ']')].map(e => e.getAttribute(attr)))].sort(),
  ]));
  keys.tables = [...document.querySelectorAll('table')].map(e => ({
    id: e.id, columns: [...e.querySelectorAll('th[data-col-key]')].map(c => ({ key: c.dataset.colKey, label: c.textContent.trim() })),
  }));
  return keys;
}

test('British document language, visible Methods hint and timeline button survive toggling', async t => {
  const app = await bootApp(); t.after(() => app.close());
  const { document } = app;
  assert.equal(document.documentElement.lang, 'en-GB');
  assert.match(document.querySelector('.methods-groups').closest('.field').querySelector('.field-hint-text').textContent, /user behaviours, needs, and experiences/);
  const button = document.querySelector('.timeline-viz-btn');
  // The visible text also supplies the accessible name; no stale aria-label overrides it.
  assert.equal(button.hasAttribute('aria-label'), false);
  assert.equal(button.textContent, 'Visualise Timeline');
  button.click(); assert.equal(button.textContent, 'Hide Timeline');
  button.click(); assert.equal(button.textContent, 'Visualise Timeline');
});

for (const [name, ending] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`${name}: pre-change field/list/column keys and all seven rubric mappings are retained`, async t => {
    const textAssets = Object.fromEntries(['research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']
      .map(file => [file, read(file).replace(/\r\n?|\n/g, ending)]));
    const app = await bootApp({ textAssets, draft: baseline.draft, evaluate: body => evaluationFixture(body, 'ready') });
    t.after(() => app.close());
    // Retained, not identical: RPA-101 added one Additional information
    // hatch per section, so the contract grows; nothing pre-change may go.
    const contract = keyContract(app.document);
    for (const attr of ['data-field', 'data-list-key', 'data-field-key']) {
      assert.deepEqual(baseline.keys[attr].filter((k) => !contract[attr].includes(k)), [], attr + ' keys retained');
    }
    assert.deepEqual(contract.tables, baseline.keys.tables);
    for (const button of app.document.querySelectorAll('.section-eval-btn')) button.click();
    await waitFor(() => app.evaluationRequests.length === 7);
    const bodies = app.evaluationRequests.map(r => r.body);
    const actual = Object.fromEntries(bodies.map(body => [body.fieldKey, { label: body.fieldLabel, criteria: body.rubric.map(c => c.name) }]));
    const expected = structuredClone(baseline.mappings);
    expected.outcomes.criteria[0] = 'Actionable'; // The only criterion-name change.
    assert.deepEqual(actual, expected);
    assert.match(bodies.find(b => b.fieldKey === 'goal').rubric[0].desc, /organisational value/);
    assert.match(bodies.find(b => b.fieldKey === 'objective').rubric[1].desc, /prioritising a roadmap/);
    assert.match(bodies.find(b => b.fieldKey === 'hypothesis').rubric[0].desc, /user behaviour/);
    for (const key of ['researchQuestions', 'outcomes']) {
      const body = bodies.find(b => b.fieldKey === key);
      assert.deepEqual(body.entries.map(e => e.number), [1, 3]);
      assert.deepEqual(body.entries.map(e => e.text), baseline.draft.lists[key].filter(Boolean));
    }
    assert.deepEqual(app.jsdomErrors, []);
  });
}

test('a draft saved by the pre-change app retains user spelling, multiline values, pairs and timeline data', async t => {
  const app = await bootApp({ draft: baseline.draft }); t.after(() => app.close());
  const { document, window } = app;
  for (const [key, value] of Object.entries(baseline.draft.fields)) {
    assert.equal(document.querySelector('[data-field="' + key + '"]').value, value, key);
  }
  for (const [key, values] of Object.entries(baseline.draft.lists)) {
    assert.deepEqual(listInputs(document, key).map(e => e.value), values, key);
  }
  const groups = () => [...document.querySelectorAll('.methods-group')];
  assert.deepEqual(groups().map(g => [...g.querySelectorAll('.list-input')].map(e => e.value)), baseline.draft.methods.map(g => g.methods));
  assert.deepEqual(groups().map(g => g.querySelector('.methods-group-q').title), baseline.draft.lists.researchQuestions);
  assert.equal(document.querySelector('.timeline-chart').hidden, false);
  assert.equal(document.querySelectorAll('.timeline-row').length, 2);
  assert.deepEqual([...document.querySelectorAll('#stageTimeline-table input[type=date]')].map(e => e.value), ['2026-09-01', '2026-09-07', '2026-09-08', '2026-09-14']);
  document.querySelector('.timeline-viz-btn').click();
  const saved = await waitFor(() => {
    const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
    return draft?.ui?.timelineVisible === false && draft;
  });
  const expected = structuredClone(baseline.draft);
  expected.savedAt = saved.savedAt; expected.ui.timelineVisible = false;
  // RPA-101: the draft remembers the step it was left on, and every
  // section's Additional information hatch is written, empty or not.
  expected.ui.section = 'plan-details';
  Object.assign(expected.custom, { additionalContext: [], additionalResearch: [], additionalMethodology: [] });
  assert.deepEqual(saved, expected, 'only the chosen visibility and save timestamp change');

  const reopened = await bootApp({ draft: saved }); t.after(() => reopened.close());
  assert.equal(reopened.document.querySelector('.timeline-chart').hidden, true);
  listInputs(reopened.document, 'researchQuestions')[0].closest('.list-row').querySelector('.list-remove').click();
  for (const key of ['researchQuestions', 'outcomes']) {
    const inputs = listInputs(reopened.document, key);
    assert.deepEqual(inputs.map(e => e.value), baseline.draft.lists[key].slice(1));
    inputs.forEach((e, i) => {
      assert.equal(e.closest('.list-row').querySelector('.list-num').textContent, `${i + 1}.`);
      assert.match(e.getAttribute('aria-label'), new RegExp(` ${i + 1}$`));
    });
  }
  assert.deepEqual([...reopened.document.querySelectorAll('.methods-group .list-input')].map(e => e.value), ['Unassigned method', 'Data Visualization']);
  assert.equal(reopened.document.activeElement, listInputs(reopened.document, 'researchQuestions')[0]);
});

test('Actionable reaches exact-name validation, recommendation schemas, visible results and calibration unchanged', async t => {
  let input, rubric, entries;
  const app = await bootApp({ draft: baseline.draft, evaluate: body => {
    if (body.fieldKey !== 'outcomes') return evaluationFixture(body, 'ready');
    ({ rubric, entries } = body);
    input = {
      entryEvaluations: entries.map((e, index) => ({ number: e.number, metrics: rubric.map((c, i) => ({
        name: c.name, score: index === 0 && i === 0 ? 1 : 3, desc: 'Original model text: color and behavior.',
      })) })),
      recommendations: [{ outcomeNumber: 1, criterionName: 'Actionable', text: 'Prioritise a concrete product decision.' }],
    };
    return server.formatOutcomesResult(input, entries, rubric);
  } });
  t.after(() => app.close());
  const controls = app.document.querySelector('[data-list-key=outcomes]').closest('.field').querySelector('.eval-controls');
  controls.closest('.acc').querySelector('.section-eval-btn').click();
  await waitFor(() => controls.querySelector('.eval-badge').textContent === 'Developing');
  const result = plain(server.formatOutcomesResult(input, entries, rubric));
  assert.equal(result.metrics[0].name, 'Outcome 1 — Actionable');
  assert.equal(result.metrics[0].scope, 'entry-quality');
  assert.deepEqual(result.metrics.map(m => m.score), [1, 3, 3, 3, 3, 3]);
  assert.equal(classifyEvaluation('outcomes', result.metrics).label, 'Developing');
  assert.match(controls.querySelector('.eval-metrics').textContent, /Outcome 1 — Actionable/);
  assert.match(controls.querySelector('.eval-recs').textContent, /Outcome 1 — Actionable: Prioritise/);
  const schema = server.outcomesEvalTool(rubric).input_schema.properties.recommendations.items.properties.criterionName;
  assert.deepEqual(plain(schema.enum), ['Actionable', 'Format', 'Alignment']);
  for (const target of ['metric', 'recommendation']) {
    const invalid = structuredClone(input);
    if (target === 'metric') invalid.entryEvaluations[0].metrics[0].name = 'Actionalble';
    else invalid.recommendations[0].criterionName = 'Actionalble';
    assert.throws(() => server.formatOutcomesResult(invalid, entries, rubric), /unexpected evaluation shape/);
  }
  let calibration;
  const originalFetch = app.window.fetch;
  app.window.fetch = async (url, init) => {
    if (url !== '/api/calibration') return originalFetch(url, init);
    calibration = JSON.parse(init.body); return { ok: true, json: async () => ({ ok: true }) };
  };
  controls.querySelector('.eval-save-btn').click();
  await waitFor(() => calibration);
  assert.deepEqual(calibration.metrics, result.metrics);
  assert.deepEqual(calibration.recommendations, result.recommendations);
});

test('all seven generated-feedback prompt paths request British English once and retain source text', () => {
  const authored = 'User text: organize a color visualization of behavior.';
  const rubric = [{ name: 'Actionable', desc: 'Original criterion meaning.' }, { name: 'Feasible', desc: 'Original scope.' }];
  const entries = [{ number: 3, text: authored }];
  const library = read('research-theoretical-frameworks.md');
  const prompts = [
    server.buildPrompt('Objective', authored, rubric),
    server.buildResearchQuestionsPrompt(entries, rubric, authored),
    server.buildOutcomesPrompt(entries, entries, rubric, authored),
    server.buildFrameworkMatchPrompt(authored, library),
    server.buildFrameworkDraftPrompt(authored, library),
    server.buildCoveragePrompt(authored, [authored], ['Data Visualisation']),
    server.buildGapSearchPrompt(authored, authored, ['Data Visualisation']),
  ];
  for (const prompt of prompts) {
    assert.equal((prompt.match(/Use British English spelling throughout/g) || []).length, 1);
    assert.ok(prompt.includes(authored), 'user spelling is passed through verbatim');
  }
  assert.match(prompts[0], /data visualisation errors/);
  assert.match(prompts[0], /users categorise their first expense/);
  assert.match(prompts[4], /outside of direct citations/);
  for (const title of ['culturalist theorizing', 'User Centered System Design', 'Sensemaking in Organizations']) {
    assert.ok(library.includes(title));
    assert.ok(prompts[3].includes(title) && prompts[4].includes(title));
  }
  const owned = library.split('\n').filter(line => /^(## |\* \*\*(Core Focus|UXR Application))/.test(line)).join('\n');
  assert.doesNotMatch(owned, /\b(behavior\w*|organizational|artifacts|centers|centered|Analyzes|categorizing|optimization|visualization|signaling|Labor)\b/i);
  assert.match(owned, /Behavioural, Motivational/);
  assert.match(owned, /data visualisation tools/);
});
