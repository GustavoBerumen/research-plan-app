'use strict';

// RPA-109. An input's width is a hint about the answer it expects: a ticket
// key is short, a name is moderate, free text is open-ended. The template
// says which with width=N, in the GOV.UK width classes, and the app sizes
// the control. Dates were already fixed; textareas stay full width.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const widthClass = (el) => (Array.from(el.classList).find((c) => /^input-w-\d+$/.test(c)) || '').replace('input-w-', '');

test('the identifier-like fields are sized to their answers, in the header and in the review step', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const sized = (key) => widthClass(d.querySelector('[data-field="' + key + '"]'));
  assert.equal(sized('jiraProject'), '10', 'a ticket key');
  assert.equal(sized('leadResearcher'), '20', 'a name');
  assert.equal(sized('projectRequester'), '20', 'a name');
  assert.equal(sized('signOffResearcher'), '20', 'a name, outside the header');
  assert.equal(sized('signOffProjectOwner'), '20');
});

test('open-ended and fixed controls carry no width: textareas, dates and the document title', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  for (const el of d.querySelectorAll('textarea[data-field], input[type=date]')) assert.equal(widthClass(el), '', el.dataset.field || 'date');
  assert.equal(widthClass(d.querySelector('[data-field="researchTitle"]')), '', 'the title is the page heading');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the classes exist with the GOV.UK measures, and only the GOV.UK widths are accepted', async (t) => {
  for (const [n, em] of [[2, '2.5em'], [3, '3.5em'], [4, '4.5em'], [5, '5.5em'], [10, '11.5em'], [20, '20.5em'], [30, '29.5em']]) {
    assert.ok(CSS.includes('.input-w-' + n + '{max-width:' + em + '}'), 'input-w-' + n);
  }
  // width=15 is not a GOV.UK class; the flag is ignored rather than inventing one.
  const app = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace('width=10, key=jiraProject', 'width=15, key=jiraProject') } });
  t.after(() => app.close());
  assert.equal(widthClass(app.document.querySelector('[data-field="jiraProject"]')), '');
});
