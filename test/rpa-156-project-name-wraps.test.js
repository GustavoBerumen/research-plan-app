'use strict';

// RPA-156. "Which project or initiative does this research support?" was a
// single-line box, so a long name at phone width scrolled sideways and could
// not be read whole. The box wraps now: one line for a short name, more for
// a long one, still one line of text (Enter does nothing, a pasted line
// break becomes a space) and still a text field in the record. The value
// reaches the draft, the check page, Review, a backup and the print as it
// always did.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('../submission-contract');
const { bootApp, setValue, waitFor, completeStep, toCheckPage, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const settle = () => new Promise((r) => setTimeout(r, 220));
const project = (d) => d.querySelector('[data-field="jiraProject"]');
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const LONG = 'Customer Onboarding and Identity Verification Modernisation Programme, Phase 2 (EMEA)';
const UNBROKEN = 'CustomerOnboardingAndIdentityVerificationModernisationProgrammePhaseTwoEMEA2026';

test('the project name is one line that wraps: a growing box, sized for a name, with its label and hint', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const box = project(d);
  assert.equal(box.tagName, 'TEXTAREA', 'a box that can wrap');
  assert.equal(box.getAttribute('rows'), '1', 'one line to start with');
  assert.ok(box.classList.contains('prose-input') && box.classList.contains('minput'));
  assert.ok(box.classList.contains('input-w-20'), 'still sized for a name (RPA-109), so a short name has a compact box');
  const label = d.querySelector('label[for="' + box.id + '"]');
  assert.equal(text(label), 'Which project or initiative does this research support?', 'the label still names it');
  const hint = d.getElementById(box.getAttribute('aria-describedby').split(/\s+/)[0]);
  assert.match(text(hint), /wider project, programme, or product goal/, 'and the hint still describes it');
  assert.equal(box.getAttribute('placeholder'), '', 'no placeholder');
  assert.deepEqual(app.jsdomErrors, []);
});

test('Enter does nothing and a pasted line break becomes a space: the answer stays one line of text', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const box = project(d);
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  box.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true, 'Enter is not a new line');
  setValue(window, box, 'Checkout\nredesign\r\n  programme');
  assert.equal(box.value, 'Checkout redesign programme');
  await waitFor(() => draftOf(window) && draftOf(window).fields.jiraProject === 'Checkout redesign programme', { message: 'saved as one line' });
  assert.deepEqual(app.jsdomErrors, []);
});

test('a long name is whole everywhere: draft, restore, check page, Review, backup, and the record', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const header = steps(d)[1];
  window.location.hash = '#plan-details';
  await waitFor(() => header.hidden === false);
  completeStep(app, header);
  setValue(window, project(d), LONG);
  await waitFor(() => draftOf(window) && draftOf(window).fields.jiraProject === LONG, { message: 'the draft' });

  toCheckPage(header);
  await settle();
  const row = Array.from(header.querySelectorAll('.check-answers .summary-row')).find((r) => text(r.querySelector('.summary-key')) === 'Project name');
  assert.ok(row, 'a row on the check page');
  assert.equal(text(row.querySelector('.summary-value')), LONG, 'the check page');

  const backup = JSON.parse(JSON.stringify(draftOf(window)));
  assert.equal(backup.fields.jiraProject, LONG, 'a backup carries the draft as it is');
  const plan = contract.project(backup);
  assert.equal(plan.fields.jiraProject, LONG, 'the record');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a plan saved with the name restores it whole into the wrapping box', async (t) => {
  const app = await bootApp({ draft: { version: 10, fields: { emailAddress: 'name@example.com', jiraProject: LONG } } });
  t.after(() => app.close());
  const box = project(app.document);
  assert.equal(box.tagName, 'TEXTAREA');
  assert.equal(box.value, LONG);
  assert.deepEqual(app.jsdomErrors, []);
});

const SUBMISSIONS_ON = { configResponse: async () => ({ ok: true, status: 200, json: async () => ({ pilotMode: true,
  capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: require('./rpa-64-fixtures.cjs').config }) }) };

test('with submissions on the form still matches the schema: the field is still text, so Send judges the plan rather than refusing the form', async (t) => {
  const app = await bootApp({ ...SUBMISSIONS_ON, draft: { version: 10, fields: { emailAddress: 'name@example.com', jiraProject: LONG }, ui: { section: 'review' } } });
  t.after(() => app.close());
  const d = app.document;
  assert.equal(project(d).tagName, 'TEXTAREA');
  d.querySelector('.submission-send').click();
  await settle();
  const said = Array.from(d.querySelectorAll('.submission-errors .error-summary-link')).map(text);
  assert.ok(said.length > 3, 'the plan is judged field by field: ' + said.slice(0, 3).join(' | '));
  assert.equal(said.some((m) => /project name|Unsupported/i.test(m)), false, 'and the project name, given, is not among the errors');
  assert.deepEqual(app.jsdomErrors, []);
});

test('at any width the box wraps within the page and never scrolls the page sideways', () => {
  // jsdom lays nothing out; the rules that hold this are the stylesheet's.
  assert.match(CSS, /textarea\.prose-input\{[^}]*width:100%/, 'the box is as wide as its column');
  assert.match(CSS, /textarea\.prose-input\{[^}]*min-width:0/, 'and no wider');
  assert.match(CSS, /textarea\.prose-input\{[^}]*overflow-wrap:anywhere/, 'an unbroken string breaks rather than overflows');
  assert.match(CSS, /textarea\.prose-input\{[^}]*overflow:hidden/, 'no scrollbar inside the box');
  assert.match(CSS, /textarea\.prose-input\{[^}]*white-space:pre-wrap/, 'wrapping, not one line');
  assert.match(CSS, /\.input-w-20\{max-width:20\.5em\}/, 'the width is a maximum, so at 390px the box is the column');
  assert.equal(UNBROKEN.length > 60, true);
});
