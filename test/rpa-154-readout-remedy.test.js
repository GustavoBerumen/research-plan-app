'use strict';

// RPA-154. A stage dated after the research readout is kept and flagged,
// and the flag offers two ways out: move the stage, or change the readout.
// The second was words; it is a link now, to Plan details on that question,
// and Back or Save and continue from there comes back to the stage. And the
// calendar follows the date it is opened on: with max= still set to the
// readout, Chrome opened on the readout's month, so the calendar said
// October 2020 while the date said September 2026.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const settle = () => new Promise((r) => setTimeout(r, 220));
const dateAt = (d, row, col) => d.querySelectorAll('#stageTimeline-table tbody tr')[row].querySelectorAll('input[type="date"]')[col];
const errorOf = (input) => input.closest('.date-control').querySelector('.date-error');
const dayOf = (input) => input.closest('.date-control').querySelector('.date-day');
const readoutOf = (d) => d.querySelector('[data-field="researchReadout"]');
// Shown on the page: no hidden ancestor, and not on another page of the section (RPA-108 hides those by class).
const visible = (n) => { for (let e = n; e; e = e.parentElement) if (e.hidden || e.classList.contains('page-hidden')) return false; return true; };

async function onTimeline(app) {
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  // Plan details is left on its first page, so the link has a page to turn to.
  window.location.hash = '#plan-details';
  await waitFor(() => stepOf(d, 'plan-details').hidden === false);
  window.location.hash = '#execution';
  await waitFor(() => stepOf(d, 'execution').hidden === false);
  await settle();
  return stepOf(d, 'execution');
}

test('a date past the readout is flagged with a link, and the calendar follows the date rather than the readout', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  const cell = dateAt(d, 0, 0);
  setValue(window, cell, '2026-09-17');
  setValue(window, readoutOf(d), '2020-10-17');

  const error = errorOf(cell);
  assert.equal(error.hidden, false);
  assert.equal(text(error), 'This is after the research readout on 17 October 2020. Move it to 17 October 2020 or earlier, or change the readout date.');
  const link = error.querySelector('a.date-error-link');
  assert.equal(text(link), 'change the readout date', 'the second way out is a link');
  assert.equal(cell.value, '2026-09-17', 'the date is kept');
  assert.equal(dayOf(cell).validationMessage, text(error), 'the segment carries the whole sentence as its validity message');
  assert.equal(cell.hasAttribute('max'), false, 'no max= on a date already past the readout, so the calendar opens on September 2026, the date shown');

  // A stage within the readout keeps the ceiling on its calendar.
  const other = dateAt(d, 1, 0);
  setValue(window, other, '2020-10-01');
  assert.equal(other.max, '2020-10-17');
  assert.equal(errorOf(other).hidden, true);

  // Brought back within it, the max returns and the flag goes.
  setValue(window, cell, '2020-10-10');
  assert.equal(cell.max, '2020-10-17');
  assert.equal(errorOf(cell).hidden, true);

  // A calendar pick past the readout is flagged like a typed one: the
  // calendar has no max= to stop it, and the rule still holds.
  setValue(window, cell, '2020-11-01');
  assert.equal(errorOf(cell).hidden, false);
  assert.equal(cell.hasAttribute('max'), false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a restored plan with a stage past its readout is flagged on load, with the link and without the max', async (t) => {
  const app = await bootApp({ draft: { version: 10, fields: { emailAddress: 'name@example.com', researchReadout: '2020-10-17', projectDecision: '2020-10-23' },
    tables: { 'stageTimeline-table': [[{ t: 'select', v: 'Planning', o: '' }, { t: 'date', v: '2026-09-17' }, { t: 'date', v: '2026-09-30' }, { t: 'text', v: '' }]] } } });
  t.after(() => app.close());
  const d = app.document;
  const start = dateAt(d, 0, 0), end = dateAt(d, 0, 1);
  assert.equal(start.value, '2026-09-17', 'restored, not rewritten');
  for (const cell of [start, end]) {
    assert.equal(errorOf(cell).hidden, false);
    assert.ok(errorOf(cell).querySelector('a.date-error-link'));
    assert.equal(cell.hasAttribute('max'), false);
  }
  assert.deepEqual(app.jsdomErrors, []);
});

