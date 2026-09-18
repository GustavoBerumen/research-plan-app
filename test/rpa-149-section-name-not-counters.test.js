'use strict';

// RPA-149. Every question page opened with two lines of position under the
// Back link: "Section 3 of 7" and "Question 1 of 2". Neither is what the
// person came to read, and the second total climbed while they were partway
// through: each research question and each study brings pages with it.
//
// Decided 17 September 2026 (Gus): context only. The section's name says
// where the person is, and no number does. Every page already carried the
// name as its heading, and the check page under its own, so both counters
// go and nothing replaces them on screen. With them goes the count of fields
// beside the section's name ("Context 3 fields"), which one question per
// page had left with nothing to count; print keeps it. How much is left is
// the task list's to say, one press away on All sections.
//
// What is held for a screen reader is better than before: the question that
// takes focus on each page change is described by its section, and the
// page's title names the section too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, completeStep, pagePosition, pageCount } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const steps = (d) => Array.from(d.querySelectorAll('.step')).filter((s) => !s.classList.contains('task-list-step'));
const stepOf = (d, slug) => d.querySelector('[data-step-slug="' + slug + '"]');
async function finish(app, step) {
  completeStep(app, step);
  app.window.location.hash = '#' + step.dataset.stepSlug + '/99';
  await settle();
  for (let i = 0; i < 10 && !step.classList.contains('step-checking'); i++) { step.querySelector('.step-continue').click(); await settle(100); }
  assert.ok(step.classList.contains('step-checking'), step.dataset.stepSlug + ' completes');
}

test('no step counts itself: Back and All sections, and the section\'s name as the heading', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.equal(d.querySelector('.step-caption, .step-page-caption'), null, 'the two captions are gone, not emptied');
  for (const step of steps(d)) {
    const top = step.querySelector('.step-top');
    assert.deepEqual(Array.from(top.children).map((c) => c.className), ['step-back', 'step-all'], step.dataset.stepSlug + ': what is left at the top');
    assert.doesNotMatch(text(top), /\d/, 'and no number in it');
    const name = step.querySelector('.step-heading, .acc-title, .review-h');
    assert.equal(text(name), step.dataset.stepTitle, step.dataset.stepSlug + ' is named by its heading');
  }
  assert.doesNotMatch(APP, /'Section ' \+|'Question ' \+ \(/, 'and nothing in the code words a count');
  assert.match(CSS, /@media screen\{\.acc\.step \.acc-count\{display:none\}\}/, 'the section\'s count of fields is off the screen, and only the screen');
  assert.match(text(d.querySelector('.task-list-progress')), /^You have completed \d of 7 sections\.$/, 'how much is left is said where the whole plan is in view');
});

test('the form still knows the page and how many there are, and says so in the URL, though nothing on screen counts', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = d.querySelector('.doc-header');
  window.location.hash = '#plan-details/2';
  await settle();
  assert.deepEqual([pagePosition(plan), pageCount(app, plan)], [2, 7]);
  d.querySelector('.select-cell[data-field-key="otherResearchers"] input[value="Yes"]').click();
  await settle();
  assert.equal(pageCount(app, plan), 8, 'a page is added while the person is partway through: the moving total that is no longer shown');
  plan.querySelector('.step-continue').click();
  await settle();
  assert.equal(window.location.hash, '#plan-details/2', 'an empty page stays, as before');
  setValue(window, d.querySelector('[data-field="jiraProject"]'), 'Checkout redesign');
  plan.querySelector('.step-continue').click();
  await settle();
  assert.equal(window.location.hash, '#plan-details/3', 'the URL carries the page, and reload lands on it');
  plan.querySelector('.step-back').click();
  await settle();
  assert.equal(pagePosition(plan), 2, 'Back works as it did');
  plan.querySelector('.step-all').click();
  await settle();
  assert.equal(d.querySelector('.task-list-step').hidden, false, 'and so does All sections');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the pages that never had a number say what they are: Additional information by its label, the check page by its heading and its section', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await finish(app, d.querySelector('.doc-header'));
  const context = stepOf(d, 'context');
  await finish(app, context);
  const check = context.querySelector('.check-answers');
  assert.equal(text(check.querySelector('.check-heading')), 'Check your answers');
  assert.equal(text(check.querySelector('.check-sub')), 'Context', 'the check page names its section, since the section\'s own heading is put away there');
  assert.equal(d.title, 'Check your answers – Context – Research Plan');

  Array.from(context.querySelectorAll('.summary-change')).find((b) => text(b) === 'Change Additional information').click();
  await settle();
  assert.equal(pagePosition(context), 'more');
  assert.equal(window.location.hash, '#context/more');
  const shown = Array.from(context.querySelectorAll('.field')).filter((f) => !f.classList.contains('page-hidden') && !f.closest('.page-hidden'));
  assert.deepEqual(shown.map((f) => text(f.querySelector('.flabel'))), ['Additional information'], 'its own label is its name; the caption that repeated it is gone');
  assert.equal(text(context.querySelector('.acc-title')), 'Context');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a screen reader hears the section with every question, and the page\'s title names it', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  assert.equal(d.title, 'Research Plan', 'the task list is the plan itself');
  const plan = d.querySelector('.doc-header');
  window.location.hash = '#plan-details/1';
  await settle();
  assert.equal(d.title, 'Plan details – Research Plan');
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout');
  plan.querySelector('.step-continue').click();
  await settle();
  const focused = d.activeElement;
  assert.equal(text(focused), 'Which project or initiative does this research support?', 'focus goes to the question, as before');
  const described = (focused.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => text(d.getElementById(id)));
  assert.ok(described.includes('Plan details'), 'and the question is described by its section: ' + JSON.stringify(described));
  plan.querySelector('.step-back').click();
  await settle();
  plan.querySelector('.step-continue').click();
  await settle();
  assert.equal((d.activeElement.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => /^step-name-/.test(id)).length, 1, 'once, however many times the page is visited');

  await finish(app, plan);
  const context = stepOf(d, 'context');
  window.location.hash = '#context/1';
  await settle();
  assert.equal(d.title, 'Context – Research Plan');
  assert.equal(text(d.activeElement.querySelector('.acc-title')), 'Context', 'arriving at a section, focus is on its heading, which names it');
  setValue(window, d.querySelector('[data-field="background"]'), 'Checkout was rebuilt in June.');
  context.querySelector('.step-continue').click();
  await settle();
  assert.equal(d.activeElement, context.querySelector('#field-goal-label'), 'moving on a page, focus is on the question');
  assert.ok((d.activeElement.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => text(d.getElementById(id))).includes('Context'), 'which its section describes');
  context.querySelector('.step-all').click();
  await settle();
  assert.equal(d.title, 'Research Plan', 'back on the task list, the plan\'s own title');
  assert.deepEqual(app.jsdomErrors, []);
});
