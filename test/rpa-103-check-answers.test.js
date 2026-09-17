'use strict';

// RPA-103. Check your answers, per section. Save and continue on a complete
// section does not leave it yet: the same step turns into the design
// system's check-answers page, a summary list of every question in the
// section, answered or not, with a Change link on each row, and Continue
// moves on. Change returns to the answers with focus on that field, and the
// next Save and continue brings the check page back. Gus's placement
// (11 September 2026): a check page after each section, before the next,
// with Change returning to the check page rather than the start. The URL
// and the draft carry the mode, so a reload lands on the check page too.
// It does not print.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, toCheckPage, withFieldUncommented } = require('./app-harness');
// Hypothesis is dormant (RPA-117); the answers-as-given test brings it back for its optional row.
const WITH_HYPOTHESIS = withFieldUncommented(fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'), 'hypothesis');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const checking = (step) => step.classList.contains('step-checking');
const panelOf = (step) => Array.from(step.children).find((c) => c.classList.contains('check-answers'));
const valueText = (dd) => dd.querySelector('.summary-items') ? Array.from(dd.querySelectorAll('li')).map(text).join(' ') : text(dd);
const rowsOf = (step) => Array.from(panelOf(step).querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), valueText(r.querySelector('.summary-value'))]);
const changeFor = (step, label) => Array.from(panelOf(step).querySelectorAll('.summary-change')).find((b) => text(b) === 'Change ' + label);
const draftOf = (window) => JSON.parse(window.localStorage.getItem('research-plan-app:draft') || 'null');
async function onStep(app, slug) {
  app.window.location.hash = '#' + slug;
  await waitFor(() => visible(app.document)[0] === slug);
  return steps(app.document).find((s) => s.dataset.stepSlug === slug);
}
async function contextFilled(app) {
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  saveAndContinue(plan);
  await waitFor(() => visible(d)[0] === 'context');
  setValue(window, d.querySelector('[data-field="background"]'), 'Checkout has a new basket.');
  setValue(window, d.querySelector('[data-field="goal"]'), 'Fewer abandoned baskets.');
  setValue(window, d.querySelector('[data-field="problemStatement"]'), 'Nobody knows why people leave.');
  return steps(d)[2];
}

test('Save and continue on a complete section shows Check your answers on the same step: every question, answered or not, a Change on each row', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const context = await contextFilled(app);
  toCheckPage(context);
  assert.deepEqual(visible(d), ['context'], 'the same step, not the next');
  assert.ok(checking(context));
  const panel = panelOf(context);
  assert.equal(panel.hidden, false);
  assert.equal(text(panel.querySelector('.check-heading')), 'Check your answers');
  assert.equal(text(panel.querySelector('.check-sub')), 'Context');
  assert.equal(d.activeElement, panel.querySelector('.check-heading'), 'focus moves to the heading');
  assert.deepEqual(rowsOf(context), [
    ['Background', 'Checkout has a new basket.'],
    ['Goal', 'Fewer abandoned baskets.'],
    ['Problem Statement', 'Nobody knows why people leave.'],
    ['Additional information', 'Not provided'],
  ], 'every question of the section, the empty hatch included');
  assert.ok(changeFor(context, 'Goal'), 'a Change on each row, naming its question for a screen reader');
  assert.equal(window.location.hash, '#context/check');
  assert.equal(draftOf(window).ui.section, 'context/check', 'the draft remembers the check page');
  assert.deepEqual(app.jsdomErrors, []);
});

test('Change returns to the answers with focus on that field; the next Save and continue brings the check page back with the new answer', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const context = await contextFilled(app);
  toCheckPage(context);
  changeFor(context, 'Goal').click();
  assert.equal(checking(context), false);
  assert.equal(panelOf(context).hidden, true);
  assert.deepEqual(visible(d), ['context']);
  assert.equal(d.activeElement, d.querySelector('[data-field="goal"]'), 'focus lands in the field to change');
  assert.equal(window.location.hash, '#context/2', 'the page that holds the answer (RPA-108)');
  setValue(window, d.querySelector('[data-field="goal"]'), 'Half the abandoned baskets.');
  toCheckPage(context);
  assert.ok(checking(context), 'back to the check page, not the start');
  assert.equal(rowsOf(context)[1][1], 'Half the abandoned baskets.');
});

