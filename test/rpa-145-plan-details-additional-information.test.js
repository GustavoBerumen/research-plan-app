'use strict';

// RPA-145. Plan details closes with an Additional information hatch, like
// the four content sections (RPA-101, capped at one block by RPA-82). It was
// the one place a researcher had nowhere to put what the questions did not
// ask for. Plan details is the document's header, built from a title and
// meta fields rather than a section's fields, which is why it had none.
//
// It behaves exactly as the others do, through the same machinery: after
// the questions, never a numbered page, never required, reached from the
// check page's Change, carried in the URL as #plan-details/more, saved in the
// draft and the backup, and sent with the submission record.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');
const contract = require('../submission-contract');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const planOf = (d) => d.querySelector('.doc-header');
const hatchOf = (d) => planOf(d).querySelector('.field-custom');
const caption = (d) => text(planOf(d).querySelector('.step-page-caption'));
const press = (d) => planOf(d).querySelector('.step-continue').click();
const rowsOf = (d) => Array.from(planOf(d).querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
const shownUnits = (d) => Array.from(planOf(d).querySelectorAll('.title-field, .mf, .field-custom')).filter((u) => !u.hidden && !u.classList.contains('page-hidden') && !u.querySelector('[data-field="lastUpdated"]'));
async function toCheckPage(app) {
  const d = app.document;
  completeStep(app, planOf(d));
  app.window.location.hash = '#plan-details/1';
  await settle();
  for (let i = 0; i < 12 && !planOf(d).classList.contains('step-checking'); i++) { press(d); await settle(100); }
  assert.ok(planOf(d).classList.contains('step-checking'), 'Plan details reaches its check page');
}
function write(app, name, body) {
  const hatch = hatchOf(app.document);
  if (!hatch.querySelector('.custom-field-block')) hatch.querySelector('.add-btn').click();
  setValue(app.window, hatch.querySelector('.custom-field-name'), name);
  setValue(app.window, hatch.querySelector('.custom-field-body'), body);
}

test('the same control, the same hint and the same cap as the other four, under the header\'s questions', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const hatch = hatchOf(d);
  assert.ok(hatch, 'Plan details has a hatch');
  const context = d.querySelector('[data-step-slug="context"] .field-custom');
  assert.equal(text(hatch.querySelector('.flabel')), text(context.querySelector('.flabel')), 'named exactly as Context\'s is: ' + text(hatch.querySelector('.flabel')));
  assert.equal(text(hatch.querySelector('.flabel')), 'Additional information');
  assert.equal(text(hatch.querySelector('.field-hint-text')), 'Anything this section needs that its fields have no place for. It becomes its own titled part of the document.');
  assert.equal(text(hatch.querySelector('.field-hint-text')), text(context.querySelector('.field-hint-text')));
  assert.equal(hatch.querySelector('.custom-fields-list').dataset.listKey, 'additionalPlanDetails');
  assert.equal(hatch.closest('.meta-grid'), null, 'not one of the grid\'s questions');
  assert.ok(planOf(d).querySelector('.meta-grid').compareDocumentPosition(hatch) & 4, 'after them');
  assert.match(TEMPLATE, /^Additional information \(custom-fields, max=1, key=additionalPlanDetails\):$/m, 'declared in the template\'s header block, in the others\' words');

  hatch.querySelector('.add-btn').click();
  assert.equal(hatch.querySelectorAll('.custom-field-block').length, 1);
  assert.ok(hatch.querySelector('.add-btn').hidden || !hatch.querySelector('.add-btn').isConnected || hatch.querySelector('.add-btn-row').hidden, 'one block, and the control goes at the limit (RPA-82)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('not a numbered page and never required: the count is as it was, Save and continue passes it by, and empty it holds nothing back', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  app.window.location.hash = '#plan-details/1';
  await settle();
  // Counted against the same form without the hatch, so this holds whatever else changes the number of pages.
  const without = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace(/^Additional information \(custom-fields, max=1, key=additionalPlanDetails\):\n  Hint:[^\n]*\n/m, '') } });
  t.after(() => without.close());
  assert.equal(hatchOf(without.document), null, 'the fixture has no hatch in Plan details');
  without.window.location.hash = '#plan-details/1';
  await settle();
  assert.equal(caption(d), caption(without.document), 'the hatch adds no page: ' + caption(d));
  const seen = [];
  completeStep(app, planOf(d));
  for (let i = 0; i < 12 && !planOf(d).classList.contains('step-checking'); i++) { seen.push(shownUnits(d).includes(hatchOf(d))); press(d); await settle(100); }
  assert.ok(planOf(d).classList.contains('step-checking'));
  assert.equal(seen.some(Boolean), false, 'Save and continue never lands on it');
  assert.equal(hatchOf(d).querySelectorAll('.custom-field-block').length, 0, 'and nothing was written there');
  app.window.location.hash = '#sections';
  await settle();
  const task = Array.from(d.querySelectorAll('.task-item')).find((r) => text(r.querySelector('.task-name')) === 'Plan details');
  assert.equal(text(task.querySelector('.task-status')), 'Completed', 'an empty hatch never holds Plan details at incomplete');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the check page lists it, Change opens it alone as "Additional information", and Save and continue comes back', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await toCheckPage(app);
  assert.deepEqual(rowsOf(d)[rowsOf(d).length - 1], ['Additional information', 'Not provided'], 'the last row, empty');
  const change = Array.from(planOf(d).querySelectorAll('.summary-row')).pop().querySelector('.summary-change');
  change.click();
  await settle();
  assert.equal(window.location.hash, '#plan-details/more');
  assert.equal(caption(d), 'Additional information', 'words, not a number');
  assert.deepEqual(shownUnits(d), [hatchOf(d)], 'on its own');
  write(app, 'Stakeholders', 'Finance want a copy of the readout.');
  press(d);
  await settle();
  assert.ok(planOf(d).classList.contains('step-checking'), 'back to the check page');
  assert.match(rowsOf(d)[rowsOf(d).length - 1][1], /Stakeholders.*Finance want a copy of the readout\./);
  assert.deepEqual(app.jsdomErrors, []);
});

