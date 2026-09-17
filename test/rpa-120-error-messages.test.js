'use strict';

// RPA-120: the words of the error messages. RPA-113 made a message for each
// required field out of its kind and its label: "Enter the background",
// "Add to Research Questions", "Enter the jira project". This ticket writes
// one for each field instead, in the design system's style: say what to do,
// in the words of the question the person was asked, no full stop, no
// "please", nothing about what they did wrong.
//
// They live in research-plan-template.md as an indented "Error:" line under
// the field (RPA-141 began it, for one field). A field without one keeps the
// general wording. Two things are not written per field, because they are
// the same for every field of their kind: what is wrong with a date that
// has been started, and with a sample size typed into "Other". Those speak
// first, since an answer that is there and wrong is a different thing from
// no answer.
//
// The messages below are a draft for Gus to edit: changing one is an edit
// to the template and to this table.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, completeStep } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const stepOf = (d, slug) => d.querySelector('[data-step-slug="' + slug + '"]');
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const inlineOf = (step) => Array.from(step.querySelectorAll('.field-error')).map(text);
const press = (step) => step.querySelector('.step-continue').click();
async function toLastPage(app, step) {
  const slug = step.dataset.stepSlug;
  app.window.location.hash = '#' + slug + '/1'; await settle();
  const total = Number((/of (\d+)/.exec(text(step.querySelector('.step-page-caption'))) || [0, 1])[1]);
  app.window.location.hash = '#' + slug + '/' + total; await settle();
}
async function finish(app, step) {
  completeStep(app, step);
  await toLastPage(app, step);
  for (let i = 0; i < 8 && !step.classList.contains('step-checking'); i++) { press(step); await settle(); }
  assert.ok(step.classList.contains('step-checking'), step.dataset.stepSlug + ' completes');
}

// Every required field, in the order the form asks them, and what each says
// when it is left unanswered.
const WORDS = {
  'plan-details': [
    'Enter a name for your research plan',
    'Enter the project or initiative this research supports',
    'Enter the name of the person leading this research',
    'Select yes if other researchers are involved in this research',
    'Enter the name of the person who requested this research',
    'Enter the date the findings will be used to make a decision',
    'Enter the date the findings will be shared with the team',
  ],
  context: [
    'Enter what people need to know about this project',
    'Enter the goal of this project',
    'Enter the problem you are trying to solve',
  ],
  research: [
    'Enter what you want to learn from this research',
    'Enter at least one research question',
    'Enter at least one deliverable that will answer your research questions',
  ],
  studies: ['Select how many studies you will run'],
  methodology: [
    'Enter at least one research method for Study 1',
    'Enter who should take part in Study 1',
    'Select how many participants you need for Study 1',
    'Enter at least one research method for Study 2',
    'Enter who should take part in Study 2',
    'Select how many participants you need for Study 2',
  ],
  execution: ['Enter a start date and a completion date for each stage'],
};

test('every section, left empty, asks for each of its fields in that field\'s own words, in the summary and at the field', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const slug of Object.keys(WORDS)) {
    const step = stepOf(d, slug);
    await toLastPage(app, step);   // the last page judges the whole section (RPA-108)
    press(step);
    await settle();
    assert.deepEqual(linksOf(step), WORDS[slug], slug);
    assert.deepEqual(inlineOf(step).map((m) => m.replace(/^Error:\s*/, '')), WORDS[slug], slug + ': the same words at the field');
    if (slug === 'research') {
      setValue(window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Where do people give up?');
      d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
      setValue(window, d.querySelectorAll('.list-rows[data-list-key="researchQuestions"] .list-input')[1], 'What do they expect instead?');
    }
    if (slug === 'studies') {
      // Two studies, a question each, so Methodology's messages have a study
      // to name. By hand: the harness would answer "One".
      d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
      await settle();
      Array.from(d.querySelectorAll('.study-group')).forEach((g, i) => g.querySelectorAll('input[type=checkbox]')[i].click());
      await toLastPage(app, step);
      for (let i = 0; i < 6 && !step.classList.contains('step-checking'); i++) { press(step); await settle(); }
      assert.ok(step.classList.contains('step-checking'), 'studies completes');
      continue;
    }
    await finish(app, step);
  }
  assert.deepEqual(app.jsdomErrors, []);
});

