'use strict';

// RPA-81. A start page before the form, in the GOV.UK start-page shape:
// what the form is and who it is for, how it works, what to have to hand,
// where the writing goes, a Start now button, and an example of a finished
// plan to open. Shown once, on a first visit with nothing saved and no link
// into a step, before the email address; a returning person goes straight
// in. "How this form works" in the footer brings it back over the current
// step, and its button takes the person on to where they were going. Not a
// step: nothing of it in the draft, and it does not print. The copy is a
// draft for Gus to replace; it promises nothing the pilot cannot do.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const startOf = (d) => d.querySelector('.start-step');
const gateOf = (d) => d.querySelector('.email-step');
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
async function onStep(app, slug) {
  app.window.location.hash = '#' + slug;
  await waitFor(() => visible(app.document)[0] === slug);
  return stepOf(app.document, slug);
}

test('a first visit opens on the start page: what the form is, how it works, what to have to hand, where the writing goes, and Start now', async (t) => {
  const app = await bootApp({ start: true });
  t.after(() => app.close());
  const { document: d, window } = app;
  const start = startOf(d);
  assert.equal(start.hidden, false, 'the first thing shown');
  assert.deepEqual(visible(d), [], 'nothing of the plan with it');
  assert.equal(gateOf(d).hidden, true, 'and not the email address yet');
  assert.equal(start.classList.contains('step'), false, 'not a step');
  assert.equal(text(start.querySelector('.step-heading')), 'Write a research plan');
  assert.equal(start.getAttribute('aria-labelledby'), start.querySelector('.step-heading').id);
  assert.match(text(start.querySelector('.start-lead')), /^Use this form to plan a piece of product research/);
  assert.deepEqual(Array.from(start.querySelectorAll('.start-h')).map(text), ['How it works', 'Before you start', 'Where your writing goes']);
  const how = Array.from(start.querySelectorAll('ol li')).map(text);
  assert.equal(how.length, 4, 'four steps to how it works');
  assert.match(how[0], /Plan details, Context, Research, Methodology, Execution and Review/, 'the sections, in order');
  assert.match(how[2], /does not write the plan for you/, 'what evaluation does, and does not');
  assert.match(how[3], /print or save as a PDF, and a backup file/, 'what you finish with');
  assert.deepEqual(Array.from(start.querySelectorAll('ul li')).map(text), ['the Jira ticket the research supports', 'the date of the decision it will inform', 'who asked for the research']);
  const copy = text(start);
  assert.match(copy, /saves in this browser/, 'where the writing goes, as it is');
  for (const promise of [/send you/i, /e-?mail/i, /log ?in/i, /sign ?in/i, /account/i, /other device/i, /submit/i]) assert.doesNotMatch(copy, promise, 'nothing the pilot cannot do is promised: ' + promise);
  const button = d.getElementById('start-btn');
  assert.equal(text(button), 'Start now');
  assert.ok(button.querySelector('svg[aria-hidden="true"]'), 'the design system\'s arrow, not read out');
  assert.equal(start.querySelector('[data-field]'), null, 'nothing of it is a plan field');
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null, 'nothing saved for looking');
  assert.equal(window.location.hash, '', 'and no address pushed');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the example of a finished plan opens on the page, marked as an example, in the shape of a check page, and touches nothing', async (t) => {
  const app = await bootApp({ start: true });
  t.after(() => app.close());
  const { document: d, window } = app;
  const example = startOf(d).querySelector('.start-example');
  assert.equal(example.tagName, 'DETAILS');
  assert.equal(example.open, false, 'closed until asked');
  assert.equal(text(example.querySelector('summary')), 'See an example of a finished plan');
  assert.equal(text(example.querySelector('.phase-tag')), 'Example');
  assert.match(text(example.querySelector('.start-example-note')), /It is not your plan, and nothing here goes into it\./);
  const rows = Array.from(example.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
  assert.ok(rows.length >= 12, 'a whole plan in brief: ' + rows.length + ' rows');
  assert.deepEqual(rows[0], ['Research title', 'Usability testing of checkout flow'], 'the title the template\'s own hint uses');
  assert.ok(rows.some(([k]) => k === 'Research question 1') && rows.some(([k]) => k === 'Outcome 1'), 'a question and its outcome');
  assert.ok(rows.some(([k]) => /^Methods/.test(k)) && rows.some(([k]) => /^Sample size/.test(k)) && rows.some(([k]) => k === 'Planned schedule'), 'methods, sample size and a schedule');
  assert.equal(example.querySelector('.summary-change'), null, 'nothing to change: it is not the person\'s plan');
  example.open = true;
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, '', 'the plan is untouched');
  assert.equal(window.localStorage.getItem(DRAFT_KEY), null);
  assert.deepEqual(app.jsdomErrors, []);
});

test('Start now goes on to the email address with focus on its question; a returning person is not shown the start page; a link into a step skips it', async (t) => {
  const app = await bootApp({ start: true, email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  d.getElementById('start-btn').click();
  assert.equal(startOf(d).hidden, true);
  assert.equal(gateOf(d).hidden, false, 'the email address comes next');
  assert.equal(d.activeElement, gateOf(d).querySelector('.step-heading'), 'focus enters the form');
  setValue(window, d.querySelector('[data-field="emailAddress"]'), 'gus@example.com');
  gateOf(d).querySelector('.step-continue').click();
  assert.deepEqual(visible(d), ['sections'], 'then the plan');
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  saveAndContinue(plan);
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.ui && dr.ui.section === 'context' && dr; });

  const back = await bootApp({ draft: saved, start: true });
  t.after(() => back.close());
  assert.equal(startOf(back.document).hidden, true, 'a returning person goes straight in');
  assert.deepEqual(visible(back.document), ['context'], 'where they left off, the draft preserved');
  assert.equal(back.document.querySelector('[data-field="researchTitle"]').value, 'Filled.');

  const linked = await bootApp({ start: true, email: false, url: 'https://research-plan.test/#plan-details' });
  t.after(() => linked.close());
  assert.equal(startOf(linked.document).hidden, true, 'a link into a step skips the start page');
  assert.equal(gateOf(linked.document).hidden, false, 'and meets the email address');
  assert.deepEqual(app.jsdomErrors, []);
});

test('"How this form works" in the footer brings the page back over the plan, and its button returns to the step the person was on, focus on its heading', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout study');
  const link = d.getElementById('how-it-works-link');
  assert.equal(text(link), 'How this form works');
  assert.equal(link.getAttribute('href'), '#start');
  window.location.hash = '#start';
  await waitFor(() => !startOf(d).hidden);
  assert.deepEqual(visible(d), [], 'over the plan');
  assert.equal(d.activeElement, startOf(d).querySelector('.step-heading'));
  assert.equal(text(d.getElementById('start-btn')), 'Continue to your plan', 'not Start now: there is a plan to go back to');
  d.getElementById('start-btn').click();
  assert.equal(startOf(d).hidden, true);
  assert.deepEqual(visible(d), ['plan-details'], 'back where they were');
  assert.equal(d.activeElement, plan.querySelector('.step-heading'));
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, 'Checkout study', 'nothing lost');
  assert.equal(window.location.hash, '#plan-details');

  const reopened = await bootApp({ draft: await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.researchTitle === 'Checkout study' && dr; }), url: 'https://research-plan.test/#start', start: true });
  t.after(() => reopened.close());
  assert.equal(startOf(reopened.document).hidden, false, 'the address opens it on a returning visit too');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it does not print', () => {
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.start-step/, 'in the print hide-list');
});
