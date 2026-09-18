'use strict';

// RPA-148. Last updated is a computed date, stamped whenever the plan's
// content changes and editable on request (RPA-55). It sat in the top-right
// corner of the plan's header, and so on every page of Plan details, above
// questions it had nothing to do with.
//
// Decided 17 September 2026 (Gus): relocate. On screen it is on the task
// list, under the sentence that says how much of the plan is done, because
// that is where the plan is looked at as a whole. The printed plan is a
// document and keeps the convention: the header's corner still says when it
// was last updated. Still editable, which was an explicit earlier request;
// still stamped, saved, backed up, sent and restored exactly as before.
// Only where it is shown changed.
//
// Rejected: keeping it (clutter above the question); taking it off the
// screen and keeping it on paper (nowhere left to edit it, and nothing on
// screen then says the work is being kept, since the saved message is hidden
// pending RPA-93); removing it (a reviewer with a PDF cannot tell which
// version they hold).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const hubOf = (d) => d.querySelector('.task-list-step');
const lineOf = (d) => hubOf(d).querySelector('.dateline');
const inputOf = (d) => d.querySelector('[data-field="lastUpdated"]');
const inWords = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const todayIso = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };

test('on the task list, under how much is done; on no page of Plan details', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const line = lineOf(d);
  assert.ok(line, 'the task list has the line');
  assert.equal(hubOf(d).querySelector('.task-list-progress').nextElementSibling, line, 'directly under "You have completed 0 of 7 sections."');
  assert.equal(text(line.querySelector('.mlabel')), 'Last updated');
  assert.equal(text(line.querySelector('.dateline-value')), inWords(todayIso()), 'in words, as it always read');

  const plan = d.querySelector('.doc-header');
  assert.equal(plan.querySelector('.dateline, [data-field="lastUpdated"], .dateline-value'), null, 'nothing of it is left in the header to look at or tab to');
  for (let page = 1; page <= 3; page++) {
    window.location.hash = '#plan-details/' + page;
    await settle(150);
    const shown = Array.from(plan.querySelectorAll('.title-field, .mf')).filter((u) => !u.hidden && !u.classList.contains('page-hidden'));
    assert.equal(shown.length, 1, 'page ' + page + ' shows its question and nothing else: ' + shown.map((u) => text(u).slice(0, 30)).join(' | '));
  }
  assert.match(CSS, /@media screen\{\.doc-header-top\{display:none\}\}/, 'the header\'s corner is off the screen');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the printed plan still says when it was last updated, from the same value', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const printed = d.querySelector('.doc-header .doc-header-top .last-updated-print');
  assert.ok(printed, 'the header\'s corner holds it for paper');
  assert.equal(text(printed), 'Last updated ' + inWords(todayIso()));
  assert.equal(printed.querySelector('button, input'), null, 'words only: there is nothing to press on paper');
  setValue(window, inputOf(d), '2026-08-01');
  assert.equal(text(printed), 'Last updated 1 August 2026', 'it follows the value, however that changed');
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.task-list-step/, 'the task list itself does not print, which is why the header keeps a copy');
  assert.doesNotMatch(print, /doc-header-top[^}]*\{[^}]*display:none/, 'and print does not hide the corner');
  assert.deepEqual(app.jsdomErrors, []);
});

test('still editable where it now lives: the sentence is the control, and an edit by hand stops the stamping', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const line = lineOf(d);
  const sentence = line.querySelector('.dateline-value');
  const editor = line.querySelector('.date-control');
  assert.equal(sentence.tagName, 'BUTTON');
  assert.match(sentence.getAttribute('aria-label'), /^Last updated .*, edit$/);
  assert.equal(editor.hidden, true, 'the editor is put away until asked for');
  sentence.click();
  assert.equal(editor.hidden, false);
  assert.equal(sentence.hidden, true);
  assert.equal(d.activeElement, editor.querySelector('.date-day'), 'and focus is in it');

  setValue(window, inputOf(d), '2026-08-01');
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit to the plan after the date was set by hand.');
  await settle(900);
  assert.equal(inputOf(d).value, '2026-08-01', 'a date set by hand is kept, as RPA-55 promised');
  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.fields.lastUpdated, '2026-08-01', 'and saved in the draft under the same key');
  assert.equal(saved.lastUpdatedManual, true);
  assert.deepEqual(app.jsdomErrors, []);
});

test('it is still stamped as the plan changes, and says so on the task list, which is also the only sign the work is kept', async (t) => {
  const app = await bootApp({ draft: { version: 10, fields: { researchTitle: 'An older plan', lastUpdated: '2026-08-20' }, selects: {}, lists: {}, studies: [], tables: {}, custom: {}, lastUpdatedManual: false } });
  t.after(() => app.close());
  const { document: d, window } = app;
  assert.equal(text(lineOf(d).querySelector('.dateline-value')), '20 August 2026', 'a restored plan says when it was last changed');
  setValue(window, d.querySelector('[data-field="background"]'), 'Something new.');
  await waitFor(() => inputOf(d).value === todayIso());
  assert.equal(text(lineOf(d).querySelector('.dateline-value')), inWords(todayIso()), 'a change to the plan stamps today');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a plan saved before the move restores with its date, one edited by hand included', async (t) => {
  const older = { version: 9, fields: { researchTitle: 'Saved with the date in the corner', lastUpdated: '2026-07-04' }, selects: {}, lists: { researchQuestions: ['Why?'], outcomes: ['A reason.'] },
    methods: [{ question: 'Why?', methods: ['Interviews'] }], tables: {}, custom: {}, signOff: null, lastUpdatedManual: true };
  const app = await bootApp({ draft: older });
  t.after(() => app.close());
  const { document: d, window } = app;
  assert.equal(inputOf(d).value, '2026-07-04');
  assert.equal(text(lineOf(d).querySelector('.dateline-value')), '4 July 2026');
  assert.equal(text(d.querySelector('.last-updated-print-value')), '4 July 2026');
  setValue(window, d.querySelector('[data-field="background"]'), 'A later edit.');
  await settle(900);
  assert.equal(inputOf(d).value, '2026-07-04', 'and being set by hand, it is still not stamped over');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it is not a question: no page, no check-page row, nothing required, and Clear Form starts it again from today', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = d.querySelector('.doc-header');
  assert.equal(Array.from(plan.querySelectorAll('.title-field, .mf')).some((u) => /Last updated/.test(text(u))), false, 'no unit of Plan details is about it');
  setValue(window, inputOf(d), '2026-08-01');
  d.getElementById('clear-btn').click();
  await settle();
  assert.equal(inputOf(d).value, todayIso(), 'a new plan starts from today');
  assert.equal(text(lineOf(d).querySelector('.dateline-value')), inWords(todayIso()));
  assert.equal(text(d.querySelector('.last-updated-print-value')), inWords(todayIso()));
  assert.deepEqual(app.jsdomErrors, []);
});
