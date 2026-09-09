'use strict';

// RPA-59, part one: no Stage Timeline date may fall after Research readout.
// That date is when findings are shared, so work scheduled past it cannot
// belong to the plan it sits in.
//
// The floor — nothing before the plan started — is part two. It needs the
// createdAt RPA-76 persisted; this half needs no new state at all.
//
// The interesting rule is what happens when the readout moves *earlier*, which
// pushes rows out of range retroactively. Since RPA-76 a plan holds two kinds
// of cell, and they are not treated alike: one the form is still managing
// follows the readout down silently, because nobody chose that date; one
// somebody has edited keeps its value and is flagged, because that is the only
// case where a person made a decision worth protecting.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, DRAFT_KEY } = require('./app-harness');

function rows(document) {
  return Array.from(document.querySelectorAll('#stageTimeline-table tbody tr'));
}

function dateAt(document, row, col) {
  return rows(document)[row].querySelectorAll('input[type="date"]')[col];
}

function errorFor(input) {
  const control = input.closest('.date-control');
  const el = control.querySelector('.date-error');
  return { shown: el && !el.hidden, text: el ? el.textContent : '', control };
}

function setReadout(app, value) {
  setValue(app.window, app.document.querySelector('[data-field="researchReadout"]'), value);
}

test('every timeline date is capped by the readout', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  setReadout(app, '2026-12-11');

  const inputs = document.querySelectorAll('#stageTimeline-table tbody input[type="date"]');
  assert.ok(inputs.length >= 10);
  // Both columns, every row — a stage that starts after the readout is as
  // wrong as one that ends after it.
  inputs.forEach((input) => assert.equal(input.max, '2026-12-11'));
});

test('the cap follows the readout, and lifts when it is cleared', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  setReadout(app, '2026-12-11');
  assert.equal(dateAt(document, 0, 0).max, '2026-12-11');

  setReadout(app, '2027-03-02');
  assert.equal(dateAt(document, 0, 0).max, '2027-03-02');

  setReadout(app, '');
  assert.equal(dateAt(document, 0, 0).hasAttribute('max'), false,
    'no readout means no ceiling, rather than a ceiling of nothing');
});

test('a date typed past the readout is flagged, and says what to do', async (t) => {
  // max= only constrains the native picker. Typed and pasted values never go
  // through it, which is why the rule cannot live in the attribute alone.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2026-12-11');
  const cell = dateAt(document, 1, 1);
  setValue(window, cell, '2027-01-20');

  const error = errorFor(cell);
  assert.equal(error.shown, true);
  assert.match(error.text, /after the research readout on 11 December 2026/);
  assert.match(error.text, /or change the readout date/,
    'it names the boundary and both ways out, not a generic "invalid"');
  assert.equal(error.control.getAttribute('aria-invalid'), 'true');
  assert.equal(cell.value, '2027-01-20', 'and the date the researcher typed is kept');
});

test('the flag clears when the date is brought back in range', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2026-12-11');
  const cell = dateAt(document, 1, 1);
  setValue(window, cell, '2027-01-20');
  assert.equal(errorFor(cell).shown, true);

  setValue(window, cell, '2026-12-01');
  const error = errorFor(cell);
  assert.equal(error.shown, false);
  assert.equal(error.control.hasAttribute('aria-invalid'), false);
});

test('the flag clears when the readout moves out to meet the date', async (t) => {
  // The other way back into range, and the one that needs this code: nothing
  // happens to the cell at all, so the date control never clears its own
  // error the way it does when somebody retypes a valid date. Without an
  // explicit clear the warning outlives the problem, and the plan shows a
  // schedule flagged as impossible when it no longer is.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2026-12-11');
  const cell = dateAt(document, 1, 1);
  setValue(window, cell, '2027-01-20');
  assert.equal(errorFor(cell).shown, true, 'out of range to begin with');

  // The readout moves past it. The cell is untouched.
  setReadout(app, '2027-03-02');

  assert.equal(cell.value, '2027-01-20', 'their date is unchanged');
  const error = errorFor(cell);
  assert.equal(error.shown, false, 'and no longer flagged');
  assert.equal(error.control.hasAttribute('aria-invalid'), false);
});

