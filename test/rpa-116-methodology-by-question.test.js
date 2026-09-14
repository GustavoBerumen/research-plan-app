'use strict';

// RPA-116. Methodology by research question. Characteristics, User Groups
// and Sample Size are asked once per research question, inside that
// question's group under Methods, with the whole question pinned above them
// while they are answered. They are saved per question in the question's
// group (draft version 8); a plan saved before this brings its one answer to
// every question it had. Save and continue judges every question, the check
// page lists each question's answers by number, and deleting a question
// warns about its participants. Gus's field-placement table, 14 September
// 2026: the research question configuration loop.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, toCheckPage } = require('./app-harness');

const DRAFT_KEY = 'research-plan-app:draft';
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const groupsOf = (d) => Array.from(d.querySelectorAll('.methods-group'));
const inGroup = (g, key) => Array.from(g.querySelectorAll('.list-rows[data-list-key="' + key + '"] .list-input'));
const radioIn = (g, i) => g.querySelectorAll('input[type=radio]')[i];
const checkedIn = (g) => { const r = g.querySelector('input[type=radio]:checked'); return r ? r.value : ''; };
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const savedDraft = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
function twoQuestions(app) {
  const { document: d, window } = app;
  const rq = d.querySelector('.list-rows[data-list-key="researchQuestions"]');
  setValue(window, rq.querySelector('.list-input'), 'Why do people leave?');
  if (rq.querySelectorAll('.list-input').length < 2) rq.closest('.field').querySelector('.add-btn').click();
  setValue(window, rq.querySelectorAll('.list-input')[1], 'What do they expect?');
}
function fillGroup(app, g, values) {
  const { window } = app;
  setValue(window, inGroup(g, 'methods')[0], values.method);
  setValue(window, inGroup(g, 'characteristics')[0], values.characteristic);
  setValue(window, inGroup(g, 'userGroups')[0], values.userGroup);
  const radio = radioIn(g, values.sample);
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
  radio.dispatchEvent(new window.Event('input', { bubbles: true }));
}

test('each research question carries its own Methods, Characteristics, User Groups and Sample Size, under the whole question pinned above them', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  twoQuestions(app);
  const groups = groupsOf(d);
  assert.equal(groups.length, 2);
  groups.forEach((g, i) => {
    const n = i + 1;
    assert.deepEqual(Array.from(g.querySelectorAll('.field-per-question > .flabel')).map(text),
      ['Methods for research question ' + n, 'Characteristics for research question ' + n, 'User Groups for research question ' + n, 'Sample Size for research question ' + n]);
    assert.equal(g.querySelector('.methods-group-head').hidden, false, 'the head shows once there is a question');
    assert.equal(text(g.querySelector('.methods-group-text')), i === 0 ? 'Why do people leave?' : 'What do they expect?', 'the whole question, not the abbreviation');
    assert.equal(g.querySelectorAll('.field-per-question .field-hint-text').length, 4, 'hints travel with the fields');
    assert.equal(g.querySelectorAll('.field-per-question .field-help').length, 4, 'and so do the help links');
  });
  assert.notEqual(radioIn(groups[0], 0).name, radioIn(groups[1], 0).name, 'each question has its own radio group');
  const ids = Array.from(d.querySelectorAll('[id]')).map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, 'no id is duplicated across questions');
  assert.ok(Array.from(d.querySelectorAll('.list-rows[data-list-key="characteristics"]')).every((l) => l.closest('.methods-group')), 'no plan-level Characteristics any more');
  assert.equal(d.querySelector('.field-group-title'), null, 'the Participants group is gone');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the answers are saved per question, in draft version 8, and come back per question', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  twoQuestions(app);
  const groups = groupsOf(d);
  fillGroup(app, groups[0], { method: 'Interviews', characteristic: 'Abandoned a basket', userGroup: 'New customers', sample: 0 });
  fillGroup(app, groups[1], { method: 'Survey', characteristic: 'Regular buyers', userGroup: 'Returning customers', sample: 2 });
  const saved = await waitFor(() => { const s = savedDraft(window); return s && s.methods && s.methods[1] && s.methods[1].sampleSize && s.methods[1].sampleSize.v ? s : null; }, { message: 'the draft was not saved with the second question' });
  assert.equal(saved.version, 8);
  assert.deepEqual(saved.methods[0], { question: 'Why do people leave?', methods: ['Interviews'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } });
  assert.deepEqual(saved.methods[1], { question: 'What do they expect?', methods: ['Survey'], characteristics: ['Regular buyers'], userGroups: ['Returning customers'], sampleSize: { v: 'Large (13–29)', o: '' } });
  assert.equal('characteristics' in saved.lists, false, 'no plan-level list any more');
  assert.equal('sampleSize' in saved.selects, false);
  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  const back = groupsOf(again.document);
  assert.equal(back.length, 2);
  assert.deepEqual(inGroup(back[1], 'characteristics').map((i) => i.value), ['Regular buyers']);
  assert.deepEqual(inGroup(back[1], 'userGroups').map((i) => i.value), ['Returning customers']);
  assert.equal(checkedIn(back[0]), 'Small (1–5)');
  assert.equal(checkedIn(back[1]), 'Large (13–29)');
});