test('Continue moves on; Back from the next section returns to the check page; Back on the check page returns to the answers', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const context = await contextFilled(app);
  toCheckPage(context);
  panelOf(context).querySelector('.check-continue').click();
  assert.deepEqual(visible(d), ['research']);
  assert.equal(window.location.hash, '#research');
  steps(d)[3].querySelector('.step-back').click();
  assert.deepEqual(visible(d), ['context']);
  assert.ok(checking(context), 'Back lands on the check page it left');
  assert.equal(window.location.hash, '#context/check');
  context.querySelector('.step-back').click();
  assert.equal(checking(context), false, 'Back on the check page shows the answers again');
  assert.deepEqual(visible(d), ['context']);
  assert.equal(window.location.hash, '#context/3', 'the last page, where Save and continue was pressed (RPA-108)');
  context.querySelector('.step-back').click();
  context.querySelector('.step-back').click();
  assert.equal(window.location.hash, '#context', 'Back walks the pages first (RPA-108)');
  context.querySelector('.step-back').click();
  assert.deepEqual(visible(d), ['plan-details'], 'and from the first page, the section before');
});

test('a reload lands on the check page, and the URL can ask for it', async (t) => {
  const source = await bootApp({});
  t.after(() => source.close());
  const context = await contextFilled(source);
  toCheckPage(context);
  const draft = draftOf(source.window);
  assert.equal(draft.ui.section, 'context/check');
  const reloaded = await bootApp({ draft });
  t.after(() => reloaded.close());
  assert.deepEqual(visible(reloaded.document), ['context']);
  assert.ok(checking(steps(reloaded.document)[2]), 'the check page, as left');
  assert.equal(rowsOf(steps(reloaded.document)[2])[0][1], 'Checkout has a new basket.', 'drawn from the restored answers');
  const asked = await bootApp({ draft, url: 'https://research-plan.test/#plan-details/check' });
  t.after(() => asked.close());
  assert.deepEqual(visible(asked.document), ['plan-details']);
  assert.ok(checking(steps(asked.document)[1]), 'a hash can ask for the check page of a reachable section');
});

test('answers are shown as given: a date in words, a radio by its label, a list by its rows, methods by their question, an optional field left blank', async (t) => {
  const app = await bootApp({ textAssets: { 'research-plan-template.md': WITH_HYPOTHESIS } });
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Usability testing of checkout flow');
  toCheckPage(plan);
  const planRows = Object.fromEntries(rowsOf(plan));
  assert.equal(planRows['Research title'], 'Usability testing of checkout flow');
  assert.equal(planRows['Project decision'], '1 October 2026', 'a date in words');
  assert.equal(planRows['Last updated'], undefined, 'the computed dateline is not a question');
  panelOf(plan).querySelector('.check-continue').click();
  const context = steps(d)[2];
  completeStep(app, context);
  saveAndContinue(context);
  const research = steps(d)[3];
  completeStep(app, research);
  const rq = d.querySelector('.list-rows[data-list-key="researchQuestions"]');
  setValue(window, rq.querySelector('.list-input'), 'Why do people leave?');
  rq.closest('.field').querySelector('.add-btn').click();
  setValue(window, rq.querySelectorAll('.list-input')[1], 'What do they expect?');
  toCheckPage(research);
  const researchRows = Object.fromEntries(rowsOf(research));
  assert.equal(researchRows['Research Questions'], 'Why do people leave? What do they expect?', 'a list by its rows');
  assert.equal(researchRows['Hypothesis'], 'Not provided', 'an optional field left blank says so');
  panelOf(research).querySelector('.check-continue').click();
  // Two studies, one question each (RPA-142), so each has rows of its own.
  const studies = steps(d)[4];
  studies.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  const studyGroups = studies.querySelectorAll('.study-group');
  studyGroups[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups[1].querySelectorAll('.study-question-input')[1].click();
  saveAndContinue(studies);
  const methodology = steps(d)[5];
  completeStep(app, methodology);
  toCheckPage(methodology);
  const methodologyRows = Object.fromEntries(rowsOf(methodology));
  assert.equal(methodologyRows['Sample Size for Study 1'], 'Small (1–5)', 'a radio by its label');
  assert.equal(methodologyRows['Methods for Study 1'], 'Filled.', 'methods for that study');
  assert.equal(methodologyRows['Methods for Study 2'], 'Filled.', 'the second study has rows of its own');
});

test('the check page does not print, and Change from the review step lands on the answers, not the check page', async (t) => {
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.check-answers/, 'in the print hide-list');
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const context = await contextFilled(app);
  toCheckPage(context);
  panelOf(context).querySelector('.check-continue').click();
  const change = Array.from(d.querySelectorAll('.review-change')).find((b) => b.getAttribute('aria-label') === 'Change Context');
  change.click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(checking(context), false, 'Review sends people to the answers');
});
