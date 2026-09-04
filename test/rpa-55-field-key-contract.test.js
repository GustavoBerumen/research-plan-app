'use strict';

// Field keys are derived from labels in research-plan-template.md by
// toCamelKey, so renaming a label renames its key. Most of the app never
// notices — it looks fields up through the schema — but a handful of features
// query a key by name in the source. Those are the ones a copy edit can break,
// and they break silently: initDeadlineConstraints, for one, returns early
// when a field is missing, so the form renders perfectly with the check gone.
//
// That is exactly what happened in RPA-55. "Report Research" became "Research
// readout", the key became researchReadout, and the one-week buffer warning
// stopped existing without a single error. These tests cover the three parts
// of that: the lookups themselves, the feature that was lost, and the drafts
// people had already saved under the old keys.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue } = require('./app-harness');

const APP_JS = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Whole-line comments only. Stripping to end-of-line from any "//" would eat
// the "//" in URLs inside string literals; a trailing comment naming a fake
// key would produce a loud, obvious failure rather than a silent gap, and
// there are none today.
function withoutLineComments(source) {
  return source.replace(/^[ \t]*\/\/.*$/gm, '');
}

// Only literal lookups. The dynamic form, '[data-field="' + key + '"]', can't
// match: the character after the quote is an apostrophe, not a letter.
function hardcodedFieldKeys(source) {
  const keys = new Set();
  const pattern = /\[data-field="([A-Za-z][A-Za-z0-9]*)"\]/g;
  let match;
  while ((match = pattern.exec(withoutLineComments(source))) !== null) {
    keys.add(match[1]);
  }
  return Array.from(keys).sort();
}

test('every field key the application looks up by name exists in the form', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const keys = hardcodedFieldKeys(APP_JS);
  // A scan that silently found nothing would pass forever.
  assert.ok(keys.length >= 4, `expected several hardcoded lookups, found ${keys.length}`);

  const missing = keys.filter((key) => !app.document.querySelector(`[data-field="${key}"]`));
  assert.deepEqual(
    missing,
    [],
    `app.js looks up ${missing.join(', ')} by name, but no field renders with that key. ` +
      'A label was probably renamed in research-plan-template.md: the key follows the ' +
      'label, so the lookup has to be updated with it.'
  );
});

test('the readout buffer warning tracks the gap to the decision date', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const decision = document.querySelector('[data-field="projectDecision"]');
  const readout = document.querySelector('[data-field="researchReadout"]');
  assert.ok(decision && readout, 'both date fields should render');

  // Scoped to this field: two other features also build .field-warning.
  const warning = readout.closest('.mf').querySelector('.field-warning');
  assert.ok(warning, 'no warning element — initDeadlineConstraints returned early');
  assert.equal(warning.hidden, true, 'nothing entered yet, so nothing to warn about');

  setValue(window, decision, '2026-09-25');
  assert.equal(warning.hidden, true, 'a decision date alone says nothing about buffer');

  setValue(window, readout, '2026-09-24');
  assert.equal(warning.hidden, false, 'one day of buffer should warn');

  setValue(window, readout, '2026-09-19');
  assert.equal(warning.hidden, false, 'six days is still under a week');

  setValue(window, readout, '2026-09-18');
  assert.equal(warning.hidden, true, 'exactly a week is the point of the rule');

  setValue(window, readout, '2026-09-01');
  assert.equal(warning.hidden, true, 'more than a week is fine');

  // The hard half of the same feature: the readout cannot outrun the decision.
  assert.equal(readout.max, '2026-09-25');
  setValue(window, readout, '2026-09-30');
  assert.equal(readout.value, '2026-09-25', 'a later readout date is clamped to the decision');
});

test('a draft saved before the RPA-55 header renames restores into the new fields', async (t) => {
  const app = await bootApp({
    draft: {
      version: 3,
      savedAt: '2026-09-01T09:00:00.000Z',
      fields: {
        title: 'Checkout study',
        researcher: 'Ada Lovelace',
        projectOwner: 'Grace Hopper',
        reportResearch: '2026-09-18',
        projectDecision: '2026-09-25',
      },
      selects: {},
      lists: {},
    },
  });
  t.after(() => app.close());

  const valueOf = (key) => {
    const input = app.document.querySelector(`[data-field="${key}"]`);
    assert.ok(input, `no field renders with the key ${key}`);
    return input.value;
  };

  assert.equal(valueOf('leadResearcher'), 'Ada Lovelace');
  assert.equal(valueOf('projectRequester'), 'Grace Hopper');
  assert.equal(valueOf('researchReadout'), '2026-09-18');

  // Untouched by the rename, and proof the migration copies rather than moves
  // everything it sees.
  assert.equal(valueOf('title'), 'Checkout study');
  assert.equal(valueOf('projectDecision'), '2026-09-25');
});
