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
const { bootApp, setValue, DRAFT_KEY } = require('./app-harness');

const APP_JS = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Whole-line comments only. Stripping to end-of-line from any "//" would eat
// the "//" in URLs inside string literals; a trailing comment naming a fake
// key would produce a loud, obvious failure rather than a silent gap, and
// there are none today.
function withoutLineComments(source) {
  return source.replace(/^[ \t]*\/\/.*$/gm, '');
}

// Every shape in which app.js names a field key. Scanning only the first of
// these was the gap Max found reviewing PR #22: renaming Research Questions
// left the form opening normally while Outcomes rendered no rows, and this
// test passed throughout.
const FIELD_KEY_PATTERNS = [
  /\[data-field="([A-Za-z][A-Za-z0-9]*)"\]/g,          // querySelector by field
  /data-list-key="([A-Za-z][A-Za-z0-9]*)"/g,           // querySelector by list
  /\b(?:field|f)\.key === '([A-Za-z][A-Za-z0-9]*)'/g,  // branch on the field
];

// Columns have keys too, derived from column labels the same way, and the
// timeline reads three of them by name. e.key === 'Enter' and friends are
// keyboard events, which is why these are scoped to the receiver name.
const COLUMN_KEY_PATTERNS = [
  /\b(?:col|c)\.key === '([A-Za-z][A-Za-z0-9]*)'/g,
];

function scan(source, patterns) {
  const clean = withoutLineComments(source);
  const found = new Set();
  patterns.forEach((pattern) => {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(clean)) !== null) found.add(match[1]);
  });
  return Array.from(found).sort();
}

test('every field key the application looks up by name exists in the form', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const keys = scan(APP_JS, FIELD_KEY_PATTERNS);
  assert.ok(keys.length >= 8, `expected several hardcoded field lookups, found ${keys.length}`);

  const rendered = new Set([
    ...Array.from(document.querySelectorAll('[data-field]'))
      .map((el) => el.getAttribute('data-field')),
    ...Array.from(document.querySelectorAll('[data-list-key]'))
      .map((el) => el.getAttribute('data-list-key')),
    // Tables render no [data-field] of their own, so they carry their key
    // explicitly — otherwise field.key === 'stageTimeline' looks unverifiable.
    ...Array.from(document.querySelectorAll('[data-field-key]'))
      .map((el) => el.getAttribute('data-field-key')),
  ]);

  const missing = keys.filter((key) => !rendered.has(key));
  assert.deepEqual(
    missing,
    [],
    `app.js looks up ${missing.join(', ')} by name, but no field renders with that key. ` +
      'Every field declares its key in research-plan-template.md, so this means the key ' +
      'was changed or the field removed — not that a label was edited.'
  );
});

test('every table column key the application looks up by name exists', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const keys = scan(APP_JS, COLUMN_KEY_PATTERNS);
  assert.ok(keys.length >= 3, `expected the timeline column lookups, found ${keys.length}`);

  // Columns can pin their keys now (RPA-74), so this is a guard rather than
  // the whole of the protection it used to be. It still earns its place: the
  // pin is optional, and a column added without one is back where the form
  // was — its key following its label.
  const rendered = new Set(
    Array.from(app.document.querySelectorAll('th[data-col-key]')).map((th) => th.dataset.colKey)
  );

  const missing = keys.filter((key) => !rendered.has(key));
  assert.deepEqual(missing, [],
    `app.js reads the columns ${missing.join(', ')} by key, but no table renders them. ` +
      'A column label was probably renamed: column keys still follow their labels.');
});

