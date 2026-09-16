'use strict';

// RPA-59, part two: nothing scheduled before the plan existed.
//
// It warns rather than errors, and the reason is whether the reader can act.
// A date past the readout has two ways out — move the date, or move the
// readout — so part one raises it as an error. A date before the plan started
// has neither: the start date is computed and not editable. It is also
// sometimes simply right, because a plan written up weeks after the work began
// has real stages that predate the document. So it is stated, not enforced.
//
// And it only applies where the start date is the plan's own. RPA-76 falls
// back to savedAt for plans that predate it, which is the *last* save — a plan
// started in July and saved yesterday would otherwise get a floor of yesterday
// and report its entire real schedule as impossible.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue } = require('./app-harness');

function rows(document) {
  return Array.from(document.querySelectorAll('#stageTimeline-table tbody tr'));
}

function dateAt(document, row, col) {
  return rows(document)[row].querySelectorAll('input[type="date"]')[col];
}

function noteFor(input) {
  const control = input.closest('.date-control');
  const el = control.querySelector('.date-note');
  return { shown: el && !el.hidden, text: el ? el.textContent : '', control };
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

test('document creation does not restrict the stage start picker', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const start = dateAt(app.document, 1, 0);
  assert.equal(start.min, '', 'earlier research is allowed in the picker as well as typed input');
});

test('a date before the plan started is stated, not raised', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const cell = dateAt(document, 1, 0);
  setValue(window, cell, '2020-03-01');

  const note = noteFor(cell);
  assert.equal(note.shown, true);
  assert.match(note.text, /before this document was created on/);
  assert.match(note.text, /Earlier research work is allowed; this is only a note/);
  assert.equal(cell.value, '2020-03-01', 'the date is kept');

  // The quieter tier: no aria-invalid, and not the alert element part one uses.
  assert.equal(note.control.hasAttribute('aria-invalid'), false,
    'nothing here is invalid — the reader may have no way to change it');
  assert.equal(note.control.querySelector('.date-error').hidden, true);
});

test('the note goes when the date comes back inside', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const cell = dateAt(document, 1, 0);
  setValue(window, cell, '2020-03-01');
  assert.equal(noteFor(cell).shown, true);

  setValue(window, cell, today());
  assert.equal(noteFor(cell).shown, false);
});

test('a plan whose start date is a guess gets no floor at all', async (t) => {
  // The case that makes this dangerous rather than merely wrong. savedAt is
  // the last save, so a plan started in July and saved in September would get
  // a floor of September and flag every real stage before it.
  const app = await bootApp({
    draft: {
      version: 7,
      savedAt: '2026-09-01T09:30:00.000Z',
      fields: { background: 'Started long before this was saved' },
      lists: {},
      tables: {},
    },
  });
  t.after(() => app.close());
  const { document, window } = app;

  const cell = dateAt(document, 1, 0);
  assert.equal(cell.hasAttribute('min'), false, 'no floor, because we do not know one');

  setValue(window, cell, '2026-07-02');
  assert.equal(noteFor(cell).shown, false,
    'and a July stage is not reported against a September guess');
});

test('a plan that recorded its own start date does get a floor', async (t) => {
  // The other half of the same rule, so the test above cannot pass by the
  // floor simply never working.
  const app = await bootApp({
    draft: {
      version: 7,
      savedAt: '2026-09-01T09:30:00.000Z',
      createdAt: '2026-08-03',
      fields: { background: 'Recorded when it began' },
      lists: {},
      tables: {},
    },
  });
  t.after(() => app.close());
  const { document, window } = app;

  const cell = dateAt(document, 1, 0);
  assert.equal(cell.min, '', 'creation is an advisory note, not a picker constraint');

  setValue(window, cell, '2026-07-02');
  const note = noteFor(cell);
  assert.equal(note.shown, true);
  assert.match(note.text, /before this document was created on 3 August 2026/);
});

test('completion cannot precede its own start, even when both precede document creation', async (t) => {
  const app = await bootApp({
    draft: {
      version: 7,
      savedAt: '2026-09-01T09:30:00.000Z',
      createdAt: '2026-08-03',
      fields: {},
      lists: {},
      tables: {},
    },
  });
  t.after(() => app.close());
  const { document, window } = app;

  const start = dateAt(document, 1, 0);
  const end = dateAt(document, 1, 1);

  setValue(window, start, '2026-10-05');
  assert.equal(end.min, '2026-10-05');

  setValue(window, start, '2026-07-01');
  assert.equal(end.min, '2026-07-01', 'the stage start stays the minimum');
  assert.equal(noteFor(start).shown, true, 'and the start itself is noted');
});

test('the ceiling still errors while the floor only notes', async (t) => {
  // The two tiers are the point, so they are asserted together.
  const app = await bootApp({
    draft: {
      version: 7,
      savedAt: '2026-09-01T09:30:00.000Z',
      createdAt: '2026-08-03',
      fields: { researchReadout: '2026-12-11' },
      lists: {},
      tables: {},
    },
  });
  t.after(() => app.close());
  const { document, window } = app;

  const early = dateAt(document, 1, 0);
  setValue(window, early, '2026-07-01');
  const late = dateAt(document, 2, 0);
  setValue(window, late, '2027-02-01');

  const earlyControl = early.closest('.date-control');
  assert.equal(earlyControl.querySelector('.date-note').hidden, false, 'floor: noted');
  assert.equal(earlyControl.hasAttribute('aria-invalid'), false, 'floor: not invalid');

  const lateControl = late.closest('.date-control');
  assert.equal(lateControl.querySelector('.date-error').hidden, false, 'ceiling: raised');
  assert.equal(lateControl.getAttribute('aria-invalid'), 'true', 'ceiling: invalid');
});
