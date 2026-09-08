'use strict';

// Sample Size was a dropdown. GOV.UK treats a select as a last resort, because
// people find them harder than other controls, and says to use radios below
// about 20 options. Five short options that form a scale is the case that
// guidance is written for: you can compare them without opening anything.
//
// The part worth pinning is not the markup but the storage. A radio group
// keeps the .select-cell wrapper and its data-field-key, and reports the same
// { v, o } snapshot a dropdown did, so a draft saved before the change still
// restores — no migration, no orphaned values.

const test = require('node:test');
const assert = require('node:assert/strict');
const { DRAFT_KEY, bootApp, waitFor } = require('./app-harness');

function group(document) {
  const el = document.querySelector('.radio-group[data-field-key="sampleSize"]');
  assert.ok(el, 'Sample Size renders as a radio group');
  return {
    el,
    radios: Array.from(el.querySelectorAll('.radio-input')),
    otherRow: el.querySelector('.select-other-row'),
    otherInput: el.querySelector('.select-other-input'),
  };
}

function choose(window, radio) {
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
}

test('renders one radio per option plus Other, with the reveal put away', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const g = group(document);
  assert.deepEqual(g.radios.map((r) => r.value), [
    'Small (1–5)', 'Medium (6–12)', 'Large (13–29)', 'Very Large (30+)', '__other__',
  ]);
  assert.equal(g.otherRow.hidden, true, 'the free-text reveal starts hidden');
  assert.equal(g.radios.filter((r) => r.checked).length, 0, 'nothing is preselected');

  // The group names itself, since there is no single control to label.
  assert.equal(g.el.getAttribute('role'), 'radiogroup');
  const labelledBy = document.getElementById(g.el.getAttribute('aria-labelledby'));
  assert.equal(labelledBy.textContent.trim(), 'Sample Size');

  // Every radio has a real label bound to it, so the text is a hit target.
  g.radios.forEach((radio) => {
    assert.ok(document.querySelector(`label[for="${radio.id}"]`), `${radio.value} has a label`);
  });
  assert.equal(document.querySelector(`label[for="${g.radios[4].id}"]`).textContent, 'Other');
});

test('choosing Other reveals a text input, and leaving it puts it away', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;
  const g = group(document);

  choose(window, g.radios[4]);
  assert.equal(g.otherRow.hidden, false, 'Other reveals the free-text input');

  g.otherInput.value = 'Two cohorts of eight';
  choose(window, g.radios[1]);
  assert.equal(g.otherRow.hidden, true, 'picking a listed option hides it again');
  assert.equal(g.otherInput.value, '', 'and clears it, so a stale value cannot be saved');
});

test('the choice is saved and restored in the shape a dropdown used', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  choose(window, group(document).radios[2]);
  const raw = await waitFor(() => window.localStorage.getItem(DRAFT_KEY), {
    timeout: 5000,
    message: 'the draft was never saved',
  });
  const saved = JSON.parse(raw);
  assert.deepEqual(saved.selects.sampleSize, { v: 'Large (13–29)', o: '' });

  const restored = await bootApp({ draft: saved });
  t.after(() => restored.close());
  const back = group(restored.document);
  assert.deepEqual(back.radios.map((r) => r.checked), [false, false, true, false, false]);
  assert.equal(back.otherRow.hidden, true);
});

test('a draft saved while Sample Size was a dropdown still restores', async (t) => {
  // Exactly what a pre-change draft looks like: the select stored its value
  // under the same key, in the same shape.
  const app = await bootApp({
    draft: {
      version: 6,
      savedAt: '2026-09-01T09:00:00.000Z',
      fields: {},
      selects: { sampleSize: { v: 'Medium (6–12)', o: '' } },
      lists: {},
    },
  });
  t.after(() => app.close());

  const g = group(app.document);
  const checked = g.radios.filter((r) => r.checked);
  assert.equal(checked.length, 1);
  assert.equal(checked[0].value, 'Medium (6–12)', 'the old dropdown value selects its radio');
});

test('an Other value from an older draft comes back with the reveal open', async (t) => {
  const app = await bootApp({
    draft: {
      version: 6,
      savedAt: '2026-09-01T09:00:00.000Z',
      fields: {},
      selects: { sampleSize: { v: '__other__', o: 'Two cohorts of eight' } },
      lists: {},
    },
  });
  t.after(() => app.close());

  const g = group(app.document);
  assert.equal(g.radios[4].checked, true, 'Other is the selected option');
  assert.equal(g.otherRow.hidden, false, 'and its input is showing');
  assert.equal(g.otherInput.value, 'Two cohorts of eight');
});
