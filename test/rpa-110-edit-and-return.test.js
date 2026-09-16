'use strict';

// RPA-110. Edit any answer at any time, and come back to where you were.
// The review step lists every part of the plan, Plan details included, and
// each row can reveal its answers on demand in the check page's shape, a
// Change on every row. A Change from the review step lands in the field;
// the section's next Save and continue returns to the review step and to
// that row, not onward. Leaving the section any other way forgets the
// return path. The revealed answers stay revealed as the plan redraws, and
// do not print.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, toCheckPage } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const checking = (step) => step.classList.contains('step-checking');
const rowOf = (review, slug) => review.querySelector('.review-row[data-slug="' + slug + '"]');
const answersOf = (review, slug) => review.querySelector('.review-answers[data-slug="' + slug + '"]');
const reveal = (details) => { details.open = true; details.dispatchEvent(new details.ownerDocument.defaultView.Event('toggle')); };
const valueText = (dd) => dd.querySelector('.summary-items') ? Array.from(dd.querySelectorAll('li')).map(text).join(' ') : text(dd);
const rowsOf = (details) => Array.from(details.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), valueText(r.querySelector('.summary-value'))]);
const changeIn = (details, label) => Array.from(details.querySelectorAll('.summary-change')).find((b) => text(b) === 'Change ' + label);
async function reachReview(app) {
  const d = app.document;
  for (const i of [1, 2, 3, 4, 5, 6]) {
    app.window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => visible(d)[0] === steps(d)[i].dataset.stepSlug);
    completeStep(app, steps(d)[i]);
  }
  app.window.location.hash = '#review';
  await waitFor(() => visible(d)[0] === 'review');
  return stepOf(d, 'review');
}

test('Change from the review step lands in the section; its Save and continue returns to the review step and that row, not onward', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  rowOf(review, 'context').querySelector('.review-change').click();
  const context = stepOf(d, 'context');
  assert.deepEqual(visible(d), ['context']);
  assert.equal(checking(context), false, 'the answers, not the check page');
  assert.equal(d.activeElement, d.querySelector('[data-field="background"]'), 'the first control');
  setValue(window, d.querySelector('[data-field="background"]'), 'Edited from the review step.');
  context.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['review'], 'back where they were');
  assert.equal(window.location.hash, '#review');
  assert.equal(d.activeElement, rowOf(review, 'context'), 'and on the row they left from');
  assert.ok(checking(context), 'the section is left as a completed one is: on its check page');
  await new Promise((r) => setTimeout(r, 200));   // past the review list's debounced redraw
  assert.equal(d.activeElement, rowOf(review, 'context'), 'and still there once the list has redrawn itself');
  assert.deepEqual(app.jsdomErrors, []);
});

test('pressing Show answers keeps focus on it through the redraw the press itself schedules', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  const summary = answersOf(review, 'research').querySelector('summary');
  summary.focus();
  summary.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  reveal(answersOf(review, 'research'));
  await new Promise((r) => setTimeout(r, 200));
  const after = answersOf(review, 'research');
  assert.equal(after.open, true);
  assert.equal(d.activeElement, after.querySelector('summary'), 'focus survives the redraw');
  changeIn(after, 'Outcomes').focus();
  d.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(d.activeElement, changeIn(answersOf(review, 'research'), 'Outcomes'), 'so does a Change a person tabbed to');
});

test('a delayed disclosure toggle does not replace the Change button that has focus', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const review = await reachReview(app);
  const details = answersOf(review, 'research');
  reveal(details);
  const change = changeIn(details, 'Outcomes');
  change.focus();
  // Native toggle delivery can follow the eager draw that restores an open
  // disclosure, or a synthetic toggle used by an interaction harness.
  details.dispatchEvent(new app.window.Event('toggle'));
  assert.equal(app.document.activeElement, change);
  assert.equal(changeIn(details, 'Outcomes'), change, 'the already current answer rows keep their controls');
});

