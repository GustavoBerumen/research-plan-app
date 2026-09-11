'use strict';

// RPA-101. One section on screen at a time, on the GOV.UK question-page
// shape: Plan details, each section, then Review — a "Section n of 6"
// caption, a Back link, a Continue button. Every step stays in the DOM, so
// autosave, the review summary and print see the whole plan; only what a
// person sees changes. The step is remembered in the URL hash and the
// draft, so a reload and the browser's Back button both land where they
// should.
//
// Also here, because they arrived with it: one Additional information hatch
// per section, rendered after the section's questions and Evaluate control,
// capped at one block (RPA-82) without ever refusing a restore.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const continueOn = (step) => step.querySelector('.step-continue');
const backOn = (step) => step.querySelector('.step-back');

test('Clear Form reopens every capped hatch for the next plan', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const hatches = Array.from(app.document.querySelectorAll('.field-custom'));
  for (const hatch of hatches) {
    hatch.querySelector('.add-btn').click();
    assert.equal(hatch.querySelector('.add-btn').hidden, true);
  }
  app.document.getElementById('clear-btn').click();
  for (const hatch of hatches) {
    assert.equal(hatch.querySelectorAll('.custom-field-block').length, 0);
    const add = hatch.querySelector('.add-btn');
    assert.equal(add.hidden, false, 'a cleared hatch can be used again');
    add.click();
    assert.equal(hatch.querySelectorAll('.custom-field-block').length, 1);
    assert.equal(add.hidden, true, 'the one-block cap still applies');
  }
});
function savedDraft(window) {
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) {
    try { const j = JSON.parse(ls.getItem(ls.key(i))); if (j && j.ui) return j; } catch (e) { /* not ours */ }
  }
  return null;
}

test('the plan opens on Plan details alone, with six steps in order and a caption on each', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.deepEqual(steps(d).map((s) => s.dataset.stepSlug), ['plan-details', 'context', 'research', 'methodology', 'execution', 'review']);
  assert.deepEqual(visible(d), ['plan-details']);
  assert.deepEqual(steps(d).map((s) => text(s.querySelector('.step-caption'))), [1, 2, 3, 4, 5, 6].map((n) => 'Section ' + n + ' of 6'));
  assert.equal(text(d.querySelector('.doc-header .step-heading')), 'Plan details');
  assert.equal(backOn(steps(d)[0]).hidden, true, 'nothing to go back to on the first step');
  assert.equal(continueOn(steps(d)[5]), null, 'Review has its own actions, not Continue');
  assert.deepEqual(app.jsdomErrors, []);
});

test('Continue and Back walk the steps, the URL follows, and the browser can drive it', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  continueOn(steps(d)[0]).click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(window.location.hash, '#context');
  continueOn(steps(d)[1]).click();
  assert.deepEqual(visible(d), ['research']);
  // Research, not Context: the template opens Context by default, so only a
  // section that starts closed proves that showing a step also opens it.
  assert.equal(steps(d)[2].querySelector('.acc-body').hidden, false, 'the section is open, not merely on screen');
  backOn(steps(d)[2]).click();
  assert.deepEqual(visible(d), ['context']);
  assert.equal(window.location.hash, '#context');
  // The browser moving us (Back button, a typed hash) is honoured too.
  window.location.hash = '#execution';
  await waitFor(() => visible(d)[0] === 'execution', { message: 'hashchange did not navigate' });
});

test('the step is remembered in the draft and comes back on reload; a hash in the URL wins over it', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  continueOn(steps(d)[0]).click();
  continueOn(steps(d)[1]).click();
  await waitFor(() => savedDraft(window)?.ui?.section === 'research', { message: 'the step was not saved' });

  const again = await bootApp({ draft: { version: 7, fields: {}, lists: {}, tables: {}, ui: { section: 'methodology' } } });
  t.after(() => again.close());
  assert.deepEqual(visible(again.document), ['methodology'], 'a saved step is restored');

  const hashed = await bootApp({ draft: { version: 7, fields: {}, lists: {}, tables: {}, ui: { section: 'methodology' } }, url: 'http://localhost/#execution' });
  t.after(() => hashed.close());
  assert.deepEqual(visible(hashed.document), ['execution'], 'the URL is the more deliberate of the two');
});

