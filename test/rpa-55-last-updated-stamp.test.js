'use strict';

// "Last updated" is computed: the app stamps it with today whenever the plan's
// content changes. It is also editable, and those two things used to fight.
// A date typed by hand survived a reload, because it is saved in the draft,
// and was then silently overwritten by the next keystroke in any other field.
// The control accepted an answer, kept it long enough to be trusted, and threw
// it away without a word.
//
// Now a hand-set date switches the automatic stamping off, and that choice is
// remembered in the draft. These tests pin both halves: the stamp still works
// when nobody has intervened, and stops when somebody has.

const test = require('node:test');
const assert = require('node:assert/strict');
const { DRAFT_KEY, bootApp, setValue, waitFor } = require('./app-harness');

function lastUpdated(document) {
  const input = document.querySelector('[data-field="lastUpdated"]');
  assert.ok(input, 'the header renders a Last updated control');
  return input;
}

function todayIso() {
  const now = new Date();
  return now.getFullYear()
    + '-' + String(now.getMonth() + 1).padStart(2, '0')
    + '-' + String(now.getDate()).padStart(2, '0');
}

test('sits in the corner slot and is stamped with today on a fresh plan', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const input = lastUpdated(document);
  assert.equal(input.value, todayIso());

  const mf = input.closest('.mf');
  assert.ok(mf.classList.contains('mf-compact'), 'rendered in the compact slot');
  assert.ok(mf.closest('.doc-header-top'), 'in the corner row above the title');
  assert.equal(document.querySelectorAll('.meta-grid [data-field="lastUpdated"]').length, 0,
    'not down in the grid of questions');

  // No hint: the corner has no room, and nobody is asked to fill this in.
  assert.equal(mf.querySelector('.field-hint-text'), null);
});

test('a hand-set date survives editing the rest of the plan', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const input = lastUpdated(document);
  setValue(window, input, '2020-01-01');

  // The exact thing that used to destroy it: an unrelated content edit.
  setValue(window, document.querySelector('[data-field="background"]'), 'New context');
  await waitFor(() => window.localStorage.getItem(DRAFT_KEY), {
    timeout: 5000,
    message: 'the draft was never saved',
  });

  assert.equal(input.value, '2020-01-01', 'the hand-set date is kept');

  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.fields.lastUpdated, '2020-01-01');
  assert.equal(saved.lastUpdatedManual, true, 'the choice is recorded in the draft');
});

test('the choice is remembered after a reload, not just for the session', async (t) => {
  const app = await bootApp({
    draft: {
      version: 5,
      savedAt: '2020-01-01T09:00:00.000Z',
      fields: { lastUpdated: '2020-01-01' },
      lastUpdatedManual: true,
      selects: {},
      lists: {},
    },
  });
  t.after(() => app.close());

  const input = lastUpdated(app.document);
  assert.equal(input.value, '2020-01-01', 'restored as saved, not re-stamped on render');

  setValue(app.window, app.document.querySelector('[data-field="goal"]'), 'A goal');
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(input.value, '2020-01-01', 'and still not re-stamped after an edit');
});

test('without a hand-set date, editing the plan re-stamps it', async (t) => {
  const app = await bootApp({
    draft: {
      version: 5,
      savedAt: '2020-01-01T09:00:00.000Z',
      fields: { lastUpdated: '2020-01-01' },
      selects: {},
      lists: {},
    },
  });
  t.after(() => app.close());

  const input = lastUpdated(app.document);
  assert.equal(input.value, '2020-01-01', 'restored as saved');

  setValue(app.window, app.document.querySelector('[data-field="background"]'), 'Edited today');
  await waitFor(() => input.value === todayIso(), {
    timeout: 5000,
    message: 'an ordinary edit should re-stamp the date',
  });
});

test('Clear Form starts a new plan, stamping again from today', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const input = lastUpdated(document);
  setValue(window, input, '2020-01-01');
  setValue(window, document.querySelector('[data-field="background"]'), 'Some context');
  await waitFor(() => window.localStorage.getItem(DRAFT_KEY), { timeout: 5000 });
  assert.equal(input.value, '2020-01-01');

  document.getElementById('clear-btn').click();
  assert.equal(input.value, todayIso(), 'a cleared plan is a new plan, dated today');

  // And the automatic stamping is back on for it.
  setValue(window, input, '2019-06-05');
  setValue(window, document.querySelector('[data-field="background"]'), 'Context again');
  await waitFor(() => window.localStorage.getItem(DRAFT_KEY), { timeout: 5000 });
  assert.equal(input.value, '2019-06-05', 'until somebody sets it by hand again');
});