test('the return path is one-shot and only for that section: the next Save and continue goes to the check page as usual', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  rowOf(review, 'context').querySelector('.review-change').click();
  stepOf(d, 'context').querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['review']);
  window.location.hash = '#context';
  await waitFor(() => visible(d)[0] === 'context');
  const context = stepOf(d, 'context');   // a plain hash asks for the answers, not the check page
  assert.equal(checking(context), false);
  toCheckPage(context);
  assert.deepEqual(visible(d), ['context'], 'no return path left: the check page, as usual');
  assert.ok(checking(context));
});

test('leaving the section by Back, the list or a link forgets the return path', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  rowOf(review, 'research').querySelector('.review-change').click();
  assert.deepEqual(visible(d), ['research']);
  stepOf(d, 'research').querySelector('.step-back').click();
  assert.deepEqual(visible(d), ['context']);
  window.location.hash = '#research';
  await waitFor(() => visible(d)[0] === 'research');
  const research = stepOf(d, 'research');
  assert.equal(checking(research), false, 'a plain hash asks for the answers');
  toCheckPage(research);
  assert.deepEqual(visible(d), ['research'], 'Back forgot the return path: the check page, not the review step');
  assert.ok(checking(research));
});

test('each row can reveal its answers in the check page\'s shape, closed until asked, with Change on every answer', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  const details = answersOf(review, 'context');
  assert.equal(details.tagName, 'DETAILS');
  assert.equal(details.open, false, 'closed until asked');
  assert.equal(text(details.querySelector('summary')), 'Show answers for Context');
  assert.equal(details.querySelectorAll('.summary-row').length, 0, 'nothing drawn until asked');
  reveal(details);
  assert.equal(text(details.querySelector('summary')), 'Hide answers for Context');
  assert.deepEqual(rowsOf(details), [['Background', 'Filled.'], ['Goal', 'Filled.'], ['Problem Statement', 'Filled.'], ['Additional information', 'Not provided']]);
  changeIn(details, 'Goal').click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(d.activeElement, d.querySelector('[data-field="goal"]'), 'straight to that answer');
  setValue(window, d.querySelector('[data-field="goal"]'), 'A sharper goal.');
  stepOf(d, 'context').querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['review']);
  const again = answersOf(review, 'context');
  assert.equal(again.open, true, 'still revealed after the redraw');
  assert.equal(rowsOf(again)[1][1], 'A sharper goal.', 'and current');
  assert.equal(d.activeElement, rowOf(review, 'context'));
});

test('Plan details is on the review step too, answers and all, and Change there comes back as well', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const review = await reachReview(app);
  assert.deepEqual(Array.from(review.querySelectorAll('.review-row')).map((r) => r.dataset.slug), ['plan-details', 'context', 'research', 'studies', 'methodology', 'execution']);
  assert.equal(text(rowOf(review, 'plan-details').querySelector('.review-name')), 'Plan details');
  const details = answersOf(review, 'plan-details');
  reveal(details);
  assert.deepEqual(rowsOf(details).map((r) => r[0]), ['Research title', 'Jira Project', 'Lead researcher', 'Project requester', 'Project decision', 'Research readout']);
  changeIn(details, 'Lead researcher').click();
  assert.deepEqual(visible(d), ['plan-details']);
  assert.equal(d.activeElement, d.querySelector('[data-field="leadResearcher"]'));
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Gus Berumen');
  stepOf(d, 'plan-details').querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['review']);
  assert.equal(rowsOf(answersOf(review, 'plan-details'))[2][1], 'Gus Berumen');
  rowOf(review, 'plan-details').querySelector('.review-change').click();
  assert.deepEqual(visible(d), ['plan-details']);
  assert.equal(d.activeElement, d.querySelector('[data-field="researchTitle"]'), 'the section-level Change lands on the first control');
});

test('the revealed answers do not print', () => {
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.review-answers/, 'in the print hide-list');
});