test('a version 7 plan brings its one answer to every question it had, and the plan-level keys go', async (t) => {
  const app = await bootApp({ draft: {
    version: 7, fields: {}, selects: { sampleSize: { v: 'Medium (6–12)', o: '' } },
    lists: { researchQuestions: ['Q1?', 'Q2?'], outcomes: ['O1', 'O2'], characteristics: ['Frequent shoppers'], userGroups: ['New', 'Returning'] },
    methods: [{ question: 'Q1?', methods: ['Interviews'] }, { question: 'Q2?', methods: [] }], tables: {}, custom: {},
  } });
  t.after(() => app.close());
  const { document: d, window } = app;
  const groups = groupsOf(d);
  assert.equal(groups.length, 2);
  groups.forEach((g, i) => {
    assert.deepEqual(inGroup(g, 'characteristics').map((x) => x.value), ['Frequent shoppers'], 'question ' + (i + 1));
    assert.deepEqual(inGroup(g, 'userGroups').map((x) => x.value), ['New', 'Returning'], 'question ' + (i + 1));
    assert.equal(checkedIn(g), 'Medium (6–12)', 'question ' + (i + 1));
  });
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit that saves.');
  const saved = await waitFor(() => { const s = savedDraft(window); return s && s.fields.background === 'An edit that saves.' ? s : null; });
  assert.equal(saved.version, 8);
  assert.equal('characteristics' in saved.lists, false, 'not carried as a leftover');
  assert.equal('userGroups' in saved.lists, false);
  assert.equal('sampleSize' in saved.selects, false);
  assert.deepEqual(saved.methods[1].characteristics, ['Frequent shoppers']);
});

test('Save and continue judges every question: a second question left blank lists its four fields by number, and the check page names each question', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => visible(d)[0] === steps(d)[i].dataset.stepSlug);
    completeStep(app, steps(d)[i]);
  }
  twoQuestions(app);
  window.location.hash = '#methodology';
  await waitFor(() => visible(d)[0] === 'methodology');
  const methodology = steps(d)[4];
  const groups = groupsOf(d);
  fillGroup(app, groups[0], { method: 'Interviews', characteristic: 'Abandoned a basket', userGroup: 'New customers', sample: 0 });
  // One question per page since RPA-108: the first question's four pages
  // pass, and the second question's Methods page stops with its own error.
  toCheckPage(methodology);
  assert.deepEqual(visible(d), ['methodology'], 'stays');
  assert.deepEqual(linksOf(methodology), ['Add to Methods for research question 2']);
  fillGroup(app, groups[1], { method: 'Survey', characteristic: 'Regular buyers', userGroup: 'Returning customers', sample: 2 });
  toCheckPage(methodology);
  assert.ok(methodology.classList.contains('step-checking'), 'complete: the check page');
  const rows = Object.fromEntries(Array.from(methodology.querySelectorAll('.check-answers .summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]));
  assert.equal(rows['Methods for research question 1'], 'Interviews');
  assert.equal(rows['Characteristics for research question 2'], 'Regular buyers');
  assert.equal(rows['Sample Size for research question 2'], 'Large (13–29)');
  assert.equal(rows['Additional information'], 'Not provided');
});

test('deleting a research question warns about its participants, and the last empty group is trimmed but a filled one is kept', async (t) => {
  let asked = '';
  const app = await bootApp({ confirm(message) { asked = message; return false; } });
  t.after(() => app.close());
  const { document: d } = app;
  twoQuestions(app);
  const groups = groupsOf(d);
  fillGroup(app, groups[1], { method: '', characteristic: 'Regular buyers', userGroup: '', sample: 1 });
  const rq = d.querySelector('.list-rows[data-list-key="researchQuestions"]');
  rq.querySelectorAll('.list-remove')[1].click();
  assert.match(asked, /Participants RQ2/, 'the warning names the participants');
  assert.equal(groupsOf(d).length, 2, 'refused, so the group stays');
});
