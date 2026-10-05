'use strict';

// RPA-160, found cataloguing the app's empty states on 2 October 2026.
// "Is there any existing research or documentation to review?" is optional
// and starts empty, but its summary row never said so. A file cell's empty
// label is text in the cell, not a placeholder in an input (app.js:128,
// deliberately — removing it would leave a bare button), so the row always
// had something to report: the check page and Review read "No file chosen"
// in ordinary ink, where every other empty answer reads "Not provided" in
// grey. An untouched optional table looked answered.
//
// A file cell with nothing attached now contributes its words but not an
// answer: a row with nothing else in it is no answer at all, while a row
// with a name still reads "Priya's notes · No file chosen" as it did.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep, toCheckPage } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const settle = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const rowFor = (step, key) => Array.from(step.querySelectorAll('.check-answers .summary-row'))
  .find((r) => text(r.querySelector('.summary-key')) === key);
const valueOf = (step, key) => {
  const row = rowFor(step, key);
  return row && { words: text(row.querySelector('.summary-value')), empty: row.querySelector('.summary-value').classList.contains('summary-value-empty') };
};
const knowledgeTable = (d) => stepOf(d, 'execution').querySelector('#previousKnowledge-table');

const UPLOADS_OFF = { configResponse: async () => ({ ok: true, status: 200, json: async () => ({ pilotMode: true,
  capabilities: { submissions: false, signOff: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false } }) }) };

// Execution opens only once the sections before it are complete.
async function executionCheckPage(options) {
  const app = await bootApp(options || {});
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  window.location.hash = '#execution';
  const step = stepOf(d, 'execution');
  await waitFor(() => step.hidden === false);
  // completeStep answers the step's required questions only — the Planned
  // Schedule's dates — and leaves Previous Knowledge, which is optional,
  // exactly as a person first meets it. That is the subject of this ticket.
  completeStep(app, step);
  await settle();
  return { app, step };
}

test('an untouched Previous Knowledge table is summarised like every other empty answer', async (t) => {
  const { app, step } = await executionCheckPage();
  t.after(() => app.close());

  // Nothing has been typed and no file attached: the row as a person first meets it.
  const cells = Array.from(knowledgeTable(app.document).querySelectorAll('tbody input[type="text"], tbody textarea'));
  assert.deepEqual(cells.map((c) => c.value), cells.map(() => ''), 'the table starts empty');
  assert.equal(text(knowledgeTable(app.document).querySelector('.file-name')), 'No file chosen', 'the cell still says so, which is the point of it');

  toCheckPage(step);
  await settle();
  assert.deepEqual(valueOf(step, 'Previous Knowledge'), { words: 'Not provided', empty: true },
    'and the summary says the question was not answered, in the grey every other empty row uses');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the words in the cell are untouched: this is a change to the summary, not to the table', async (t) => {
  const { app, step } = await executionCheckPage();
  t.after(() => app.close());
  const cell = knowledgeTable(app.document).querySelector('.file-cell');
  assert.equal(cell.dataset.fileName, 'No file chosen');
  assert.equal(text(cell.querySelector('.file-name')), 'No file chosen');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a row with a name still reports what is there, file label and all', async (t) => {
  const { app, step } = await executionCheckPage();
  t.after(() => app.close());
  const name = knowledgeTable(app.document).querySelector('tbody input[type="text"], tbody textarea');
  setValue(app.window, name, 'Last year’s delivery study');
  await settle();

  toCheckPage(step);
  await settle();
  assert.deepEqual(valueOf(step, 'Previous Knowledge'),
    { words: 'Last year’s delivery study · No file chosen', empty: false },
    'a part-filled row is an answer, and reads as it always did');
  assert.deepEqual(app.jsdomErrors, []);
});

test('with uploads switched off the cell keeps its own words, and an untouched row is still not an answer', async (t) => {
  const { app, step } = await executionCheckPage(UPLOADS_OFF);
  t.after(() => app.close());
  await settle(300);
  assert.equal(text(knowledgeTable(app.document).querySelector('.file-name')), 'No saved file reference',
    'the uploads-off wording in the cell is unaffected');

  toCheckPage(step);
  await settle();
  assert.deepEqual(valueOf(step, 'Previous Knowledge'), { words: 'Not provided', empty: true });
  assert.deepEqual(app.jsdomErrors, []);
});

test('a file and no name is still an answer: the row reports the file', async (t) => {
  // A saved file reference, as a restored backup carries one (app.js:8072).
  const { app, step } = await executionCheckPage({ draft: {
    version: 11,
    fields: { emailAddress: 'priya@example.com' },
    tables: { 'previousKnowledge-table': [[{ t: 'text', v: '' }, { t: 'file', v: 'ref-1', n: 'delivery-study.pdf' }]] },
  } });
  t.after(() => app.close());
  const cell = knowledgeTable(app.document).querySelector('.file-cell');
  assert.equal(cell.dataset.fileName, 'delivery-study.pdf', 'the reference was restored');

  toCheckPage(step);
  await settle();
  assert.deepEqual(valueOf(step, 'Previous Knowledge'), { words: 'delivery-study.pdf', empty: false },
    'the file alone answers the question, with no name beside it');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the Planned Schedule is judged as it always was: its own table is not caught by this', async (t) => {
  const { app, step } = await executionCheckPage();
  t.after(() => app.close());
  toCheckPage(step);
  await settle();
  const schedule = valueOf(step, 'Planned Schedule');
  assert.ok(schedule, 'the schedule still has a row of its own');
  assert.equal(schedule.empty, false, 'a stage chosen by default is an answer, unchanged by this ticket');
  assert.deepEqual(app.jsdomErrors, []);
});
