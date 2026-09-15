'use strict';

// RPA-108. One question per page, or one set whose answers depend on each
// other. Within a step, Save and continue walks the pages: the two plan
// dates travel together, each research question with its outcomes,
// everything else one at a time. Methodology loops per research question
// with that question pinned above its pages. Additional information is
// not a page in the flow: the check page's Change opens it on its own, and
// Save and continue there returns to the check page. A page judges its own
// questions; the last page judges the whole section, and a summary link
// opens the page that holds the field. The page is carried in the URL and
// the draft. Every page prints. Gus's field-placement table, 14 September
// 2026; Research is not in the table, so its questions pair with their
// outcomes as the ticket proposed and Objective stands alone.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const onScreen = (step) => Array.from(step.querySelectorAll('.title-field, .mf, .field')).filter((u) => !u.classList.contains('page-hidden') && !u.closest('.page-hidden') && !u.classList.contains('field-methods') && !u.querySelector('[data-field="lastUpdated"]')).map((u) => text(u.querySelector('.flabel, .mlabel, label')));
const caption = (step) => text(step.querySelector('.step-page-caption'));
const checking = (step) => step.classList.contains('step-checking');
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const press = (step) => step.querySelector('.step-continue').click();
const draftOf = (window) => JSON.parse(window.localStorage.getItem('research-plan-app:draft') || 'null');
async function onStep(app, slug) {
  app.window.location.hash = '#' + slug;
  await waitFor(() => visible(app.document)[0] === slug);
  return stepOf(app.document, slug);
}
async function reach(app, slug) {
  const d = app.document;
  for (const s of steps(d).slice(1)) {
    if (s.dataset.stepSlug === slug) break;
    await onStep(app, s.dataset.stepSlug);
    completeStep(app, s);
    saveAndContinue(s);
  }
  return onStep(app, slug);
}

test('Plan details asks one question per page, the two dates together, and Back walks the pages', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  // The email address opens the section since RPA-99, ahead of the title.
  assert.deepEqual(onScreen(plan), ['Email address']);
  assert.equal(caption(plan), 'Question 1 of 6');
  press(plan);
  assert.deepEqual(linksOf(plan), ['Enter your email address'], 'the page judges its own question only');
  setValue(window, d.querySelector('[data-field="emailAddress"]'), 'gus@example.com');
  press(plan);
  assert.deepEqual(onScreen(plan), ['Research title']);
  assert.equal(caption(plan), 'Question 2 of 6');
  press(plan);
  assert.deepEqual(linksOf(plan), ['Enter the research title'], 'the title page judges the title alone');
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Usability testing of checkout flow');
  press(plan);
  assert.deepEqual(onScreen(plan), ['Jira Project']);
  assert.equal(caption(plan), 'Question 3 of 6');
  assert.equal(window.location.hash, '#plan-details/3');
  assert.equal(d.activeElement, plan.querySelector('#field-jiraProject-label'), 'focus lands on the question');
  for (const key of ['jiraProject', 'leadResearcher', 'projectRequester']) { setValue(window, d.querySelector('[data-field="' + key + '"]'), 'Filled'); press(plan); }
  assert.deepEqual(onScreen(plan), ['Project decision', 'Research readout'], 'the two dates travel together');
  assert.equal(caption(plan), 'Question 6 of 6');
  plan.querySelector('.step-back').click();
  assert.deepEqual(onScreen(plan), ['Project requester']);
  assert.equal(window.location.hash, '#plan-details/5');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the last page judges the whole section, and a summary link opens the page that holds the field', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  press(plan); press(plan); press(plan); press(plan); press(plan);
  assert.equal(caption(plan), 'Question 6 of 6');
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), '');
  press(plan);
  assert.deepEqual(visible(d), ['plan-details'], 'stays');
  assert.deepEqual(linksOf(plan), ['Enter the lead researcher']);
  plan.querySelector('.error-summary-link').click();
  assert.deepEqual(onScreen(plan), ['Lead researcher'], 'the link opened its page');
  assert.equal(d.activeElement, d.querySelector('[data-field="leadResearcher"]'));
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Gus');
  assert.equal(plan.querySelector('.error-summary').hidden, true, 'the error goes as the field is filled');
  press(plan);
  assert.deepEqual(onScreen(plan), ['Project requester'], 'on to the next page from there');
  press(plan);
  assert.deepEqual(onScreen(plan), ['Project decision', 'Research readout']);
  press(plan);
  assert.ok(checking(plan), 'and the check page after the last');
});

