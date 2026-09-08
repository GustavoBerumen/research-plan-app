'use strict';

// RPA-55's verdict on Last updated was *move*: a computed value should read as
// a dateline rather than an editable control, because a box invites an answer
// to a question nobody is being asked. The audit recorded that as done for
// months. It was not — the dateline existed in the RPA-54 prototype and never
// shipped, and the app kept rendering a date input in the header corner.
//
// It stays editable, because Gus asked for that explicitly the day before this
// was built, and the manual-override behaviour tested in
// rpa-55-last-updated-stamp.test.js depends on it. So the sentence itself is
// the control: activating it swaps in the date editor in place. There is no
// separate "Change" link — that was tried in this slot and rejected as clutter.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor } = require('./app-harness');

function dateline(document) {
  const wrap = document.querySelector('.dateline');
  assert.ok(wrap, 'the header renders a dateline');
  return {
    wrap,
    text: wrap.querySelector('.dateline-value'),
    control: wrap.querySelector('.date-control'),
    input: wrap.querySelector('[data-field="lastUpdated"]'),
  };
}

function todayIso() {
  const now = new Date();
  return now.getFullYear()
    + '-' + String(now.getMonth() + 1).padStart(2, '0')
    + '-' + String(now.getDate()).padStart(2, '0');
}

test('reads as a sentence, with the control put away', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const dl = dateline(document);
  assert.equal(dl.control.hidden, true, 'no date box is offered');
  assert.equal(dl.text.hidden, false);
  assert.equal(dl.input.value, todayIso(), 'stamped with today');

  // Spelled out, not the DD-MMM-YYYY the segmented editor shows.
  assert.match(dl.text.textContent, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
});

test('the sentence is the control, and says so to a screen reader', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const dl = dateline(app.document);

  // A button, not a bare span: it has to be reachable by keyboard, and there
  // is no separate Change link to reach instead.
  assert.equal(dl.text.tagName, 'BUTTON');
  assert.equal(dl.text.getAttribute('type'), 'button');
  assert.match(dl.text.getAttribute('aria-label'), /^Last updated .+, edit$/);
});

test('activating it swaps in the editor, and leaving puts the sentence back', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;
  const dl = dateline(document);

  dl.text.click();
  assert.equal(dl.control.hidden, false, 'the editor appears in place');
  assert.equal(dl.text.hidden, true, 'and the sentence steps aside');
  assert.ok(dl.control.contains(document.activeElement), 'focus lands in the editor');

  // Leaving it restores the sentence, so the control is only present while in use.
  document.querySelector('[data-field="researchTitle"]').focus();
  await waitFor(() => dl.control.hidden === true, {
    timeout: 5000,
    message: 'leaving the editor should put the sentence back',
  });
  assert.equal(dl.text.hidden, false);
});

test('the sentence follows the value, however it changed', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;
  const dl = dateline(document);

  dl.text.click();
  setValue(window, dl.input, '2020-01-01');
  assert.equal(dl.text.textContent, '1 January 2020', 'an edit is reflected');

  // And when the app re-stamps it, which writes the value directly and fires
  // no event of its own.
  document.getElementById('clear-btn').click();
  assert.equal(dl.input.value, todayIso(), 'a cleared plan is dated today');
  // And the sentence says so. Asserting it is merely non-empty would still
  // pass with the redraw removed, which is how this first went green.
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  assert.equal(dl.text.textContent,
    now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear());
});

test('editing it by hand still stops the automatic stamping', async (t) => {
  // The behaviour Gus asked for stays intact through the presentation change.
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;
  const dl = dateline(document);

  // Edit once first: the stamp only fires once a baseline has been saved, so
  // without this the plan is never re-dated and the assertion below is empty.
  setValue(window, document.querySelector('[data-field="background"]'), 'First');
  await new Promise((resolve) => setTimeout(resolve, 700));

  dl.text.click();
  setValue(window, dl.input, '2020-01-01');

  setValue(window, document.querySelector('[data-field="goal"]'), 'New goal');
  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.equal(dl.input.value, '2020-01-01', 'the hand-set date survives an unrelated edit');
  assert.equal(dl.text.textContent, '1 January 2020');
});
