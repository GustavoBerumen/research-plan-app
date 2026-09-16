'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, toCheckPage, DRAFT_KEY } = require('./app-harness');
const f = require('./rpa-64-fixtures.cjs');
const W = require('../plan-workflow');
const contract = require('../submission-contract');
const text = n => n.textContent.replace(/\s+/g, ' ').trim();
function fixture(section = 'review') {
  const p = f.plan(); p.version = 9; p.ui.section = section;
  // Keep the first row separate from the final readout-mirroring row.
  p.tables['stageTimeline-table'].push(structuredClone(p.tables['stageTimeline-table'][0]));
  p.fields.emailAddress = 'author@example.com';
  p.signOff = W.createPlan({ id: 'manual-validation', at: '2026-09-15T18:00:00.000Z', authorRole: 'leadResearcher',
    parties: { leadResearcher: { email: 'author@example.com', displayName: 'AB' }, projectRequester: { email: 'reviewer@example.com', displayName: 'CD' } },
    tokens: { leadResearcher: 'manual-author', projectRequester: 'manual-reviewer' } }).plan;
  return p;
}
const press = (d, label) => {
  const button = Array.from(d.querySelectorAll('.sign-off-actions button')).find(b => text(b) === label);
  assert.ok(button, label + ' is present'); button.click();
};
const configResponse = () => Promise.resolve({ ok: true, json: async () => ({ pilotMode: true, capabilities: { submissions: false, feedback: false, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false } }) });
async function boot(t, draft) {
  const app = await bootApp({ draft, configResponse }); t.after(() => app.close());
  await waitFor(() => !/Not started/i.test(text(app.document.querySelector('.sign-off-head .tag'))));
  return app;
}

test('local Save and continue rejects an invalid Other count, focuses that input, and still autosaves it', async t => {
  const p = fixture('methodology'); p.methods[0].sampleSize = { v: '__other__', o: 'asdf' };
  const app = await boot(t, p), d = app.document;
  const step = d.querySelector('[data-step-slug="methodology"]');
  const other = step.querySelector('.radio-other-row input');
  toCheckPage(step);
  const link = Array.from(step.querySelectorAll('.error-summary-link')).find(a => /valid sample size/.test(a.textContent));
  assert.ok(link); link.click(); assert.equal(d.activeElement, other);
  setValue(app.window, other, 'still invalid');
  await waitFor(() => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).studies[0].sampleSize.o === 'still invalid');
  assert.equal(step.classList.contains('step-checking'), false);
  setValue(app.window, other, '5–8'); toCheckPage(step);
  assert.equal(step.classList.contains('step-checking'), true);
  assert.equal(app.evaluationRequests.length, 0);
});

test('each retained schedule row needs both dates before local Execution can complete', async t => {
  const p = fixture('execution'); p.tables['stageTimeline-table'][0][2] = { t: 'date', v: '' };
  const app = await boot(t, p), d = app.document;
  const step = d.querySelector('[data-step-slug="execution"]');
  toCheckPage(step);
  const link = Array.from(step.querySelectorAll('.error-summary-link')).find(a => /completion date in schedule row 1/.test(a.textContent));
  assert.ok(link, 'an exact correction is offered without enabling submissions');
  link.click();
  assert.ok(d.querySelector('#stageTimeline-table tbody tr').children[2].contains(d.activeElement));
  const end = d.querySelector('#stageTimeline-table tbody tr').children[2].querySelector('input[type=date]');
  setValue(app.window, end, '2026-10-10'); toCheckPage(step);
  assert.equal(step.classList.contains('step-checking'), true);
});

for (const problem of ['sample', 'schedule']) test('local author cannot sign a restored draft with invalid ' + problem, async t => {
  const p = fixture();
  if (problem === 'sample') p.methods[0].sampleSize = { v: '__other__', o: 'asdf' };
  else p.tables['stageTimeline-table'][0][2] = { t: 'date', v: '' };
  const app = await boot(t, p), d = app.document;
  press(d, 'Sign for local review');
  assert.match(text(d.querySelector('.sign-off .error-summary')), problem === 'sample' ? /valid sample size/ : /completion date/);
  const saved = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.signOff.status, 'draft');
  assert.equal(saved.signOff.signatures.leadResearcher, null);
});

test('local reviewer cannot approve an incomplete current schedule; a complete plan still signs twice', async t => {
  const p = fixture();
  const app = await boot(t, p), d = app.document;
  press(d, 'Sign for local review');
  await waitFor(() => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).signOff.status === 'awaitingCounterparty');
  const waiting = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
  const bad = await boot(t, structuredClone(waiting));
  await waitFor(() => Array.from(bad.document.querySelectorAll('.sign-off-actions button')).some(b => text(b) === 'Sign'));
  // A pending edit or older client can leave stale action controls on screen.
  // The final handler must check the current data, not just its earlier draw.
  const end = bad.document.querySelector('#stageTimeline-table tbody tr').children[2].querySelector('input[type=date]');
  setValue(bad.window, end, '');
  press(bad.document, 'Sign');
  assert.match(text(bad.document.querySelector('.sign-off .error-summary')), /completion date/);
  assert.equal(JSON.parse(bad.window.localStorage.getItem(DRAFT_KEY)).signOff.status, 'awaitingCounterparty');
  press(d, 'Sign');
  await waitFor(() => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).signOff.status === 'approved');
});

test('research before document creation is allowed; stage ordering and readout remain enforced', async t => {
  const p = fixture('execution'); p.createdAt = '2026-09-15'; p.fields.researchReadout = '2026-09-01';
  const row = p.tables['stageTimeline-table'][0]; row[1] = { t: 'date', v: '2026-08-25' }; row[2] = { t: 'date', v: '2026-09-01' };
  p.tables['stageTimeline-table'].pop();
  assert.deepEqual(contract.validate(contract.project(p)), []);
  const app = await boot(t, p), d = app.document;
  const dates = d.querySelectorAll('#stageTimeline-table tbody input[type=date]');
  assert.equal(dates[0].min, ''); assert.equal(dates[0].max, '2026-09-01');
  assert.equal(dates[1].min, '2026-08-25'); assert.equal(dates[1].max, '2026-09-01');
  assert.match(text(dates[0].closest('.date-control').querySelector('.date-note')), /Earlier research work is allowed/);
  row[2].v = '2026-09-02'; assert.ok(contract.validate(contract.project(p)).some(e => e.code === 'bounds'));
  row[2].v = '2026-08-24'; assert.ok(contract.validate(contract.project(p)).some(e => e.code === 'range'));
});

test('new initials are uppercased, dated and saved, while an existing dated signature is preserved', async t => {
  const app = await boot(t, fixture()), d = app.document;
  const input = d.querySelector('[data-field="signOffResearcher"]');
  setValue(app.window, input, 'as');
  input.dispatchEvent(new app.window.Event('blur'));
  assert.match(input.value, /^AS — \d{2}\/\d{2}\/\d{4}$/);
  await waitFor(() => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).fields.signOffResearcher === input.value);
  setValue(app.window, input, 'as — 14/09/2026');
  input.dispatchEvent(new app.window.Event('blur'));
  assert.equal(input.value, 'as — 14/09/2026', 'historical signatures are not silently reformatted or re-dated');
});