test('the messages keep to the style: an instruction, no full stop, no please, no blame, nothing pasted from a label', () => {
  const fields = TEMPLATE.slice(TEMPLATE.indexOf('\n-->')).split('\n');
  const messages = fields.filter((l) => /^  Error:/.test(l)).map((l) => l.replace(/^  Error:\s*/, ''));
  assert.ok(messages.length >= 22, 'one for every required field, the sign-off included: ' + messages.length);
  for (const m of messages) {
    assert.match(m, /^(Enter|Select|Confirm) /, 'starts by saying what to do: ' + m);
    assert.doesNotMatch(m, /[.!]$/, 'no full stop: ' + m);
    assert.doesNotMatch(m, /\b(please|sorry|invalid|forgot|forgotten|failed|must|required|mandatory|oops)\b/i, 'no pleading and no blame: ' + m);
    assert.ok(m.length <= 80, 'short enough to read in a list: ' + m);
  }
  assert.equal(new Set(messages).size, messages.length, 'no two fields say the same thing, so a link in the summary names one field');
  // Every required field has one: a field line that is not optional, not computed, and not a container of others.
  const lacking = [];
  fields.forEach((line, i) => {
    const m = /^(?:# )?([A-Z][^(]*)\(([^)]*)\)/.exec(line);
    if (!m || /\boptional\b|custom-fields|study-questions|key=lastUpdated|key=emailAddress/.test(m[2])) return;
    const own = [];
    for (let j = i + 1; j < fields.length && /^  \S/.test(fields[j]); j++) own.push(fields[j]);
    if (!own.some((l) => /^  Error:/.test(l))) lacking.push(m[1].trim());
  });
  assert.deepEqual(lacking, [], 'a required field added later needs its words too');
});

test('a field without an Error line keeps the general wording, made from its name', async (t) => {
  const tpl = TEMPLATE.replace(/^  Error: Enter the goal of this project\r?\n/m, '');
  assert.notEqual(tpl, TEMPLATE, 'the fixture must find the Goal\'s message');
  const app = await bootApp({ textAssets: { 'research-plan-template.md': tpl } });
  t.after(() => app.close());
  await finish(app, app.document.querySelector('.doc-header'));
  const context = stepOf(app.document, 'context');
  await toLastPage(app, context);
  press(context);
  await settle();
  assert.deepEqual(linksOf(context), ['Enter what people need to know about this project', 'Enter the goal', 'Enter the problem you are trying to solve']);
});

test('a date that has been started is told what it lacks; only an untouched one is asked for in the field\'s words', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = d.querySelector('.doc-header');
  completeStep(app, plan);
  const native = d.querySelector('[data-field="projectDecision"]');
  const control = native.closest('.date-control');
  const parts = ['day', 'month', 'year'].map((p) => control.querySelector('.date-' + p));
  const enter = (values) => {
    native.value = '';
    parts.forEach((part, i) => { part.value = values[i]; });
    parts[2].dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const said = async (values) => { enter(values); await toLastPage(app, plan); press(plan); await settle(); return linksOf(plan); };
  assert.deepEqual(await said(['', '', '']), ['Enter the date the findings will be used to make a decision'], 'untouched: the field\'s own words');
  assert.deepEqual(await said(['12', '', '']), ['Project decision date must include a month and year']);
  assert.deepEqual(await said(['12', '11', '']), ['Project decision date must include a year']);
  assert.deepEqual(await said(['', '11', '2026']), ['Project decision date must include a day']);
  assert.deepEqual(await said(['', '', '2026']), ['Project decision date must include a day and month']);
  assert.deepEqual(await said(['31', '2', '2026']), ['Project decision date must be a real date'], 'all three parts, and no such day');
  assert.deepEqual(inlineOf(plan).map((m) => m.replace(/^Error:\s*/, '')), ['Project decision date must be a real date'], 'the same at the field');
  assert.deepEqual(app.jsdomErrors, []);
});

test('choosing "Other" for the sample size is an answer begun: its box is asked for, not the question again', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const slug of ['plan-details', 'context', 'research', 'studies']) {
    if (slug === 'research') setValue(window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Where do people give up?');
    await finish(app, slug === 'plan-details' ? d.querySelector('.doc-header') : stepOf(d, slug));
  }
  const methodology = stepOf(d, 'methodology');
  const group = d.querySelector('.methods-group');
  setValue(window, group.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Interviews');
  setValue(window, group.querySelector('.list-rows[data-list-key="characteristics"] .list-input'), 'Abandoned a basket');
  const radios = group.querySelector('.radio-group[data-field-key="sampleSize"]');
  radios.querySelector('input[value="__other__"]').click();
  await toLastPage(app, methodology);
  press(methodology);
  await settle();
  assert.equal(linksOf(methodology).length, 1);
  assert.match(linksOf(methodology)[0], /^Enter a valid sample size for Study 1: a positive whole number/);
  setValue(window, radios.querySelector('.radio-other-row input[type="text"]'), 'lots');
  press(methodology);
  await settle();
  assert.match(linksOf(methodology)[0], /^Enter a valid sample size for Study 1:/, 'and the same when what is typed is not a number');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a schedule nobody has started is asked for once; once a date is in, each row is told what it lacks', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const slug of ['plan-details', 'context', 'research', 'studies', 'methodology']) {
    if (slug === 'research') setValue(window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Where do people give up?');
    await finish(app, slug === 'plan-details' ? d.querySelector('.doc-header') : stepOf(d, slug));
  }
  const execution = stepOf(d, 'execution');
  const dates = Array.from(d.querySelectorAll('#stageTimeline-table input[type="date"]'));
  assert.ok(dates.filter((i) => i.value).length >= 1, 'the form has filled in a date or two itself (RPA-76, RPA-59); they do not count as a start');
  await toLastPage(app, execution);
  press(execution);
  await settle();
  assert.deepEqual(linksOf(execution), ['Enter a start date and a completion date for each stage'], 'one thing to do, not a message per empty date');
  execution.querySelector('.error-summary-link').click();
  assert.ok(d.getElementById('stageTimeline-table').contains(d.activeElement), 'and its link goes to the schedule');

  const empty = dates.find((i) => !i.value);
  setValue(window, empty, '2026-10-01');
  press(execution);
  await settle();
  const rows = linksOf(execution);
  assert.ok(rows.length > 1 && rows.every((m) => /schedule row \d/.test(m)), 'started: row by row, as before (RPA-6): ' + rows.slice(0, 2).join(' | '));
  assert.equal(execution.querySelectorAll(':scope .field > .field-error').length, 0, 'and the one message is gone from the field');
  assert.deepEqual(app.jsdomErrors, []);
});