test('a section heading and the review step\'s Change both go to the step, and Change lands on its first control', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  steps(d)[3].querySelector('.acc-head').click();
  assert.deepEqual(visible(d), ['methodology'], 'a heading navigates rather than toggles');
  d.querySelector('a[href="#review"], .step[data-step-slug="review"]');
  steps(d)[5].hidden = false; // the review step is where Change lives; reach it as a person would
  steps(d)[4].querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['review']);
  const change = Array.from(d.querySelectorAll('.review-change')).find((b) => b.getAttribute('aria-label') === 'Change Research');
  change.click();
  assert.deepEqual(visible(d), ['research']);
  assert.equal(d.activeElement.closest('.step')?.dataset.stepSlug, 'research', 'focus is in the section being changed');
});

test('every step prints, and the step chrome does not', () => {
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.step\[hidden\]\{display:block!important\}/);
  assert.match(print, /\.step-top,\.step-nav\{display:none!important\}/);
});

test('each section has one Additional information hatch, after its Evaluate control, and the head count leaves it out', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const sections = steps(d).slice(1, 5);
  assert.deepEqual(sections.map((s) => s.querySelectorAll('.field-custom').length), [1, 1, 1, 1]);
  assert.deepEqual(sections.map((s) => s.querySelector('.custom-fields-list').dataset.listKey),
    ['additionalContext', 'additionalResearch', 'additionalMethodology', 'additionalResources']);
  const context = sections[0];
  const evalCtl = context.querySelector('.section-eval-btn');
  const hatch = context.querySelector('.field-custom');
  assert.ok(evalCtl && (evalCtl.compareDocumentPosition(hatch) & 4), 'the hatch follows the Evaluate control');
  assert.ok(hatch.compareDocumentPosition(context.querySelector('.step-continue')) & 4, 'and Continue follows the hatch');
  assert.equal(text(context.querySelector('.acc-count')), '3 fields', 'the hatch is not one of the section\'s questions');
});

test('the hatch is capped at one block, and a restore above the cap keeps every block', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const hatch = steps(d)[1].querySelector('.field-custom');
  const add = hatch.querySelector('.add-btn');
  assert.equal(add.hidden, false);
  add.click();
  assert.equal(hatch.querySelectorAll('.custom-field-block').length, 1);
  assert.equal(add.hidden, true, 'one is the limit');
  hatch.querySelector('.list-remove').click();
  assert.equal(add.hidden, false, 'removing it brings the control back');

  const restored = await bootApp({ draft: { version: 7, fields: {}, lists: {}, tables: {},
    custom: { additionalResources: [{ label: 'Kit', body: 'Two laptops' }, { label: 'Rooms', body: 'Lab B' }] } } });
  t.after(() => restored.close());
  const execution = steps(restored.document)[4].querySelector('.field-custom');
  assert.deepEqual(Array.from(execution.querySelectorAll('.custom-field-name')).map((i) => i.value), ['Kit', 'Rooms'], 'nothing authored is refused');
  assert.equal(execution.querySelector('.add-btn').hidden, true);
});

test('an empty hatch does not hold a section at incomplete in the review summary', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const key of ['background', 'goal', 'problemStatement']) setValue(window, d.querySelector('[data-field="' + key + '"]'), 'Written.');
  await waitFor(() => {
    const row = Array.from(d.querySelectorAll('.review-row')).find((r) => text(r.querySelector('.review-name')) === 'Context');
    return row && !!row.querySelector('.review-tick-done');
  }, { message: 'Context never read as complete' });
});
