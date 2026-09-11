'use strict';

// RPA-102 and RPA-113. The button is "Save and continue": it saves whatever
// is there, and moves on only when the section's required fields are
// answered. When they are not, the GOV.UK validation pattern: an error
// summary at the top of the step — "There is a problem", one link per
// missing field — takes focus, and each missing field gets a message above
// its control, is marked, and is described by the message. Errors follow
// the typing: a field filled in loses its message, and the summary goes when
// nothing is left. Nothing is judged before the person asks to move on.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const summaryOf = (step) => step.querySelector('.error-summary');
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const errorsOf = (step) => Array.from(step.querySelectorAll('.field-error')).map((e) => text(e).replace(/^Error: /, ''));
async function onPlanDetails(app) {
  app.window.location.hash = '#plan-details';
  await waitFor(() => visible(app.document)[0] === 'plan-details');
  return steps(app.document)[1];
}
function savedDraft(window) {
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) { try { const j = JSON.parse(ls.getItem(ls.key(i))); if (j && j.ui) return j; } catch (e) { /* not ours */ } }
  return null;
}

test('partial and impossible required dates stay on the step, and a completed correction saves', async (t) => {
  const app = await bootApp(); t.after(() => app.close());
  const { document: d, window } = app;
  const step = await onPlanDetails(app);
  completeStep(app, step);
  const native = d.querySelector('[data-field="projectDecision"]');
  const date = native.closest('.date-control');
  const parts = ['day', 'month', 'year'].map(part => date.querySelector('.date-' + part));
  const enter = values => {
    native.value = '';
    parts.forEach((part, i) => { part.value = values[i]; });
    parts[2].dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  for (const values of [['12', '', ''], ['31', 'Feb', '2026']]) {
    enter(values);
    step.querySelector('.step-continue').click();
    assert.deepEqual(visible(d), ['plan-details']);
    assert.equal(summaryOf(step).hidden, false);
    assert.ok(linksOf(step).includes('Enter a complete, valid project decision date'));
    assert.equal(d.activeElement, summaryOf(step));
    step.querySelector('.step-all').click();
    const task = Array.from(d.querySelectorAll('.task-item')).find(row => text(row.querySelector('.task-name')) === 'Plan details');
    assert.equal(text(task.querySelector('.task-status')), 'Incomplete');
    d.querySelector('.task-link').click();
  }
  enter(['12', 'Oct', '2026']);
  step.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(savedDraft(window).fields.projectDecision, '2026-10-12');
});

test('Save and continue commits a complete date still buffered in its visible segments', async (t) => {
  const app = await bootApp(); t.after(() => app.close());
  const step = await onPlanDetails(app);
  completeStep(app, step);
  const input = app.document.querySelector('[data-field="projectDecision"]');
  const group = input.closest('.date-control');
  input.value = '';
  group.querySelector('.date-day').value = '14';
  group.querySelector('.date-month').value = 'Oct';
  group.querySelector('.date-year').value = '2026';
  step.querySelector('.step-continue').click();
  assert.deepEqual(visible(app.document), ['context']);
  assert.equal(savedDraft(app.window).fields.projectDecision, '2026-10-14');
});

test('the button says what it does, and nothing is judged before it is pressed', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const step = await onPlanDetails(app);
  assert.equal(text(step.querySelector('.step-continue')), 'Save and continue');
  assert.equal(summaryOf(step).hidden, true);
  assert.deepEqual(errorsOf(step), []);
  assert.equal(step.querySelector('.field-invalid'), null);
});

test('pressing it on an incomplete section shows the summary, takes focus there, and marks each missing field', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const step = await onPlanDetails(app);
  step.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['plan-details'], 'stays');
  const summary = summaryOf(step);
  assert.equal(summary.hidden, false);
  assert.equal(summary.getAttribute('role'), 'alert');
  assert.equal(text(summary.querySelector('.error-summary-title')), 'There is a problem');
  assert.equal(d.activeElement, summary, 'focus moves to the summary');
  assert.deepEqual(linksOf(step), ['Enter the jira project', 'Enter the lead researcher', 'Enter the project requester', 'Enter a complete, valid project decision date', 'Enter a complete, valid research readout date']);
  assert.deepEqual(errorsOf(step), linksOf(step), 'the same message at the field');
  const lead = d.querySelector('[data-field="leadResearcher"]');
  const group = lead.closest('.mf');
  assert.ok(group.classList.contains('field-invalid'));
  const err = group.querySelector('.field-error');
  assert.ok(err.previousElementSibling.classList.contains('field-hint-text'), 'below the hint, above the control');
  assert.ok((lead.getAttribute('aria-describedby') || '').split(/\s+/).includes(err.id), 'described by its error');
  assert.match(text(err), /^Error: /, 'a screen reader hears that it is an error');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a summary link puts focus in the field; filling it takes its error away; the summary goes when nothing is left', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const step = await onPlanDetails(app);
  step.querySelector('.step-continue').click();
  step.querySelectorAll('.error-summary-link')[1].click();
  assert.equal(d.activeElement, d.querySelector('[data-field="leadResearcher"]'));
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Gus');
  assert.deepEqual(linksOf(step), ['Enter the jira project', 'Enter the project requester', 'Enter a complete, valid project decision date', 'Enter a complete, valid research readout date']);
  assert.equal(d.querySelector('[data-field="leadResearcher"]').closest('.mf').classList.contains('field-invalid'), false);
  completeStep(app, step);
  assert.equal(summaryOf(step).hidden, true, 'nothing left to say');
  assert.deepEqual(errorsOf(step), []);
  step.querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['context'], 'and now it moves on');
});

test('it saves either way, and a section\'s errors name only its required fields', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onPlanDetails(app);
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Gus');
  plan.querySelector('.step-continue').click();
  // Read at once, before the autosave timer could: the press itself saves.
  assert.equal(savedDraft(window)?.fields?.leadResearcher, 'Gus', 'saved at the press, not on the autosave timer');
  completeStep(app, plan);
  plan.querySelector('.step-continue').click();
  await waitFor(() => visible(d)[0] === 'context');
  window.location.hash = '#context';
  const context = steps(d)[2];
  context.querySelector('.step-continue').click();
  assert.deepEqual(linksOf(context), ['Enter the background', 'Enter the goal', 'Enter the problem statement'], 'Additional information is not required');
  completeStep(app, context);
  context.querySelector('.step-continue').click();
  await waitFor(() => visible(d)[0] === 'research');
  steps(d)[3].querySelector('.step-continue').click();
  const research = linksOf(steps(d)[3]);
  assert.ok(!research.some((m) => /hypothesis/i.test(m)), 'an optional field is never an error: ' + research.join(', '));
  assert.ok(research.includes('Add to Research Questions'), research.join(', '));
});

test('errors do not print, and the marked field prints clean', () => {
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.error-summary,\.field-error\{display:none!important\}/);
  assert.match(print, /\.field-invalid\{border-left:0;padding-left:0\}/);
});
