'use strict';

// RPA-107. Longer help for a field, on demand: an indented "Guidance:" line
// in the template becomes a closed details block under the hint, with a
// "More about this question" summary. Only some people need it, so it is
// not read to a screen reader on arrival (not part of the field's
// description); a person opens it when they want it. Several Guidance
// lines are several paragraphs; *italics* work as in a hint; [text](url)
// links to a page that says more. Not printed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const fieldOf = (d, sel) => d.querySelector(sel).closest('.field');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();

test('a field with Guidance lines gets a closed details block right after its hint, paragraph per line', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const field = fieldOf(d, '[data-field="background"]');
  const hint = field.querySelector('.field-hint-text');
  const details = field.querySelector('.field-guidance');
  assert.ok(details, 'Background has guidance');
  assert.equal(details.tagName, 'DETAILS');
  assert.equal(details.open, false, 'closed until wanted');
  assert.equal(hint.nextElementSibling, details, 'directly after the hint');
  assert.equal(text(details.querySelector('summary')), 'More about this question');
  const paras = Array.from(details.querySelectorAll('.field-guidance-body p')).map(text);
  assert.equal(paras.length, 2, 'two Guidance lines, two paragraphs');
  assert.match(paras[0], /^Say what the product or service is/);
  assert.match(paras[1], /^Leave out what you plan to do/);
  assert.deepEqual(app.jsdomErrors, []);
});

test('it is help on demand, not description: the control is described by its hint alone', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const ta = d.querySelector('[data-field="background"]');
  const ids = (ta.getAttribute('aria-describedby') || '').split(/\s+/);
  const details = fieldOf(d, '[data-field="background"]').querySelector('.field-guidance');
  assert.ok(ids.includes(fieldOf(d, '[data-field="background"]').querySelector('.field-hint-text').id));
  assert.ok(!details.id || !ids.includes(details.id), 'the essay is not announced on arrival');
});

test('repeated fields get it too, and a [text](url) becomes a link that opens elsewhere safely', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const field = d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field');
  const details = field.querySelector('.field-guidance');
  assert.ok(details, 'Research Questions has guidance');
  assert.equal(field.querySelector('.field-hint-text').nextElementSibling, details);
  const a = details.querySelector('a.field-guidance-link');
  assert.ok(a, 'a link in the guidance');
  assert.equal(a.textContent, 'the service manual on user research', 'named without the wordmark: this is not a GOV.UK service');
  assert.equal(a.getAttribute('href'), 'https://www.gov.uk/service-manual/user-research');
  assert.equal(a.getAttribute('target'), '_blank');
  assert.equal(a.getAttribute('rel'), 'noopener');
});

test('only fields with Guidance get one; the template today gives it to five', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.equal(d.querySelectorAll('.field-guidance').length, 5);
  assert.equal(fieldOf(d, '[data-field="goal"]').querySelector('.field-guidance'), null, 'Goal has none');
  assert.equal(fieldOf(d, '[data-field="theory"]').querySelector('.field-guidance'), null);
});

test('italics in guidance render as emphasis, and the block does not print', async (t) => {
  const print = CSS.slice(CSS.indexOf('@media print{'));
  assert.match(print, /\.field-guidance,/, 'in the print hide-list');
  for (const eol of ['\n', '\r\n']) {
    const source = TEMPLATE.replace(/\r\n/g, '\n').replace(/\n/g, eol);
    const tpl = source.replace(/^([^\r\n]*\bkey=goal\b[^\r\n]*)(\r?\n)/m,
      '$1$2  Guidance: Write it as *one sentence*.$2');
    assert.notEqual(tpl, source, 'the fixture must find the Goal field');
    const app = await bootApp({ textAssets: { 'research-plan-template.md': tpl } });
    t.after(() => app.close());
    const em = fieldOf(app.document, '[data-field="goal"]').querySelector('.field-guidance-body em');
    assert.equal(em && em.textContent, 'one sentence', JSON.stringify(eol));
  }
});