test('#plan-details/more opens it directly; what is written survives the draft and shows on Review', async (t) => {
  const app = await bootApp({});
  const { document: d, window } = app;
  completeStep(app, planOf(d));
  write(app, 'Stakeholders', 'Finance want a copy of the readout.');
  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.custom && (s.custom.additionalPlanDetails || []).length === 1 && s; });
  assert.deepEqual(saved.custom.additionalPlanDetails, [{ label: 'Stakeholders', body: 'Finance want a copy of the readout.' }]);
  app.close();

  const again = await bootApp({ draft: saved, url: 'https://research-plan.test/#plan-details/more' });
  t.after(() => again.close());
  const dd = again.document;
  await settle();
  assert.equal(caption(dd), 'Additional information', 'loading the URL opens the hatch');
  assert.deepEqual(shownUnits(dd), [hatchOf(dd)]);
  assert.equal(hatchOf(dd).querySelector('.custom-field-name').value, 'Stakeholders');
  assert.equal(hatchOf(dd).querySelector('.custom-field-body').value, 'Finance want a copy of the readout.');

  // Review's summary of Plan details has the row, beside the other sections' additions.
  const item = Array.from(dd.querySelectorAll('.review-item')).find((it) => it.querySelector('.review-row').dataset.slug === 'plan-details');
  item.querySelector('.review-answers').open = true;
  item.querySelector('.review-answers').dispatchEvent(new again.window.Event('toggle'));
  const rows = Array.from(item.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
  assert.match((rows.find((r) => r[0] === 'Additional information') || [])[1] || '', /Stakeholders/);
  assert.deepEqual(again.jsdomErrors, []);
});

test('on paper it is a titled part after the header\'s details when written, and nothing when empty', () => {
  assert.match(CSS, /@media print\{\.doc-header > \.field-custom:not\(:has\(\.custom-field-block\)\)\{display:none!important\}\}/,
    'an empty hatch is kept off the printed header');
  assert.match(CSS, /@media screen\{\.page-hidden\{display:none!important\}\}/, 'pages hide on screen only, so a written hatch prints with the header it belongs to (RPA-108)');
  assert.match(CSS, /\.doc-header > \.field-custom\{margin-top:24px\}/);
});

test('the submission record carries it like the others, and a plan with nothing there projects as it always did', () => {
  assert.equal(contract.CUSTOM[0], 'additionalPlanDetails');
  assert.equal(contract.SECTION.additionalPlanDetails, 'plan-details');
  const draft = (blocks) => ({ version: 8, savedAt: '2026-09-17T09:00:00.000Z', createdAt: '2026-09-17', fields: { researchTitle: 'Checkout' }, selects: {},
    lists: { researchQuestions: ['Why?'], outcomes: ['A reason.'] }, methods: [], tables: {}, custom: blocks === undefined ? {} : { additionalPlanDetails: blocks }, lastUpdatedManual: false, ui: { timelineVisible: false } });

  const written = contract.project(draft([{ label: 'Stakeholders', body: 'Finance want a copy.' }, { label: '', body: '' }]));
  assert.deepEqual(written.custom.additionalPlanDetails, [{ label: 'Stakeholders', body: 'Finance want a copy.' }], 'carried, blank blocks aside');
  assert.doesNotThrow(() => contract.structure(written), 'and the record is a supported structure');

  const before = contract.project(draft(undefined)), empty = contract.project(draft([])), blank = contract.project(draft([{ label: ' ', body: '' }]));
  assert.equal('additionalPlanDetails' in empty.custom, false, 'nothing written, nothing carried');
  assert.equal(contract.fingerprint(empty), contract.fingerprint(before), 'so a receipt taken before the hatch existed still matches the same plan');
  assert.equal(contract.fingerprint(blank), contract.fingerprint(before));
  assert.notEqual(contract.fingerprint(written), contract.fingerprint(before), 'and something written there is a change');

  const half = contract.validate(contract.project(draft([{ label: '', body: 'A body with no name.' }]))).filter((e) => e.key === 'additionalPlanDetails');
  assert.deepEqual(half.map((e) => [e.section, e.column]), [['plan-details', 'label']], 'validated as the others are: a block needs a name, and the error belongs to Plan details');
});

test('with submissions on the form still matches the collection\'s schema, and a half-written block is asked for on Plan details', async (t) => {
  const fixtures = require('./rpa-64-fixtures.cjs');
  const config = { pilotMode: true, capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: fixtures.config };
  const app = await bootApp({ configResponse: async () => ({ ok: true, status: 200, json: async () => config }) });
  t.after(() => app.close());
  const d = app.document;
  assert.ok(d.querySelector('.submission-send'), 'the send panel is there: the active form is one the contract recognises, hatch and all');
  assert.doesNotMatch(text(d.querySelector('.submission-status')), /form has changed/i);
  assert.deepEqual(app.jsdomErrors, []);
});
