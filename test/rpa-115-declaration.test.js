'use strict';

// RPA-115. The plan ends with two declarations, one per role, in Gus's
// words: the lead researcher conducts the research, the project requester
// is responsible for the project. Each is a required box, the design
// system's single checkbox, with its statement as its own label, directly
// above that person's sign-off. The Review row of the task list reads
// Completed only once both are ticked and both sign-offs are given; the
// ticks are saved in the draft, come back on reload, and Clear Form unticks
// them. The words come from the template.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep } = require('./app-harness');

const DRAFT_KEY = 'research-plan-app:draft';
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const box = (d, key) => d.querySelector('input[type=checkbox][data-field="' + key + '"]');
const tick = (window, el, on = true) => { el.checked = on; el.dispatchEvent(new window.Event('change', { bubbles: true })); el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const reviewStatus = (d) => text(d.getElementById('task-status-review'));
const settle = () => new Promise((r) => setTimeout(r, 200));
const STATEMENTS = {
  declarationResearcher: 'I confirm this plan is complete and current, and I will conduct the research as it describes.',
  declarationRequester: 'I confirm this plan meets the needs of the project I am responsible for, and I approve it.',
};

test('the review step ends with a declaration for each role, each above its sign-off: one box, unticked, the statement as its label, a hint and a help link', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const signOffs = d.querySelector('.review-signoffs');
  assert.deepEqual(Array.from(signOffs.querySelectorAll(':scope > .field > .flabel')).map(text),
    ['Declaration: Lead researcher', 'Sign off: Lead researcher', 'Declaration: Project requester', 'Sign off: Project requester'],
    'each role declares, then signs');
  for (const [key, statement] of Object.entries(STATEMENTS)) {
    const el = box(d, key);
    assert.ok(el, key + ': one checkbox');
    assert.equal(el.checked, false, key + ': unticked until the person ticks it');
    assert.equal(el.closest('.field').querySelectorAll('input').length, 1, key + ': a single option');
    assert.equal(text(d.querySelector('label[for="' + el.id + '"]')), statement, key + ': the statement, from the template, is the box\'s own label');
    const hint = el.closest('.field').querySelector('.field-hint-text');
    assert.match(text(hint), /^Tick the box/, key);
    assert.ok((el.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id), key + ': described by its hint');
    assert.ok(el.closest('.field').querySelector('.field-help'), key + ': a help link like every field');
  }
  assert.match(STATEMENTS.declarationResearcher, /conduct the research/, 'the researcher conducts the research');
  assert.match(STATEMENTS.declarationRequester, /responsible for/, 'the requester is responsible for the project');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the Review row reads Incomplete until both boxes are ticked and both sign-offs given, and Completed then', async (t) => {
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
  tick(window, box(d, 'declarationResearcher'));
  await settle();
  assert.equal(reviewStatus(d), 'Incomplete', 'one declaration is not enough either');
  tick(window, box(d, 'declarationRequester'));
  await settle();
  assert.equal(reviewStatus(d), 'Completed', 'both declarations complete the plan');
  tick(window, box(d, 'declarationResearcher'), false);
  await settle();
  assert.equal(reviewStatus(d), 'Incomplete', 'and unticking either takes it back');
});

test('the ticks are saved in the draft as a plain yes, come back on reload, and Clear Form unticks them', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit that saves.');
  const before = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.background ? s : null; });
  assert.equal(before.fields.declarationResearcher, '', 'an unticked box saves nothing, not its value attribute');
  assert.equal(before.fields.declarationRequester, '');
  tick(window, box(d, 'declarationResearcher'));
  tick(window, box(d, 'declarationRequester'));
  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.declarationRequester === 'yes' ? s : null; }, { message: 'the ticks were not saved' });
  assert.equal(saved.fields.declarationResearcher, 'yes');
  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  assert.equal(box(again.document, 'declarationResearcher').checked, true, 'ticked on reload');
  assert.equal(box(again.document, 'declarationRequester').checked, true);
  const half = await bootApp({ draft: Object.assign({}, saved, { fields: Object.assign({}, saved.fields, { declarationRequester: '' }) }) });
  t.after(() => half.close());
  assert.equal(box(half.document, 'declarationResearcher').checked, true);
  assert.equal(box(half.document, 'declarationRequester').checked, false, 'each box follows its own key');
  d.getElementById('clear-btn').click();
  assert.equal(box(d, 'declarationResearcher').checked, false, 'Clear Form unticks them');
  assert.equal(box(d, 'declarationRequester').checked, false);
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null);
});
