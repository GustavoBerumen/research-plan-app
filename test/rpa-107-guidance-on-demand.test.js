'use strict';

// RPA-107. Help on demand: one closed disclosure per field, at the bottom
// of the field under the box (Gus, 14 September 2026, after the GOV.UK
// example: the link sits below the control, not under the hint, and reads
// "Help with this section"). An indented "Guidance:" line in the template
// is the note; several lines are several paragraphs; *italics* work as in a
// hint; [text](url) links to a page that says more. Only some people need
// it, so it is not read to a screen reader on arrival (not part of the
// control's description). Not printed. Every field has the link, title and
// header fields included (Gus, later the same day); the words are RPA-119,
// and until a field's note is written its link opens on one honest line.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const fieldOf = (d, sel) => { const c = d.querySelector(sel); return c && c.closest('.field'); };
const helpIn = (wrap) => Array.from(wrap.children).find((k) => k.classList.contains('field-help')) || null;
const indexOf = (wrap, node) => Array.from(wrap.children).indexOf(node);
const isEvaluation = (k) => k.classList.contains('eval-controls') || k.classList.contains('eval-panel');

test('a field with Guidance lines gets a closed "Help with this section" block under its box, paragraph per line', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const wrap = fieldOf(app.document, '[data-field="background"]');
  const help = helpIn(wrap);
  assert.ok(help, 'Background has help');
  assert.equal(help.tagName, 'DETAILS');
  assert.equal(help.open, false, 'closed until wanted');
  assert.equal(text(help.querySelector('summary')), 'Help with this section');
  const paras = Array.from(help.querySelectorAll('.field-help-body p')).map(text);
  assert.equal(paras.length, 2, 'two Guidance lines, two paragraphs');
  assert.match(paras[0], /^Say what the product or service is/);
  assert.match(paras[1], /^Leave out what you plan to do/);
  assert.ok(indexOf(wrap, help) > indexOf(wrap, wrap.querySelector('[data-field="background"]')), 'below the box, not under the hint');
  assert.ok(Array.from(wrap.children).slice(indexOf(wrap, help) + 1).every(isEvaluation), 'only the evaluation controls follow it');
  assert.ok(wrap.querySelector('.eval-controls'), 'the fixture must be an evaluated field');
  assert.ok(indexOf(wrap, help) < indexOf(wrap, wrap.querySelector('.eval-controls')), 'the help belongs to answering, so it comes before the evaluation controls');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it is help on demand, not description: the control is described by its hint alone', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const ta = d.querySelector('[data-field="background"]');
  const ids = (ta.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const help = helpIn(fieldOf(d, '[data-field="background"]'));
  assert.ok(ids.some((id) => d.getElementById(id).classList.contains('field-hint-text')), 'keeps its hint');
  assert.ok(ids.every((id) => !help.contains(d.getElementById(id))), 'the note is not announced on arrival');
});

test('a repeated field gets it under its rows and add button, and a [text](url) becomes a link that opens elsewhere safely', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const wrap = fieldOf(app.document, '.list-rows[data-list-key="researchQuestions"]');
  const help = helpIn(wrap);
  assert.ok(help, 'Research Questions has help');
  assert.ok(indexOf(wrap, help) > indexOf(wrap, wrap.querySelector('.add-btn-row')), 'after the add button');
  assert.ok(Array.from(wrap.children).slice(indexOf(wrap, help) + 1).every(isEvaluation));
  const a = help.querySelector('a.field-help-link');
  assert.ok(a, 'a link in the note');
  assert.equal(a.textContent, 'service manual on user research', 'named without the wordmark: this is not a GOV.UK service');
  assert.equal(a.getAttribute('href'), 'https://www.gov.uk/service-manual/user-research');
  assert.equal(a.getAttribute('target'), '_blank');
  assert.equal(a.getAttribute('rel'), 'noopener');
});

test('every field has one, title and header included; a note not written yet opens on one honest line', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const labels = Array.from(d.querySelectorAll('[id^="field-"][id$="-label"]'));
  assert.ok(labels.length > 20, 'the whole form is labelled: ' + labels.length);
  const helpFor = (l) => {
    const wrap = l.closest('.field, .mf');
    const next = wrap ? helpIn(wrap) : (d.getElementById(l.id.replace(/-label$/, '')) || {}).nextElementSibling;
    return next && next.classList.contains('field-help') ? next : null;
  };
  const missing = labels.filter((l) => !helpFor(l)).map((l) => l.id);
  assert.deepEqual(missing, ['field-emailAddress-label', 'field-lastUpdated-label'], 'every labelled field but the email address, asked before the plan and not about the research (RPA-99), and Last updated, a computed date nobody fills in');
  assert.equal(d.querySelectorAll('.field-help').length, new Set(labels.map(helpFor).filter(Boolean)).size, 'one each, never two');
  assert.equal(d.getElementById('field-researchTitle').nextElementSibling, helpFor(d.getElementById('field-researchTitle-label')), 'the title has no wrapper, so it follows the box');
  const jira = d.getElementById('field-jiraProject-label').closest('.mf');
  assert.equal(jira.lastElementChild, helpIn(jira), 'a header field has it last');
  assert.equal(text(helpFor(d.getElementById('field-goal-label')).querySelector('.field-help-body')), 'No further help for this field yet.', 'Goal has no note yet and says so');
  assert.doesNotMatch(text(helpFor(d.getElementById('field-background-label'))), /No further help/, 'a written note replaces the line');
  assert.equal(d.querySelector('.field-help-body:empty'), null, 'never empty');
});

test('italics in a note render as emphasis, and the block does not print', async (t) => {
  const print = CSS.slice(CSS.indexOf('@media print{'));
  assert.match(print, /\.field-help,/, 'in the print hide-list');
  for (const eol of ['\n', '\r\n']) {
    const source = TEMPLATE.replace(/\r\n/g, '\n').replace(/\n/g, eol);
    const tpl = source.replace(/^([^\r\n]*\bkey=goal\b[^\r\n]*)(\r?\n)/m,
      '$1$2  Guidance: Write it as *one sentence*.$2');
    assert.notEqual(tpl, source, 'the fixture must find the Goal field');
    const app = await bootApp({ textAssets: { 'research-plan-template.md': tpl } });
    t.after(() => app.close());
    const em = fieldOf(app.document, '[data-field="goal"]').querySelector('.field-help-body em');
    assert.equal(em && em.textContent, 'one sentence', JSON.stringify(eol));
  }
});