test('Context has three pages; Additional information is not one, but the check page\'s Change opens it and Save and continue returns there', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const context = await reach(app, 'context');
  assert.deepEqual(onScreen(context), ['Background']);
  assert.equal(caption(context), 'Question 1 of 3');
  completeStep(app, context);
  press(context); press(context);
  assert.deepEqual(onScreen(context), ['Problem Statement']);
  press(context);
  assert.ok(checking(context));
  const change = Array.from(context.querySelectorAll('.summary-change')).find((b) => text(b) === 'Change Additional information');
  change.click();
  assert.equal(checking(context), false);
  assert.deepEqual(onScreen(context), ['Additional information'], 'on its own, outside the flow');
  assert.equal(caption(context), 'Additional information');
  assert.equal(window.location.hash, '#context/more');
  press(context);
  assert.ok(checking(context), 'straight back to the check page');
  context.querySelector('.step-back').click();
  assert.deepEqual(onScreen(context), ['Problem Statement'], 'Back from the check page: the last page');
});

test('Research pairs each question with its outcomes; Methodology loops per research question with the question pinned', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const research = await reach(app, 'research');
  assert.equal(caption(research), 'Question 1 of 2');
  assert.deepEqual(onScreen(research), ['Objective']);
  completeStep(app, research);
  const rq = d.querySelector('.list-rows[data-list-key="researchQuestions"]');
  setValue(window, rq.querySelector('.list-input'), 'Why do people leave?');
  rq.closest('.field').querySelector('.add-btn').click();
  setValue(window, rq.querySelectorAll('.list-input')[1], 'What do they expect?');
  setValue(window, d.querySelectorAll('.list-rows[data-list-key="outcomes"] .list-input')[1], 'Expectations mapped.');
  press(research);
  assert.deepEqual(onScreen(research), ['Research Questions', 'Outcomes'], 'a question and its outcomes together');
  press(research);
  assert.ok(checking(research));
  research.querySelector('.check-continue').click();
  const methodology = stepOf(d, 'methodology');
  assert.deepEqual(visible(d), ['methodology']);
  assert.equal(caption(methodology), 'Question 1 of 8', 'four fields, twice');
  assert.deepEqual(onScreen(methodology), ['Methods for research question 1']);
  const groups = Array.from(methodology.querySelectorAll('.methods-group'));
  assert.equal(groups[0].classList.contains('page-hidden'), false);
  assert.equal(groups[1].classList.contains('page-hidden'), true, 'the other question waits');
  assert.equal(text(groups[0].querySelector('.methods-group-text')), 'Why do people leave?', 'pinned above the page');
  for (let k = 0; k < 4; k++) { completeStep(app, methodology); press(methodology); }
  assert.equal(caption(methodology), 'Question 5 of 8');
  assert.deepEqual(onScreen(methodology), ['Methods for research question 2']);
  assert.equal(groups[0].classList.contains('page-hidden'), true);
  assert.equal(text(groups[1].querySelector('.methods-group-text')), 'What do they expect?');
});

test('the page is remembered in the URL and the draft; a reload lands on it; Change from the check page opens the page that holds the answer', async (t) => {
  const source = await bootApp({});
  t.after(() => source.close());
  const context = await reach(source, 'context');
  completeStep(source, context);
  press(context);
  assert.equal(source.window.location.hash, '#context/2');
  const draft = draftOf(source.window);
  assert.equal(draft.ui.section, 'context/2');
  const again = await bootApp({ draft });
  t.after(() => again.close());
  const back = stepOf(again.document, 'context');
  assert.deepEqual(visible(again.document), ['context']);
  assert.deepEqual(onScreen(back), ['Goal'], 'page 2, as left');
  press(back); press(back);
  assert.ok(checking(back));
  Array.from(back.querySelectorAll('.summary-change')).find((b) => text(b) === 'Change Goal').click();
  assert.deepEqual(onScreen(back), ['Goal'], 'the page that holds the answer, not the first or the last');
  assert.equal(again.document.activeElement, again.document.querySelector('[data-field="goal"]'));
  press(back);
  assert.ok(checking(back), 'back to the check page after one press, not on to Problem Statement');
});

test('every page prints: what is off the page is hidden on screen only', () => {
  const screen = CSS.slice(CSS.indexOf('@media screen{.page-hidden'));
  assert.match(screen, /^@media screen\{\.page-hidden\{display:none!important\}\}/);
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.doesNotMatch(print, /page-hidden/);
});
