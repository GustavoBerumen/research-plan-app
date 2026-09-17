'use strict';

// RPA-118. Sample Size in the design system's shape: a fieldset whose legend
// asks the question ("How many participants do you need?"), the hint
// beneath it, the options stacked as radios with a conditional "Other". The
// field keeps its name for the error summary and the check page ("Select a
// sample size for research question 1"), and the fieldset carries the hint
// for assistive technology. The template's "question=" sets the legend.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, toCheckPage } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const fieldsetOf = (d) => d.querySelector('.radio-group[data-field-key="sampleSize"]').closest('.field');
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const rule = (selector) => { const m = CSS.match(new RegExp('(?:^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[1] : null; };

test('Sample Size is a fieldset: the question as its legend, the hint beneath, stacked radios with Other last, and the fieldset described by the hint', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const fieldset = fieldsetOf(d);
  assert.equal(fieldset.tagName, 'FIELDSET');
  const legend = fieldset.querySelector(':scope > legend');
  assert.ok(legend, 'the question is the legend');
  assert.equal(text(legend), 'How many participants do you need?', 'a plain-English question; named for its study once one is declared (RPA-142)');
  const hint = fieldset.querySelector(':scope > .field-hint-text');
  assert.equal(legend.nextElementSibling, hint, 'the hint sits under the legend');
  assert.match(text(hint), /^The number of people/);
  assert.ok((fieldset.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id), 'the fieldset carries the hint');
  const items = Array.from(fieldset.querySelectorAll('.radio-item'));
  assert.deepEqual(items.map((i) => text(i.querySelector('.radio-label'))), ['Small (1–5)', 'Medium (6–12)', 'Large (13–29)', 'Very Large (30+)', 'Other']);
  items.forEach((i) => {
    const input = i.querySelector('input[type=radio]');
    const label = i.querySelector('label');
    assert.equal(label.getAttribute('for'), input.id, 'every option has a real label bound to it');
    assert.equal(input.nextElementSibling, label, 'input then label, so the drawn circle follows the state');
  });
  assert.equal(fieldset.querySelector('.radio-other-row').hidden, true, 'the Other reveal starts put away');
  assert.equal(fieldset.querySelector('[role="radiogroup"]'), null, 'no duplicate group role beside the fieldset');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the field keeps its name for the check page and has its own words for the error summary, while the legend asks the question', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => visible(d)[0] === steps(d)[i].dataset.stepSlug);
    completeStep(app, steps(d)[i]);
  }
  window.location.hash = '#methodology';
  await waitFor(() => visible(d)[0] === 'methodology');
  const methodology = steps(d)[5];
  const group = d.querySelector('.methods-group');
  setValue(window, group.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Interviews');
  setValue(window, group.querySelector('.list-rows[data-list-key="characteristics"] .list-input'), 'Abandoned a basket');
  toCheckPage(methodology);
  assert.deepEqual(linksOf(methodology), ['Select how many participants you need for Study 1'], 'the message says what to do and names the study (RPA-120)');
  const fieldset = fieldsetOf(d);
  assert.ok(fieldset.classList.contains('field-invalid'), 'the fieldset is marked');
  assert.match(text(fieldset.querySelector('.field-error')), /^Error: Select how many participants you need for Study 1$/);
  fieldset.querySelector('input[type=radio]').click();
  assert.equal(fieldset.classList.contains('field-invalid'), false, 'and the mark goes with the choice');
  toCheckPage(methodology);
  const rows = Object.fromEntries(Array.from(methodology.querySelectorAll('.check-answers .summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]));
  assert.equal(rows['Sample Size for Study 1'], 'Small (1–5)', 'the check page row keeps the field\'s name');
});

test('the stylesheet gives the radios the design system\'s shape: 40px targets, a drawn circle, a dot made of border so it prints, a visible focus', () => {
  assert.match(rule('fieldset.field'), /border:0/, 'the browser\'s fieldset frame is gone');
  assert.match(rule('fieldset.field.field-invalid'), /border-left:5px solid var\(--red\)/, 'but the error bar still shows');
  assert.match(rule('.radio-input'), /width:40px;height:40px/);
  assert.match(rule('.radio-input'), /opacity:0/, 'the native control is under the drawn one, still clickable and focusable');
  assert.match(rule('.radio-label::before'), /width:40px;height:40px;border:2px solid var\(--ink\);border-radius:50%/);
  assert.match(rule('.radio-label::after'), /border:10px solid var\(--ink\)/, 'a dot of border, not background, so it prints');
  assert.match(rule('.radio-input:checked+.radio-label::after'), /opacity:1/);
  assert.match(rule('.radio-input:focus-visible+.radio-label::before'), /var\(--focus\)/, 'focus is visible on the drawn circle');
  assert.match(rule('.radio-other-row'), /border-left:4px solid var\(--border\)/, 'the conditional reveal is indented under Other');
});
