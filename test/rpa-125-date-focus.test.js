'use strict';

// RPA-125. Max reports two neighbouring segments of one date flickering
// between selected and not, on the first click after returning to the
// window, in Opera and then in Chrome. There is no deterministic trigger
// and no browser reproduction, so this is not a test of his bug.
//
// It is a test of the one mechanism in this code that can paint two
// segments as selected: the selection of a segment's text is deferred by a
// tick, because a browser places the caret from the click after the focus
// event and would undo an immediate select(). A deferred selection can
// therefore arrive after focus has moved on. Restoring focus on window
// activation and the click that follows are two focus events a tick apart,
// which is exactly that gap.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, waitFor } = require('./app-harness');

const tick = () => new Promise((r) => setTimeout(r, 5));
const selected = (input) => input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
async function dateSegments(app) {
  const { document: d } = app;
  // The control is built at render, so there is no step to walk to: walking
  // to one would move focus to its heading after these tests set it.
  await waitFor(() => d.querySelector('.date-control .date-day'));
  await tick();
  const control = d.querySelector('.date-control');
  const [day, month, year] = ['.date-day', '.date-month', '.date-year'].map((s) => control.querySelector(s));
  // Something to select: an empty segment has no selection to paint.
  day.value = '01'; month.value = '10'; year.value = '2026';
  return { day, month, year, d };
}

test('a selection that arrives after focus has moved is not painted', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { day, month, d } = await dateSegments(app);

  // Two focus events a tick apart: the window restoring focus to where it
  // was, then the click that lands somewhere else.
  day.focus();
  month.focus();
  await tick();

  assert.equal(d.activeElement, month, 'the segment clicked is the one in use');
  assert.equal(selected(month), true, 'and it is the one showing selected');
  assert.equal(selected(day), false, 'the one focus left behind is not');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the segment that keeps focus still gets its text selected', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { day, d } = await dateSegments(app);
  day.focus();
  assert.equal(selected(day), false, 'not immediately: a click would place the caret after this');
  await tick();
  assert.equal(d.activeElement, day);
  assert.equal(selected(day), true, 'a tick later, so the whole segment can be typed over');
});

test('a selection that arrives after focus has left the control paints nothing', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { day, d } = await dateSegments(app);
  const elsewhere = d.querySelector('[data-field="researchTitle"]');
  day.focus();
  elsewhere.focus();
  await tick();
  assert.equal(d.activeElement, elsewhere);
  assert.equal(selected(day), false, 'nothing is painted in a control nobody is in');
});

test('each of the three segments behaves the same way, in either direction', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { day, month, year, d } = await dateSegments(app);
  const elsewhere = d.querySelector('[data-field="researchTitle"]');
  for (const [from, to] of [[day, month], [month, year], [year, day], [year, month], [month, day]]) {
    // Start each pair outside the control with nothing selected. A browser
    // paints no selection in an input that is not focused; jsdom keeps the
    // range, so the previous pair would otherwise answer for this one.
    elsewhere.focus();
    await tick();
    [day, month, year].forEach((input) => input.setSelectionRange(0, 0));

    from.focus();
    to.focus();
    await tick();
    assert.equal(d.activeElement, to, 'focus is where it was put');
    assert.equal(selected(to), true, to.className + ' is selected');
    assert.equal(selected(from), false, from.className + ' is not');
  }
});
