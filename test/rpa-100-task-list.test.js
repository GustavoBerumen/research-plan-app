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
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, withFieldUncommented } = require('./app-harness');
// Hypothesis is dormant (RPA-117); the optional-field test brings it back.
const WITH_HYPOTHESIS = withFieldUncommented(fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'), 'hypothesis');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const rows = (d) => Array.from(d.querySelectorAll('.task-item')).map((li) => ({
  name: text(li.querySelector('.task-name')), status: text(li.querySelector('.task-status')),
  linked: li.querySelector('.task-name').tagName === 'BUTTON',
}));
const statusOf = (d, name) => rows(d).find((r) => r.name === name);
const settle = (d) => waitFor(() => d.querySelectorAll('.task-item').length === 7).then(() => new Promise((r) => setTimeout(r, 160)));

test('editing an earlier answer preserves access to another completed section', async (t) => {
  const app = await bootApp(); t.after(() => app.close());
  const { document: d, window } = app;
  d.querySelector('.task-link').click();
  completeStep(app, steps(d)[1]);
  saveAndContinue(steps(d)[1]);
  completeStep(app, steps(d)[2]);
  saveAndContinue(steps(d)[2]);
  steps(d)[3].querySelector('.step-back').click();
  steps(d)[2].querySelector('.step-back').click();
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), '');
  steps(d)[1].querySelector('.step-all').click();
  assert.equal(statusOf(d, 'Context').status, 'Completed');
  assert.equal(statusOf(d, 'Context').linked, true);
  Array.from(d.querySelectorAll('.task-link')).find(b => text(b) === 'Context').click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(statusOf(d, 'Research').linked, false, 'unfinished later work remains locked');
});

test('fresh blocked fragments return to the task list without creating a draft', async (t) => {
  for (const slug of ['context', 'review']) {
    // Nothing is stored for merely arriving: the page asking for the email
    // address stands in front (RPA-99), and only what the person gives there is saved.
    const app = await bootApp({ url: 'https://research-plan.test/#' + slug, email: false });
    t.after(() => app.close());
    assert.deepEqual(visible(app.document), []);
    assert.equal(app.window.localStorage.getItem('research-plan-app:draft'), null);
    const gate = app.document.querySelector('.email-step');
    setValue(app.window, gate.querySelector('[data-field="emailAddress"]'), 'name@example.com');
    gate.querySelector('.step-continue').click();
    assert.deepEqual(visible(app.document), ['sections']);
    assert.equal(app.window.location.hash, '#sections');
    const draft = JSON.parse(app.window.localStorage.getItem('research-plan-app:draft'));
    assert.equal(draft.fields.emailAddress, 'name@example.com', 'the address is kept');
    assert.equal(draft.ui.section, 'sections');
  }
});

test('an incoming unlocked link is resolved against the restored answers', async (t) => {
  const source = await bootApp(); t.after(() => source.close());
  source.document.querySelector('.task-link').click();
  completeStep(source, steps(source.document)[1]);
  saveAndContinue(steps(source.document)[1]);
  const draft = JSON.parse(source.window.localStorage.getItem('research-plan-app:draft'));
  draft.ui.section = 'plan-details';
  const restored = await bootApp({ draft, url: 'https://research-plan.test/#context' });
  t.after(() => restored.close());
  assert.deepEqual(visible(restored.document), ['context']);
});

test('the list is first, names the seven sections, and at the start only Plan details can be started', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.deepEqual(visible(d), ['sections']);
  assert.equal(text(d.querySelector('.task-list-step .step-heading')), 'Your research plan');
  assert.deepEqual(rows(d).map((r) => r.name), ['Plan details', 'Context', 'Research', 'Studies', 'Methodology', 'Execution', 'Review']);
  assert.deepEqual(rows(d).map((r) => r.status), ['Not yet started', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet', 'Cannot start yet']);
  assert.deepEqual(rows(d).map((r) => r.linked), [true, false, false, false, false, false, false], 'only what can be started is a link');
  assert.equal(text(d.querySelector('.task-list-progress')), 'You have completed 0 of 7 sections.');
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
  assert.equal(text(d.querySelector('.task-list-progress')), 'You have completed 1 of 7 sections.');

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
  saveAndContinue(nav);
  assert.deepEqual(visible(d), ['plan-details'], 'incomplete: it stays');
  completeStep(app, nav);
  saveAndContinue(nav);
  assert.deepEqual(visible(d), ['context'], 'complete: it goes on');
});

test('optional fields do not count: Research completes without a Hypothesis, and the review summary agrees', async (t) => {
  const app = await bootApp({ textAssets: { 'research-plan-template.md': WITH_HYPOTHESIS } });
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
  saveAndContinue(steps(d)[1]);
  assert.deepEqual(visible(d), ['context']);
  steps(d)[2].querySelector('.step-all').click();
  assert.deepEqual(visible(d), ['sections']);
  await settle(d);
  assert.equal(statusOf(d, 'Plan details').linked, true, 'completed, and still a link');
  Array.from(d.querySelectorAll('.task-link')).find((b) => text(b) === 'Plan details').click();
  assert.deepEqual(visible(d), ['plan-details']);
});