test('the link opens Plan details on the readout question with focus in its date; Back returns to the stage date, kept', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  const execution = await onTimeline(app);
  const cell = dateAt(d, 0, 0);
  setValue(window, cell, '2026-09-17');
  setValue(window, readoutOf(d), '2020-10-17');
  const before = window.location.hash;
  assert.ok(visible(cell), 'the flagged date is on the page');

  errorOf(cell).querySelector('a.date-error-link').click();
  const header = stepOf(d, 'plan-details');
  assert.equal(header.hidden, false, 'Plan details is shown');
  assert.equal(execution.hidden, true);
  assert.ok(visible(readoutOf(d).closest('.mf')), 'on the page with the readout');
  assert.equal(visible(d.querySelector('[data-field="emailAddress"]')), false, 'not on the page it was left on');
  assert.equal(d.activeElement, dayOf(readoutOf(d)), 'with focus in the readout date');
  assert.match(window.location.hash, /^#plan-details/);

  header.querySelector('.step-back').click();
  assert.equal(execution.hidden, false, 'Back returns to the timeline');
  assert.equal(header.hidden, true);
  assert.ok(visible(cell), 'on the page with the stage');
  assert.equal(cell.value, '2026-09-17', 'the stage date entered is kept');
  assert.equal(errorOf(cell).hidden, false, 'nothing changed, so it is still flagged');
  assert.equal(d.activeElement, dayOf(cell), 'focus is back in the date that was flagged');
  assert.equal(window.location.hash, before);

  // The return lasts one visit: leave Plan details another way and come
  // back, and Back is what it always was, not a way to the timeline.
  errorOf(cell).querySelector('a.date-error-link').click();
  header.querySelector('.step-all').click();
  assert.equal(steps(d)[0].hidden, false, 'All sections still goes to the task list');
  window.location.hash = '#plan-details';
  await waitFor(() => header.hidden === false);
  header.querySelector('.step-back').click();
  assert.equal(execution.hidden, true, 'without the link, Back on Plan details does not go to the timeline');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the readout changed and saved, the person is back on the stage and the flag is gone', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  const execution = await onTimeline(app);
  const cell = dateAt(d, 0, 0);
  setValue(window, cell, '2026-09-17');
  setValue(window, readoutOf(d), '2020-10-17');
  errorOf(cell).querySelector('a.date-error-link').click();
  const header = stepOf(d, 'plan-details');
  assert.equal(header.hidden, false);

  setValue(window, d.querySelector('[data-field="projectDecision"]'), '2026-12-18');
  setValue(window, readoutOf(d), '2026-12-11');
  header.querySelector('.step-continue').click();
  await settle();
  assert.equal(execution.hidden, false, 'Save and continue returns to the timeline');
  assert.equal(header.hidden, true);
  assert.ok(visible(cell));
  assert.equal(cell.value, '2026-09-17');
  assert.equal(errorOf(cell).hidden, true, 'within the new readout, so no longer flagged');
  assert.equal(cell.max, '2026-12-11', 'and the calendar is capped again');
  assert.equal(d.activeElement, dayOf(cell));
  assert.deepEqual(app.jsdomErrors, []);
});

test('Change from Review still returns to Review', async (t) => {
  // The return the link sets is its own; the one Review sets is untouched.
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5, 6]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  window.location.hash = '#review';
  const review = stepOf(d, 'review');
  await waitFor(() => review.hidden === false);
  await settle();
  const change = review.querySelector('.review-row[data-slug="plan-details"] .review-change, .review-row[data-slug="plan-details"] a, .review-row[data-slug="plan-details"] button');
  assert.ok(change, 'a Change control for Plan details');
  change.click();
  const header = stepOf(d, 'plan-details');
  assert.equal(header.hidden, false);
  header.querySelector('.step-continue').click();
  await settle();
  assert.equal(review.hidden, false, 'back on Review');
  assert.deepEqual(app.jsdomErrors, []);
});
