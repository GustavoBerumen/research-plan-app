'use strict';

// Stage Timeline used to open as one empty row, so every researcher built the
// same five-stage schedule by hand. The stages are fixed — they are the Stage
// column's own options — and two of the dates are already known to the plan.
//
// Three things in the existing code made this more than a default:
//
//   * There was no record of when a plan was started. savedAt is the last
//     save; the Last updated field is re-stamped on every edit and editable by
//     hand. Neither answers "when did this begin".
//   * Draft restore could grow a table and not shrink one, so a deleted stage
//     came back on reload.
//   * The review step counts a field as answered if any control holds a value,
//     which would have made an untouched Execution report a timeline nobody
//     wrote — the same bug the select-at-first-option rule already fixed once.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const STAGES = ['Planning', 'Recruitment', 'Data Collection', 'Analysis', 'Reporting'];

function timeline(document) {
  const table = document.getElementById('stageTimeline-table');
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  return {
    table,
    rows,
    stages: rows.map((r) => r.querySelector('.ssel').value),
    dates: rows.map((r) => Array.from(r.querySelectorAll('input[type="date"]'), (d) => d.value)),
    addBtn: table.closest('.field').querySelector('.add-btn'),
  };
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

test('opens with the five stages, in order', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const tl = timeline(app.document);
  assert.equal(tl.rows.length, 5);
  assert.deepEqual(tl.stages, STAGES);
});

test('the stage names come from the template, not from app.js', async (t) => {
  // The point of deriving the rows from the column's own options. A renamed or
  // reordered stage has to flow through without touching code — otherwise the
  // list exists twice and the copies drift.
  const real = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
  const renamed = real.replace(
    /^(Stage Timeline \([^)]*\): Stage:select=)[^|]*/m,
    '$1Scoping,Fieldwork,Write-up '
  );
  assert.notEqual(renamed, real, 'the Stage column was not found to rewrite');

  const app = await bootApp({ textAssets: { 'research-plan-template.md': renamed } });
  t.after(() => app.close());

  const tl = timeline(app.document);
  assert.deepEqual(tl.stages, ['Scoping', 'Fieldwork', 'Write-up']);
  assert.equal(tl.rows.length, 3, 'one row per option, however many there are');

  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(source, /Data Collection/, 'app.js holds no copy of the stage list');
});

test('Planning starts when the plan started, and nothing else is filled in', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const tl = timeline(app.document);
  assert.equal(tl.dates[0][0], today(), 'Planning → Start Date');
  // Everything else is the researcher's to schedule.
  assert.deepEqual(tl.dates.flat().slice(1), ['', '', '', '', '', '', '', '', '']);
});

test('the last stage follows Research readout until somebody edits it', async (t) => {
  // The readout is a header field filled long after this table renders, so
  // writing it once at render would mean it was always empty and the feature
  // never fired.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  assert.equal(timeline(document).dates[4][1], '', 'nothing to copy yet');

  setValue(window, document.querySelector('[data-field="researchReadout"]'), '2026-12-11');
  assert.equal(timeline(document).dates[4][1], '2026-12-11', 'Reporting → Completion Date');

  // Still tracking, because nobody has touched that cell.
  setValue(window, document.querySelector('[data-field="researchReadout"]'), '2026-12-18');
  assert.equal(timeline(document).dates[4][1], '2026-12-18');

  // Once edited it is the researcher's, and a later readout change leaves it alone.
  const cell = timeline(document).rows[4].querySelectorAll('input[type="date"]')[1];
  setValue(window, cell, '2027-01-15');
  setValue(window, document.querySelector('[data-field="researchReadout"]'), '2026-12-25');
  assert.equal(timeline(document).dates[4][1], '2027-01-15',
    'an edited date is never overwritten by a default');
});