test('the mirrored last row keeps up, and is never flagged for it', async (t) => {
  // RPA-76's mirror moves this cell before the ceiling checks it, so it can
  // never be out of range. Worth pinning because the first version of the
  // ceiling had a branch to move it — which was doing nothing here, and doing
  // something wrong elsewhere.
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  setReadout(app, '2027-03-02');
  const last = dateAt(document, rows(document).length - 1, 1);
  assert.equal(last.value, '2027-03-02', 'mirrored, as RPA-76 left it');

  setReadout(app, '2026-12-11');
  assert.equal(last.value, '2026-12-11', 'follows the readout down');
  assert.equal(errorFor(last).shown, false, 'and says nothing, because nothing was lost');
});

test('a readout before the plan started is reported, not papered over', async (t) => {
  // The first row's start date is when the plan began. A readout set earlier
  // than that is a real contradiction, and the earlier version resolved it by
  // rewriting the start date — quietly claiming the plan began on a day it did
  // not. Keeping the date and saying so is the more useful answer.
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const start = dateAt(document, 0, 0);
  const planStarted = start.value;
  assert.match(planStarted, /^\d{4}-\d{2}-\d{2}$/, 'the plan records when it began');

  setReadout(app, '2026-01-15');

  assert.equal(start.value, planStarted, 'the plan still says when it started');
  const error = errorFor(start);
  assert.equal(error.shown, true);
  assert.match(error.text, /after the research readout on 15 January 2026/);
});

test('moving the readout earlier keeps a date somebody chose, and flags it', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2027-03-02');
  const cell = dateAt(document, 2, 1);
  setValue(window, cell, '2027-02-10');
  assert.equal(errorFor(cell).shown, false, 'in range when it was typed');

  // The readout drops below a date the researcher scheduled.
  setReadout(app, '2026-12-11');

  assert.equal(cell.value, '2027-02-10',
    'the schedule they may have negotiated is not silently rewritten');
  const error = errorFor(cell);
  assert.equal(error.shown, true);
  assert.match(error.text, /after the research readout on 11 December 2026/);
});

test('a row added later is capped too', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2026-12-11');
  document.getElementById('stageTimeline-table').closest('.field')
    .querySelector('.add-btn').click();

  const added = rows(document).length - 1;
  const cell = dateAt(document, added, 0);
  assert.equal(cell.max, '2026-12-11', 'the cap reaches rows that did not exist at boot');

  setValue(window, cell, '2027-05-01');
  assert.equal(errorFor(cell).shown, true);
});

test('a restored plan is re-checked rather than trusted', async (t) => {
  // A plan can be saved in range and reopened out of it, because the readout
  // can move in a session that never touched the timeline.
  const app = await bootApp();
  const { document, window } = app;

  setReadout(app, '2027-03-02');
  const cell = dateAt(document, 2, 1);
  setValue(window, cell, '2027-02-10');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  app.close();

  // The readout moves in the saved plan without the timeline being touched.
  saved.fields.researchReadout = '2026-12-11';

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  const restored = dateAt(reopened.document, 2, 1);
  assert.equal(restored.value, '2027-02-10', 'their date survives the reload');
  assert.equal(errorFor(restored).shown, true, 'and is flagged on arrival');
});

test('the row-level start-before-completion rule still holds', async (t) => {
  // The ceiling is a second constraint on the same inputs, not a replacement.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  setReadout(app, '2026-12-11');
  const start = dateAt(document, 1, 0);
  const end = dateAt(document, 1, 1);
  setValue(window, start, '2026-10-05');
  setValue(window, end, '2026-09-01');

  assert.equal(end.value, '2026-10-05', 'still clamped up to the start date');
  assert.equal(end.min, '2026-10-05');
  assert.equal(end.max, '2026-12-11', 'and still capped by the readout');
});
