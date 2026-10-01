'use strict';

// RPA-144, found reviewing it on 18 September 2026. Moving the project
// decision earlier moves a research readout that is now a page away, and
// says so. But the move was made by setting the value, which tells nobody:
// the Stage timeline's ceiling kept the readout it had been given last, so
// the stage calendars went on offering dates past the readout that now
// stands — four months of them in the case found. A date the form moves is
// a date that changed, and the readout now says so the way a typed one does.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = () => new Promise((r) => setTimeout(r, 200));
const decisionOf = (d) => d.querySelector('[data-field="projectDecision"]');
const readoutOf = (d) => d.querySelector('[data-field="researchReadout"]');
const stages = (d) => Array.from(d.querySelectorAll('#stageTimeline-table tbody input[type="date"]'));
const ceilings = (d) => Array.from(new Set(stages(d).map((i) => i.getAttribute('max'))));
const movedNote = (d) => decisionOf(d).closest('.mf').querySelector('.date-moved-note');
const errorOf = (input) => input.closest('.date-control').querySelector('.date-error');

test('a readout moved by the clamp carries the Stage timeline ceiling with it', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;

  setValue(window, decisionOf(d), '2027-03-31');
  setValue(window, readoutOf(d), '2027-03-20');
  await settle();
  assert.deepEqual(ceilings(d), ['2027-03-20'], 'the ceiling follows a readout the person typed');

  // The decision moves earlier, so the readout is moved with it, a page away.
  setValue(window, decisionOf(d), '2026-11-10');
  await settle();
  assert.equal(readoutOf(d).value, '2026-11-10', 'the readout was moved');
  assert.deepEqual(ceilings(d), ['2026-11-10'],
    'and the stage calendars stop at the readout that now stands, not the one it replaced');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the note about the move survives the telling, and says it once', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;

  setValue(window, decisionOf(d), '2027-03-31');
  setValue(window, readoutOf(d), '2027-03-20');
  setValue(window, decisionOf(d), '2026-11-10');
  await settle();
  const note = movedNote(d);
  assert.equal(note.hidden, false, 'the note is shown');
  assert.equal(text(note), 'Research readout was after this date, so it has been moved to 10 November 2026. You can change it on the next page.');
  assert.equal(decisionOf(d).closest('.mf').querySelectorAll('.date-moved-note').length, 1, 'one note, not two');

  // A decision that moves later moves nothing, so the note goes.
  setValue(window, decisionOf(d), '2027-01-05');
  await settle();
  assert.equal(movedNote(d).hidden, true, 'nothing was moved, so nothing is said');
  assert.equal(readoutOf(d).value, '2026-11-10', 'and the readout stays where the person can see it');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a stage already past the moved readout is flagged at once, without waiting to be touched', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;

  setValue(window, decisionOf(d), '2027-03-31');
  setValue(window, readoutOf(d), '2027-03-20');
  const stage = stages(d)[0];
  setValue(window, stage, '2027-02-01');
  await settle();
  assert.equal(errorOf(stage).hidden, true, 'within the readout, so nothing is said');

  setValue(window, decisionOf(d), '2026-11-10');
  await settle();
  assert.equal(errorOf(stage).hidden, false, 'the readout moved under it, so the stage is now too late');
  assert.match(text(errorOf(stage)), /after the research readout on 10 November 2026/);
  assert.equal(stage.value, '2027-02-01', 'and the date the researcher entered is kept');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the buffer warning judges the readout that stands, not the one that was replaced', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;

  setValue(window, decisionOf(d), '2027-03-31');
  setValue(window, readoutOf(d), '2027-03-01');
  await settle();
  const warning = readoutOf(d).closest('.mf').querySelector('.field-warning');
  assert.equal(warning.hidden, true, 'a month of buffer, so no warning');

  // Clamped, the two dates are the same day: no buffer at all.
  setValue(window, decisionOf(d), '2027-02-10');
  await settle();
  assert.equal(readoutOf(d).value, '2027-02-10');
  assert.equal(warning.hidden, false, 'the readout now lands on the decision, so the warning stands');
  assert.equal(text(warning), 'Allow a one-week buffer before the decision date.');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the draft keeps the moved readout, and restores with the ceiling already right', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, decisionOf(d), '2027-03-31');
  setValue(window, readoutOf(d), '2027-03-20');
  setValue(window, decisionOf(d), '2026-11-10');
  const saved = await waitFor(() => {
    const draft = JSON.parse(window.localStorage.getItem('research-plan-app:draft') || 'null');
    return draft && draft.fields.researchReadout === '2026-11-10' && draft;
  });
  assert.equal(saved.fields.projectDecision, '2026-11-10');

  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  assert.equal(readoutOf(again.document).value, '2026-11-10');
  assert.deepEqual(ceilings(again.document), ['2026-11-10'], 'restored with the ceiling the plan asks for');
  assert.deepEqual(again.jsdomErrors, []);
});
