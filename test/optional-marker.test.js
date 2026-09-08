'use strict';

// RPA-55 recommendation 5 is to mark more of the form optional — only 3 of 25
// fields carry the flag today, which on a form this long is almost certainly
// understated. That makes the flag load-bearing, and it was not reliable.
//
// Each builder drew the "(optional)" marker inline, so the two that never did
// were invisible: declaring `optional` on Outcomes or on a table parsed fine,
// rendered fine, and produced nothing. Previous Knowledge became optional in
// RPA-55 and would have been the first field to hit it.
//
// It is one helper now, and this file is the reason it stays one. The check is
// generated from the template rather than from a list written here, so a field
// type added later is covered without anyone remembering to come back.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, withFieldFlag } = require('./app-harness');

const TEMPLATE = path.join(__dirname, '..', 'research-plan-template.md');

function template() {
  return fs.readFileSync(TEMPLATE, 'utf8');
}

// Every live field, with the type it declares. Comments are stripped first so
// dormant fields do not appear.
function liveFields() {
  const body = template().replace(/<!--[\s\S]*?-->/g, '');
  const fields = [];
  const re = /^(# )?([A-Z][^(\n]*?) \(([a-z][^)\n]*)\)/gm;
  let m;
  while ((m = re.exec(body))) {
    const parts = m[3].split(',').map((p) => p.trim());
    const key = (parts.map((p) => /^key=(.+)$/.exec(p)).filter(Boolean)[0] || [])[1];
    // A field declared with a leading "#" is the document heading, not a form
    // field: Research title renders as the page's title control and has no
    // .field wrapper to hang a marker on. It is excluded rather than fixed —
    // marking the document's own name optional would be meaningless.
    if (key) {
      fields.push({
        label: m[2], key, type: parts[0],
        optional: parts.includes('optional'), heading: Boolean(m[1]),
      });
    }
  }
  return fields;
}

function markerFor(document, field) {
  // A field is found by whatever it renders: a control, a list, or a table.
  const el = document.querySelector('[data-field="' + field.key + '"]')
    || document.querySelector('.list-rows[data-list-key="' + field.key + '"]')
    || document.getElementById(field.key + '-table')
    || document.querySelector('.radio-group[data-field-key="' + field.key + '"]');
  if (!el) return { found: false };
  // A header field renders into the compact meta block rather than a .field.
  const wrap = el.closest('.field') || el.closest('.mf');
  return { found: true, marker: wrap ? wrap.querySelector('.fopt') : null };
}

test('Previous Knowledge says it is optional', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const wrap = app.document.getElementById('previousKnowledge-table').closest('.field');
  const marker = wrap.querySelector('.fopt');
  assert.ok(marker, 'the table shows an (optional) marker');
  assert.equal(marker.textContent, '(optional)');
});

test('only the fields the template marks optional say so', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const mismatches = [];
  liveFields().forEach((field) => {
    if (field.heading) return;
    const { found, marker } = markerFor(app.document, field);
    if (!found) return;
    if (field.optional && !marker) mismatches.push(field.label + ' is optional but says nothing');
    if (!field.optional && marker) mismatches.push(field.label + ' is not optional but claims to be');
  });
  assert.deepEqual(mismatches, []);
});

test('every field type that has a label can carry the marker', async (t) => {
  // The regression. Each type is made optional in turn, from a fixture, and
  // has to say so — so a builder that forgets is caught by the type rather
  // than by whichever field happens to be optional this month.
  //
  // custom-fields is the one exception, and deliberate: Additional Resources
  // renders no label of its own, so there is nowhere to put the marker and an
  // empty list already says the field is not required.
  const byType = new Map();
  liveFields().forEach((f) => {
    if (f.optional || f.heading || byType.has(f.type)) return;
    byType.set(f.type, f);
  });
  assert.ok(byType.size >= 5, 'expected several field types to check, got ' + byType.size);

  for (const [type, field] of byType) {
    if (type === 'custom-fields') continue;
    const app = await bootApp({
      textAssets: { 'research-plan-template.md': withFieldFlag(template(), field.key, 'optional') },
    });
    const { marker } = markerFor(app.document, field);
    app.close();
    assert.ok(marker, `a "${type}" field (${field.label}) declared optional must show the marker`);
  }
});

test('a custom-fields field is the documented exception', async (t) => {
  // Not an oversight, and the comment in app.js says so. If that ever changes,
  // this test should be updated rather than deleted quietly.
  const custom = liveFields().find((f) => f.type === 'custom-fields');
  assert.ok(custom, 'the form still has a custom-fields field');

  const app = await bootApp({
    textAssets: { 'research-plan-template.md': withFieldFlag(template(), custom.key, 'optional') },
  });
  t.after(() => app.close());

  const list = app.document.querySelector('.custom-fields-list[data-list-key="' + custom.key + '"]');
  assert.ok(list, 'it still renders');
  assert.equal(list.closest('.field').querySelector('.fopt'), null,
    'and shows no marker, because it has no label to put one on');
});
