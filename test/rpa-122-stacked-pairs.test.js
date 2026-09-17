'use strict';

// RPA-122. A page reads down. Two questions asked together on one page
// (each research question with its outcomes) sit one under the other, never
// side by side: on screen the header's grid is a single column within a
// step, while print keeps the document's two-column header.
//
// The two plan dates were the other pair this was written for. RPA-144 gave
// each a page of its own, decision then readout; the single column stays,
// and what is held here now is the order, and that print is as it was.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const onScreen = (step) => Array.from(step.querySelectorAll('.title-field, .mf, .field')).filter((u) => !u.hidden && !u.classList.contains('page-hidden') && !u.closest('.page-hidden') && !u.classList.contains('field-methods') && !u.querySelector('[data-field="lastUpdated"]'));

test('on screen, a step\'s header grid is one column; print keeps the two-column header, the two dates side by side in it', () => {
  const screen = CSS.match(/@media screen\{\.step \.meta-grid\{([^}]*)\}\}/);
  assert.ok(screen, 'a screen-only rule for the header grid inside a step');
  assert.match(screen[1], /grid-template-columns:1fr(?:;|$)/, 'one column');
  assert.match(CSS.match(/\n\.meta-grid\{([^}]*)\}/)[1], /grid-template-columns:1fr 1fr/, 'the document\'s header keeps two columns, which is what prints');
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.doesNotMatch(print, /meta-grid/, 'print does not touch it');
});

test('the two dates are asked one per page since RPA-144, decision then readout, in the one grid that still prints as two columns', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#plan-details';
  await waitFor(() => visible(d)[0] === 'plan-details');
  const plan = steps(d)[1];
  completeStep(app, plan);
  for (let k = 0; k < 6; k++) plan.querySelector('.step-continue').click();   // eight pages with other researchers named (RPA-141)
  assert.equal(text(plan.querySelector('.step-page-caption')), 'Question 7 of 8');
  assert.deepEqual(onScreen(plan).map((u) => text(u.querySelector('.mlabel'))), ['When will the findings be used to make a decision?'], 'the decision, alone');
  plan.querySelector('.step-continue').click();
  assert.equal(text(plan.querySelector('.step-page-caption')), 'Question 8 of 8');
  assert.deepEqual(onScreen(plan).map((u) => text(u.querySelector('.mlabel'))), ['When will the findings be shared with the team?'], 'then the readout, alone');
  const decision = d.querySelector('[data-field="projectDecision"]').closest('.mf'), readout = d.querySelector('[data-field="researchReadout"]').closest('.mf');
  assert.ok(decision.compareDocumentPosition(readout) & 4, 'decision comes first in the document, so first in the flow and first in print');
  assert.equal(decision.closest('.meta-grid'), readout.closest('.meta-grid'), 'still neighbours in the header\'s grid: the printed plan shows them side by side, unchanged');
  assert.deepEqual(app.jsdomErrors, []);
});
