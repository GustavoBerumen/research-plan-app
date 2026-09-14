'use strict';

// RPA-115. The plan ends with a declaration the author agrees to: one
// required box on the review step, the design system's single checkbox,
// with the statement as its own label. It sits above both sign-offs, which
// stay (whether it replaces the lead researcher's is Gus's call). The
// Review row of the task list reads Completed only once it is ticked; the
// tick is saved in the draft, comes back on reload, and Clear Form unticks
// it. The words come from the template.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const DRAFT_KEY = 'research-plan-app:draft';
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const box = (d) => d.querySelector('input[type=checkbox][data-field="declaration"]');
const tick = (window, el, on = true) => { el.checked = on; el.dispatchEvent(new window.Event('change', { bubbles: true })); el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const reviewStatus = (d) => text(d.getElementById('task-status-review'));
const settle = () => new Promise((r) => setTimeout(r, 200));

test('the review step ends with a declaration above the sign-offs: one box, unticked, the statement as its label, a hint and a help link', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const signOffs = d.querySelector('.review-signoffs');
  assert.deepEqual(Array.from(signOffs.querySelectorAll(':scope > .field > .flabel')).map(text), ['Declaration', 'Sign off: Lead researcher', 'Sign off: Project requester'], 'above both sign-offs, which stay');
  const el = box(d);
  assert.ok(el, 'one checkbox');
  assert.equal(el.checked, false, 'unticked until the author ticks it');
  assert.equal(el.closest('.field').querySelectorAll('input').length, 1, 'a single option');
  const statement = d.querySelector('label[for="' + el.id + '"]');
  assert.equal(text(statement), 'I confirm this plan is complete and current, and I am responsible for it.', 'the statement, from the template, is the box\'s own label');
  const hint = el.closest('.field').querySelector('.field-hint-text');
  assert.match(text(hint), /^Tick the box once every section is complete/);
  assert.ok((el.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id), 'described by its hint');
  assert.ok(el.closest('.field').querySelector('.field-help'), 'and it has a help link like every field');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the Review row reads Incomplete with the sign-offs alone, and Completed once the box is ticked', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => visible(d)[0] === steps(d)[i].dataset.stepSlug);
    completeStep(app, steps(d)[i]);
  }
  await settle();
  assert.equal(reviewStatus(d), 'Not yet started');
  setValue(window, d.querySelector('[data-field="signOffResearcher"]'), 'GB');
  setValue(window, d.querySelector('[data-field="signOffProjectOwner"]'), 'MS');
  await settle();
  assert.equal(reviewStatus(d), 'Incomplete', 'both sign-offs are not enough');
  tick(window, box(d));
  await settle();
  assert.equal(reviewStatus(d), 'Completed', 'the declaration completes the plan');
  tick(window, box(d), false);
  await settle();
  assert.equal(reviewStatus(d), 'Incomplete', 'and unticking takes it back');
});

test('the tick is saved in the draft as a plain yes, comes back on reload, and Clear Form unticks it', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit that saves.');
  const before = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.background ? s : null; });
  assert.equal(before.fields.declaration, '', 'an unticked box saves nothing, not its value attribute');
  tick(window, box(d));
  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.declaration === 'yes' ? s : null; }, { message: 'the tick was not saved' });
  assert.equal(saved.fields.declaration, 'yes');
  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  assert.equal(box(again.document).checked, true, 'ticked on reload');
  const untouched = await bootApp({ draft: Object.assign({}, saved, { fields: Object.assign({}, saved.fields, { declaration: '' }) }) });
  t.after(() => untouched.close());
  assert.equal(box(untouched.document).checked, false, 'and not ticked when the draft says so');
  d.getElementById('clear-btn').click();
  assert.equal(box(d).checked, false, 'Clear Form unticks it');
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null);
});