test('typing into a date segment counts as editing it', async (t) => {
  // A date is three visible segment inputs in front of one real input[type=date].
  // Clearing the mark on the segment alone would leave the date still flagged
  // as a default, and the next readout change would overwrite what was typed.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  // The second date control in the row: Completion Date, not Start Date.
  const cell = timeline(document).rows[4].querySelectorAll('.date-control')[1];
  const day = cell.querySelector('.date-segment');
  assert.ok(day, 'the segmented editor is there');
  day.value = '09';
  day.dispatchEvent(new window.Event('input', { bubbles: true }));

  setValue(window, document.querySelector('[data-field="researchReadout"]'), '2026-12-11');
  assert.equal(timeline(document).dates[4][1], '',
    'the cell was touched, so the default no longer applies to it');
});

test('a pre-filled timeline is not an answered field', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const stateOf = (name) => Array.from(document.querySelectorAll('.review-row'))
    .find((r) => r.querySelector('.review-name').textContent === name)
    .querySelector('.review-state').textContent;

  // An edit somewhere else, to force the summary to redraw. Without it this
  // reads the draw made during render — before the defaults existed — and
  // would report 0 whether the rule works or not.
  setValue(window, document.querySelector('[data-field="background"]'), 'Something written');
  await waitFor(() => /^1 of \d+ fields$/.test(stateOf('Context')),
    { message: 'the summary should redraw as the plan changes' });

  assert.match(stateOf('Execution'), /^0 of \d+ fields$/,
    'defaults the form supplied are not answers the researcher gave');
});

test('editing a stage makes it count', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const start = timeline(document).rows[1].querySelectorAll('input[type="date"]')[0];
  setValue(window, start, '2026-10-01');

  await waitFor(() => {
    const row = Array.from(document.querySelectorAll('.review-row'))
      .find((r) => r.querySelector('.review-name').textContent === 'Execution');
    return /^1 of \d+ fields$/.test(row.querySelector('.review-state').textContent);
  }, { message: 'a real edit should count, even in a pre-filled row' });
});

test('removed stages stay removed across a save and reload', async (t) => {
  // Restore could only grow a table. With one starting row that never showed;
  // with five it hands back every stage the researcher deleted.
  const app = await bootApp();
  const { document, window } = app;

  const tl = timeline(document);
  tl.rows[4].querySelector('.row-remove').click();
  tl.rows[3].querySelector('.row-remove').click();
  assert.equal(timeline(document).rows.length, 3);

  setValue(window, document.querySelector('[data-field="background"]'), 'Something');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.tables['stageTimeline-table'].length, 3);
  app.close();

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  assert.deepEqual(timeline(reopened.document).stages,
    ['Planning', 'Recruitment', 'Data Collection']);
});

test('a plan records when it was started, once', async (t) => {
  const app = await bootApp();
  const { document, window } = app;

  setValue(window, document.querySelector('[data-field="background"]'), 'First edit');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const first = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(first.createdAt, today());
  app.close();

  // Reopened on a later day, the start date is the one it was given.
  const older = Object.assign({}, first, { createdAt: '2026-07-01' });
  const reopened = await bootApp({ draft: older });
  t.after(() => reopened.close());
  setValue(reopened.window, reopened.document.querySelector('[data-field="goal"]'), 'Later edit');
  await new Promise((resolve) => setTimeout(resolve, 700));

  const again = JSON.parse(reopened.window.localStorage.getItem(DRAFT_KEY));
  assert.equal(again.createdAt, '2026-07-01', 'a later save must not re-stamp it');
});

test('a plan saved before this feature is not stamped with today', async (t) => {
  // The failure that would be worst: telling somebody their six-week-old plan
  // started this morning. savedAt is not the creation date, but it is a date
  // the plan demonstrably existed on, which is the most we can honestly claim.
  const app = await bootApp({
    draft: {
      version: 7,
      savedAt: '2026-07-14T09:30:00.000Z',
      fields: { background: 'An older plan' },
      lists: {},
      tables: {},
    },
  });
  t.after(() => app.close());

  assert.equal(timeline(app.document).dates[0][0], '2026-07-14');
});

test('the hint says the defaults are suggestions', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const hint = app.document.getElementById('stageTimeline-table')
    .closest('.field').querySelector('.field-hint-text').textContent;
  assert.match(hint, /suggested defaults/);
  assert.match(hint, /adjust or remove/);
});
