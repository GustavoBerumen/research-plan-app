'use strict';

// RPA-100. The first thing a person sees is the list of sections, on the
// GOV.UK task-list pattern: each with its state — Not yet started,
// Incomplete, Completed — and locked ("Cannot start yet") until every
// section before it is complete. A completed section can always be
// returned to. A locked section refuses a link, a hash and Continue.
// Completeness counts required fields only: an optional Hypothesis must not
// hold everyone at Research.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const rows = (d) => Array.from(d.querySelectorAll('.task-item')).map((li) => ({
  name: text(li.querySelector('.task-name')), status: text(li.querySelector('.task-status')),
  linked: li.querySelector('.task-name').tagName === 'BUTTON',
}));
const statusOf = (d, name) => rows(d).find((r) => r.name === name);
const settle = (d) => waitFor(() => d.querySelectorAll('.task-item').length === 6).then(() => new Promise((r) => setTimeout(r, 160)));

test('the list is first, names the six sections, and at the start only Plan details can be started', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.deepEqual(visible(d), ['sections']);
  assert.equal(text(d.querySelector('.task-list-step .step-heading')), 'Your research plan');
  assert.deepEqual(rows(d).map((r) => r.name), ['Plan details', 'Context', 'Research', 'Methodology', 'Execution', 'Review']);
  assert.deepEqual(rows(d).map((r) => r.status), ['Not yet started', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet']);
  assert.deepEqual(rows(d).map((r) => r.linked), [true, false, false, false, false, false], 'only what can be started is a link');
  assert.equal(text(d.querySelector('.task-list-progress')), 'You have completed 0 of 6 sections.');
  assert.deepEqual(app.jsdomErrors, []);
});

test('completing a section unlocks the next; starting one reads as Incomplete; the count follows', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  statusOf(d, 'Plan details');
  d.querySelector('.task-item .task-link').click();
  assert.deepEqual(visible(d), ['plan-details']);
  completeStep(app, steps(d)[1]);
  await settle(d);
  assert.equal(statusOf(d, 'Plan details').status, 'Completed');
  assert.equal(statusOf(d, 'Context').status, 'Not yet started');
  assert.equal(statusOf(d, 'Context').linked, true);
  assert.equal(statusOf(d, 'Research').status, 'Cannot start yet', 'one at a time');
  assert.equal(text(d.querySelector('.task-list-progress')), 'You have completed 1 of 6 sections.');

  setValue(window, d.querySelector('[data-field="background"]'), 'Started.');
  await settle(d);
  assert.equal(statusOf(d, 'Context').status, 'Incomplete');
});

test('a locked section refuses a link and a hash, and Save and continue holds an incomplete section', async (t) => {
  // What Save and continue says when it holds is RPA-102 and RPA-113's, tested there.
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#research';
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(visible(d), ['sections'], 'a hash into a locked section is refused');

  window.location.hash = '#plan-details';
  await waitFor(() => visible(d)[0] === 'plan-details');
  const nav = steps(d)[1];
  nav.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['plan-details'], 'incomplete: it stays');
  completeStep(app, nav);
  nav.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['context'], 'complete: it goes on');
});

test('optional fields do not count: Research completes without a Hypothesis, and the review summary agrees', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  for (const i of [1, 2, 3]) { app.window.location.hash = '#' + steps(d)[i].dataset.stepSlug; completeStep(app, steps(d)[i]); }
  await settle(d);
  assert.equal(d.querySelector('[data-field="hypothesis"]').value, '', 'Hypothesis untouched');
  assert.equal(statusOf(d, 'Research').status, 'Completed');
  const row = Array.from(d.querySelectorAll('.review-row')).find((r) => text(r.querySelector('.review-name')) === 'Research');
  assert.ok(row.querySelector('.review-tick-done'), 'the review step reads Research as complete too');
});

test('every step has a way back to the list, and a completed section stays open to return to', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  app.window.location.hash = '#plan-details';
  await waitFor(() => visible(d)[0] === 'plan-details');
  completeStep(app, steps(d)[1]);
  steps(d)[1].querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['context']);
  steps(d)[2].querySelector('.step-all').click();
  assert.deepEqual(visible(d), ['sections']);
  await settle(d);
  assert.equal(statusOf(d, 'Plan details').linked, true, 'completed, and still a link');
  Array.from(d.querySelectorAll('.task-link')).find((b) => text(b) === 'Plan details').click();
  assert.deepEqual(visible(d), ['plan-details']);
});