test('the template pins every table column key too', async (t) => {
  // The companion to the field-key test below. Every live column declares its
  // key, so a reworded heading cannot change it. The fallback to the label
  // stays for columns added in a hurry, and this is what stops "in a hurry"
  // becoming the norm.
  const template = fs.readFileSync(
    path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'
  );
  const start = template.indexOf('\n-->') + 4;

  const unpinned = [];
  template.slice(start).split('\n')
    .map((line) => line.replace(/^<!--\s*|\s*-->$/g, '').trim())
    .filter((line) => /^[A-Z][^(]*\(table[,)]/.test(line))
    .forEach((line) => {
      const spec = line.slice(line.indexOf(':') + 1);
      spec.split('|').map((c) => c.trim()).filter(Boolean).forEach((column) => {
        const [labelType] = column.split('=');
        const parts = labelType.split(':');
        if (parts.length < 3 || !parts[2].trim()) {
          unpinned.push(line.split('(')[0].trim() + ' → ' + parts[0].trim());
        }
      });
    });

  assert.deepEqual(unpinned, [],
    'these columns still take their key from their label, so renaming the '
      + 'heading would change the key underneath it: ' + unpinned.join(', '));
});

test('a renamed column heading keeps its key, and the timeline with it', async (t) => {
  // The failure this ticket exists to remove. Renaming Start Date used to
  // change its key from startDate to something else, and the timeline, the
  // row-level date constraint and the RPA-59 anchors all read that key by
  // name — so the form rendered perfectly and quietly stopped working.
  const real = fs.readFileSync(
    path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'
  );
  const renamed = real.replace('Start Date:date:startDate', 'Fieldwork begins:date:startDate');
  assert.notEqual(renamed, real, 'the Start Date column was not found to rename');

  const app = await bootApp({ textAssets: { 'research-plan-template.md': renamed } });
  t.after(() => app.close());
  const { document } = app;

  const headers = Array.from(document.querySelectorAll('#stageTimeline-table thead th'));
  const renamedHeader = headers.find((th) => th.textContent.trim() === 'Fieldwork begins');
  assert.ok(renamedHeader, 'the new heading is shown');
  assert.equal(renamedHeader.dataset.colKey, 'startDate', 'and the key underneath it did not move');

  // And the things that read it by name still work: the first row's start date
  // is still filled from the plan's creation date (RPA-76).
  const firstStart = document
    .querySelectorAll('#stageTimeline-table tbody tr')[0]
    .querySelectorAll('input[type="date"]')[0];
  assert.match(firstStart.value, /^\d{4}-\d{2}-\d{2}$/,
    'the anchor still found the column it was looking for');
});

test('the template pins every field key, so labels can be reworded freely', async (t) => {
  const template = fs.readFileSync(
    path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'
  );
  const start = template.indexOf('\n-->') + 4;
  const fieldLines = template.slice(start).split('\n')
    .map((line) => line.replace(/^<!--\s*|\s*-->$/g, '').trim())
    .filter((line) => /^(#\s+)?[^(<][^(]*\([^)]*\)\s*:/.test(line));

  assert.ok(fieldLines.length > 20, `expected the template's fields, found ${fieldLines.length}`);
  const unpinned = fieldLines.filter((line) => !/\bkey=[A-Za-z][A-Za-z0-9]*\b/.test(line));
  assert.deepEqual(unpinned, [],
    'these fields still derive their key from their label, so rewording one would ' +
      'silently break any code that looks it up');
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
        title: 'Checkout study',  // renamed to researchTitle in v5
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

  assert.equal(valueOf('researchTitle'), 'Checkout study');

  // Untouched by any rename, and proof the migration moves only what it names.
  assert.equal(valueOf('projectDecision'), '2026-09-25');
});

test('a draft saved before the merge finds User Groups still there', async (t) => {
  // RPA-55 merged these two and then reversed it: a screener criterion filters
  // who is eligible, a segment sets who must be represented among those who
  // are. While they were one field a migration folded userGroups into
  // characteristics. That fold is gone, and its absence is the behaviour under
  // test — running it now would move somebody's segments into the wrong field
  // and delete the key they came from.
  const app = await bootApp({
    draft: {
      version: 5,
      savedAt: '2026-09-01T09:00:00.000Z',
      fields: {},
      selects: {},
      lists: {
        characteristics: ['Frequent mobile shoppers'],
        userGroups: ['New customers', 'Returning customers'],
      },
    },
  });
  t.after(() => app.close());

  const listValues = (key) => Array.from(
    app.document.querySelectorAll('.list-rows[data-list-key="' + key + '"] .list-input')
  ).map((input) => input.value);

  assert.ok(app.document.querySelector('.list-rows[data-list-key="userGroups"]'),
    'User Groups renders again');
  assert.deepEqual(listValues('userGroups'), ['New customers', 'Returning customers'],
    'the segments stay segments');
  assert.deepEqual(listValues('characteristics'), ['Frequent mobile shoppers'],
    'and nothing was folded in on top of them');
});

test('the two fields ask different questions, and say so', async (t) => {
  // The merge argued that both wanted a short noun phrase naming a kind of
  // person. True of the format, wrong about the function — and the hints are
  // the only thing keeping them from collapsing back together, so they are
  // worth pinning. If a rewording ever makes both say the same thing again,
  // this is the test that should object.
  const app = await bootApp();
  t.after(() => app.close());

  const hintFor = (key) => {
    const list = app.document.querySelector('.list-rows[data-list-key="' + key + '"]');
    return list.closest('.field').querySelector('.field-hint-text').textContent.trim();
  };

  const characteristics = hintFor('characteristics');
  const userGroups = hintFor('userGroups');
  assert.notEqual(characteristics, userGroups);
  assert.match(characteristics, /eligib/i, 'Characteristics is about who qualifies');
  assert.match(userGroups, /represent/i, 'User Groups is about who must be present');
});

test('both lists save and come back under their own keys', async (t) => {
  const app = await bootApp();
  const { document, window } = app;

  const inputFor = (key) => document
    .querySelector('.list-rows[data-list-key="' + key + '"] .list-input');
  setValue(window, inputFor('characteristics'), 'Abandoned a checkout in the last 30 days');
  setValue(window, inputFor('userGroups'), 'New customers');
  await new Promise((resolve) => setTimeout(resolve, 700));

  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.deepEqual(saved.lists.characteristics, ['Abandoned a checkout in the last 30 days']);
  assert.deepEqual(saved.lists.userGroups, ['New customers'],
    'the segments are stored separately, not appended to the criteria');
  app.close();

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  assert.equal(
    reopened.document.querySelector('.list-rows[data-list-key="userGroups"] .list-input').value,
    'New customers'
  );
});
