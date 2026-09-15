'use strict';

// RPA-122. A page reads down. Two questions asked together on one page
// (the two plan dates; each research question with its outcomes) sit one
// under the other, never side by side: on screen the header's grid is a
// single column within a step, while print keeps the document's two-column
// header. The pairing itself, from RPA-108, is unchanged.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const onScreen = (step) => Array.from(step.querySelectorAll('.title-field, .mf, .field')).filter((u) => !u.classList.contains('page-hidden') && !u.closest('.page-hidden') && !u.classList.contains('field-methods') && !u.querySelector('[data-field="lastUpdated"]'));

test('on screen, a step\'s header grid is one column, so the two dates stack; print keeps the two-column header', () => {
  const screen = CSS.match(/@media screen\{\.step \.meta-grid\{([^}]*)\}\}/);
  assert.ok(screen, 'a screen-only rule for the header grid inside a step');
  assert.match(screen[1], /grid-template-columns:1fr(?:;|$)/, 'one column');
  assert.match(CSS.match(/\n\.meta-grid\{([^}]*)\}/)[1], /grid-template-columns:1fr 1fr/, 'the document\'s header keeps two columns, which is what prints');
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.doesNotMatch(print, /meta-grid/, 'print does not touch it');
});

test('the dates page still asks both dates together, decision above readout in the order a page is read', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#plan-details';
  await waitFor(() => visible(d)[0] === 'plan-details');
  const plan = steps(d)[1];
  completeStep(app, plan);
  for (let k = 0; k < 4; k++) plan.querySelector('.step-continue').click();
  assert.equal(text(plan.querySelector('.step-page-caption')), 'Question 5 of 5');
  const shown = onScreen(plan);
  assert.deepEqual(shown.map((u) => text(u.querySelector('.mlabel'))), ['Project decision', 'Research readout'], 'still paired');
  assert.ok(shown[0].compareDocumentPosition(shown[1]) & 4, 'decision comes first in the document, so first down the page');
  assert.equal(shown[0].closest('.meta-grid'), shown[1].closest('.meta-grid'), 'in the one grid that the screen rule makes a single column');
  assert.deepEqual(app.jsdomErrors, []);
});
