'use strict';

// RPA-109. An input's width is a hint about the answer it expects: a ticket
// key is short, a name is moderate, free text is open-ended. The template
// says which with width=N, in the GOV.UK width classes, and the app sizes
// the control. Dates were already fixed; textareas stay full width.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const widthClass = (el) => (Array.from(el.classList).find((c) => /^input-w-\d+$/.test(c)) || '').replace('input-w-', '');

test('the identifier-like fields are sized to their answers, in the header and in the review step', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const sized = (key) => widthClass(d.querySelector('[data-field="' + key + '"]'));
  assert.equal(sized('jiraProject'), '20', 'a project name, since RPA-119; it was a ticket key');
  // A name is two boxes since RPA-146, each the width of a name.
  for (const key of ['leadResearcherFirstName', 'leadResearcherSurname', 'projectRequesterFirstName', 'projectRequesterSurname']) assert.equal(sized(key), '20', key);
  assert.equal(sized('signOffResearcher'), '20', 'a name, outside the header');
  assert.equal(sized('signOffProjectOwner'), '20');
});

test('short-answer lists are sized too, row by row, including rows added later; sentence lists are not', async (t) => {
  // Gus's review, 14 September: "New customers" does not need a whole line.
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const rows = (key) => Array.from(d.querySelectorAll('.list-rows[data-list-key="' + key + '"] .list-input')).map(widthClass);
  // Who takes part is one list since RPA-119; Researcher names is the short-answer list now (RPA-141).
  assert.deepEqual(rows('characteristics'), ['30']);
  assert.deepEqual(rows('researcherNames'), ['20']);
  Array.from(d.querySelectorAll('button')).find((b) => /^\+?\s*add researcher name/i.test(b.textContent.trim())).click();
  assert.deepEqual(rows('researcherNames'), ['20', '20'], 'a new row is sized like the first');
  // Methods rows are built by the combobox code, not the list builder; the
  // width travels through the list, so a row added later is sized too.
  // The participant lists live in the group too since RPA-116, so the Methods list is named.
  const methodRows = () => Array.from(d.querySelectorAll('.methods-groups .list-rows[data-list-key="methods"] .list-input')).map(widthClass);
  assert.deepEqual(methodRows(), ['20']);
  Array.from(d.querySelectorAll('button')).find((b) => /^\+?\s*add method$/i.test(b.textContent.trim())).click();
  assert.deepEqual(methodRows(), ['20', '20']);
  // Gus's review, 14 September: the group for a second research question
  // is built by the code that keeps one group per question, a third path.
  setValue(app.window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Payment method');
  Array.from(d.querySelectorAll('button')).find((b) => /^\+?\s*add research question$/i.test(b.textContent.trim())).click();
  setValue(app.window, d.querySelectorAll('.list-rows[data-list-key="researchQuestions"] .list-input')[1], 'Mobile shoppers');
  // Groups follow studies since RPA-142: two studies, one question each.
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await waitFor(() => d.querySelectorAll('.methods-group').length === 2, { message: 'a second group for the second study' });
  assert.deepEqual(methodRows(), ['20', '20', '20'], 'the second question\'s group is sized too');
  assert.deepEqual(rows('researchQuestions'), ['', ''], 'a sentence keeps the line, both questions');
  assert.deepEqual(rows('outcomes'), ['', ''], 'one outcome per question, both full width');
});

test('open-ended and fixed controls carry no width: textareas, dates and the document title', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  // List rows are sized on purpose (see above); the open-ended textareas are the fields.
  // The project name is a textarea only so that a long name can wrap: it is a
  // text field, sized for a name, and keeps its width (RPA-156).
  for (const el of d.querySelectorAll('textarea[data-field]:not(.list-input):not(.prose-input), input[type=date]')) assert.equal(widthClass(el), '', el.dataset.field || 'date');
  assert.equal(widthClass(d.querySelector('textarea[data-field="jiraProject"]')), '20', 'the project name wraps within the width of a name');
  assert.equal(widthClass(d.querySelector('[data-field="researchTitle"]')), '', 'the title is the page heading');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the classes exist with the GOV.UK measures, and only the GOV.UK widths are accepted', async (t) => {
  for (const [n, em] of [[2, '2.5em'], [3, '3.5em'], [4, '4.5em'], [5, '5.5em'], [10, '11.5em'], [20, '20.5em'], [30, '29.5em']]) {
    assert.ok(CSS.includes('.input-w-' + n + '{max-width:' + em + '}'), 'input-w-' + n);
  }
  // width=15 is not a GOV.UK class; the flag is ignored rather than inventing one.
  const app = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace('Project name (text, prose, width=20,', 'Project name (text, prose, width=15,') } });
  t.after(() => app.close());
  assert.equal(widthClass(app.document.querySelector('[data-field="jiraProject"]')), '');
});
