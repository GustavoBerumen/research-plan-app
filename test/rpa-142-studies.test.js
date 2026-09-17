'use strict';

// RPA-142: Methodology by study. Between Research and Methodology the plan
// says how many studies there are and which research questions each one
// answers; Methodology is then asked once per study. Gus's decisions of 16
// September 2026: a question may be in several studies; every study must
// answer at least one; the studies question comes first and Methodology is
// locked until it is answered; a study has a number and no name; the Stage
// Timeline stays one per plan. What the model, the migration and the
// deletion of questions do is tested with RPA-46, RPA-116, RPA-38 and
// RPA-51; this file holds the studies page itself and the lock.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, listInputs, completeStep, saveAndContinue, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const rows = (d) => Array.from(d.querySelectorAll('.task-item')).map((li) => ({ name: text(li.querySelector('.task-name')), status: text(li.querySelector('.task-status')) }));
const statusOf = (d, name) => rows(d).find((r) => r.name === name).status;
const studyGroups = (d) => Array.from(d.querySelectorAll('.study-group'));
const ticks = (d) => studyGroups(d).map((g) => Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => Number(c.value)));
const radio = (d, value) => d.querySelector('.select-cell[data-field-key="studyCount"] input[value="' + value + '"]');
const otherBox = (d) => d.querySelector('.select-cell[data-field-key="studyCount"] .select-other-input');
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 220));

async function throughResearch(app, questions = ['Where does choosing a delivery slot break down?', 'For whom?', 'Do people understand the delivery fee?']) {
  const { document: d, window } = app;
  for (const i of [1, 2, 3]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    completeStep(app, steps(d)[i]);
  }
  const rq = d.querySelector('.list-rows[data-list-key="researchQuestions"]');
  questions.forEach((q, i) => {
    if (i > 0) rq.closest('.field').querySelector('.add-btn').click();
    setValue(window, listInputs(d, 'researchQuestions')[i], q);
    setValue(window, listInputs(d, 'outcomes')[i], 'Outcome ' + (i + 1));
  });
  await settle();
}

test('the template asks the two studies questions between Research and Methodology, in the design system\'s shapes', () => {
  const research = TEMPLATE.indexOf('\n# Research\n');
  const studies = TEMPLATE.indexOf('\n# Studies\n');
  const methodology = TEMPLATE.indexOf('\n# Methodology\n');
  assert.ok(research < studies && studies < methodology, 'Research, then Studies, then Methodology');
  assert.match(TEMPLATE, /^Number of studies \(radios, question=How many studies will you run\?, key=studyCount\): One,Two,Three$/m, 'radios: One, Two, Three; More than three is the reveal');
  assert.match(TEMPLATE, /^Study questions \(study-questions, question=Which research questions does this study answer\?, key=studyQuestions\):$/m);
  assert.match(CSS, /\.study-question-also\{display:block;font-size:var\(--text-sm\);color:var\(--text-2\)\}/, 'the overlap note is quiet, under the question');
});

test('Studies is a section of its own, and Methodology cannot start until it is complete', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  assert.deepEqual(steps(d).map((s) => s.dataset.stepSlug), ['sections', 'plan-details', 'context', 'research', 'studies', 'methodology', 'execution', 'review']);
  await throughResearch(app);
  window.location.hash = '#sections';
  await waitFor(() => visible(d)[0] === 'sections');
  await settle();
  assert.equal(statusOf(d, 'Studies'), 'Not yet started');
  assert.equal(statusOf(d, 'Methodology'), 'Cannot start yet', 'locked behind the studies question (decision 3)');
  window.location.hash = '#methodology';
  await settle();
  assert.deepEqual(visible(d), ['sections'], 'a hash into it is refused');

  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  assert.equal(d.querySelectorAll('.study-group').length, 0, 'no study until a number is chosen');
  assert.equal(d.querySelectorAll('.methods-group').length, 1, 'one methods group holds the fields meanwhile');
  radio(d, 'Two').click();
  await settle();
  assert.equal(studyGroups(d).length, 2);
  assert.deepEqual(studyGroups(d).map((g) => text(g.querySelector('legend'))), ['Which research questions does Study 1 answer?', 'Which research questions does Study 2 answer?']);
  assert.deepEqual(studyGroups(d).map((g) => Array.from(g.querySelectorAll('.study-question-text')).map(text)), [
    ['Where does choosing a delivery slot break down?', 'For whom?', 'Do people understand the delivery fee?'],
    ['Where does choosing a delivery slot break down?', 'For whom?', 'Do people understand the delivery fee?'],
  ], 'a checkbox per question, in full, in every study');
  window.location.hash = '#sections';
  await waitFor(() => visible(d)[0] === 'sections');
  await settle();
  assert.equal(statusOf(d, 'Studies'), 'Incomplete', 'the number is answered; the studies are not');
  assert.equal(statusOf(d, 'Methodology'), 'Cannot start yet');

  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  studyGroups(d)[1].querySelectorAll('.study-question-input')[1].click();
  studyGroups(d)[1].querySelectorAll('.study-question-input')[2].click();
  await settle();
  window.location.hash = '#sections';
  await waitFor(() => visible(d)[0] === 'sections');
  await settle();
  assert.equal(statusOf(d, 'Studies'), 'Completed');
  assert.equal(statusOf(d, 'Methodology'), 'Not yet started', 'unlocked');
  assert.deepEqual(ticks(d), [[1, 2], [2, 3]], 'a question in two studies (decision 1)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a study with no question cannot continue: the error names the study, and the check page reads each study by its questions', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await throughResearch(app);
  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  const studies = stepOf(d, 'studies');
  radio(d, 'Two').click();
  await settle();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  // The last page judges the whole section: Study 2 has nothing ticked.
  window.location.hash = '#studies/3';
  await waitFor(() => text(studies.querySelector('.step-page-caption')) === 'Question 3 of 3');
  studies.querySelector('.step-continue').click();
  assert.deepEqual(Array.from(studies.querySelectorAll('.error-summary-link')).map(text), ['Select at least one research question for Study 2'], 'decision 2');
  assert.ok(studyGroups(d)[1].classList.contains('field-invalid'));
  studyGroups(d)[1].querySelectorAll('.study-question-input')[2].click();
  assert.equal(studyGroups(d)[1].classList.contains('field-invalid'), false, 'and the mark goes with the tick');
  // Every study answers something now, so the question neither claimed is the one left over (RPA-140).
  studies.querySelector('.step-continue').click();
  assert.deepEqual(Array.from(studies.querySelectorAll('.error-summary-link')).map(text), ['Choose a study to answer RQ2']);
  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  studies.querySelector('.step-continue').click();
  assert.ok(studies.classList.contains('step-checking'), 'complete: the check page');
  const summary = Object.fromEntries(Array.from(studies.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]));
  assert.equal(summary['Number of studies'], 'Two');
  assert.equal(summary['Study 1'], 'RQ1 Where does choosing a delivery slot break down?RQ2 For whom?', 'one line per question it answers');
  assert.equal(summary['Study 2'], 'RQ3 Do people understand the delivery fee?');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the studies page says when a question is already answered by another study', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await throughResearch(app);
  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  radio(d, 'Three').click();
  await settle();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  studyGroups(d)[2].querySelectorAll('.study-question-input')[1].click();
  await settle();
  const notes = (g) => Array.from(g.querySelectorAll('.study-question-also')).map(text);
  assert.deepEqual(notes(studyGroups(d)[0]), ['', 'Also answered by Study 3', '']);
  assert.deepEqual(notes(studyGroups(d)[1]), ['', 'Also answered by Study 1 and Study 3', ''], 'a study that has not claimed it is told who has');
  assert.deepEqual(notes(studyGroups(d)[2]), ['', 'Also answered by Study 1', '']);
  studyGroups(d)[2].querySelectorAll('.study-question-input')[1].click();
  await settle();
  assert.deepEqual(notes(studyGroups(d)[0]), ['', '', ''], 'and the note goes when the overlap does');
  assert.deepEqual(app.jsdomErrors, []);
});

test('More than three reveals the number; a wrong number is not an answer; the count can grow', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await throughResearch(app);
  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  const more = radio(d, '__other__');
  assert.equal(text(d.querySelector('label[for="' + more.id + '"]')), 'More than three', 'the last option in Gus\'s words');
  assert.equal(otherBox(d).closest('.select-other-row').hidden, true, 'put away until chosen');
  more.click();
  await settle();
  assert.equal(otherBox(d).closest('.select-other-row').hidden, false);
  assert.equal(otherBox(d).getAttribute('inputmode'), 'numeric');
  assert.equal(studyGroups(d).length, 0, 'no number yet, no studies');
  setValue(window, otherBox(d), '2');
  await settle();
  assert.equal(studyGroups(d).length, 0, '"more than three" is not two');
  setValue(window, otherBox(d), '5');
  await settle();
  assert.equal(studyGroups(d).length, 5);
  assert.equal(d.querySelectorAll('.methods-group').length, 5, 'and five methods groups follow');
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.studies && s.studies.length === 5 && s; });
  assert.deepEqual(saved.selects.studyCount, { v: '__other__', o: '5' });
  assert.deepEqual(app.jsdomErrors, []);
});

test('reducing the number past a study that has ticks or methods asks first, and a refusal puts the radios back', async (t) => {
  const asked = [];
  let answer = false;
  const app = await bootApp({ confirm: (m) => { asked.push(m); return answer; } });
  t.after(() => app.close());
  const { document: d, window } = app;
  await throughResearch(app);
  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  radio(d, 'Three').click();
  await settle();
  studyGroups(d)[2].querySelectorAll('.study-question-input')[2].click();
  setValue(window, d.querySelectorAll('.methods-group')[2].querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Diary study');
  await settle();

  radio(d, 'One').click();
  await settle();
  assert.deepEqual(asked, ['Reducing to 1 study will delete Study 3, with the methods and participants written for it. Continue?'], 'Study 2 is empty and goes without a word; Study 3 is not');
  assert.equal(radio(d, 'Three').checked, true, 'refused: the radios say Three again');
  assert.equal(studyGroups(d).length, 3);
  assert.equal(d.querySelectorAll('.methods-group')[2].querySelector('.list-rows[data-list-key="methods"] .list-input').value, 'Diary study');

  answer = true;
  radio(d, 'One').click();
  await settle();
  assert.equal(studyGroups(d).length, 1);
  assert.equal(d.querySelectorAll('.methods-group').length, 1);
  assert.equal(radio(d, 'One').checked, true);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a question added after the studies were declared is in no study yet, and no methods group appears for it (what the form then says is RPA-140)', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await throughResearch(app, ['Where does it break down?']);
  window.location.hash = '#studies';
  await waitFor(() => visible(d)[0] === 'studies');
  radio(d, 'One').click();
  await settle();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  await settle();
  window.location.hash = '#research';
  await waitFor(() => visible(d)[0] === 'research');
  d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
  setValue(window, listInputs(d, 'researchQuestions')[1], 'For whom?');
  await settle();
  assert.deepEqual(studyGroups(d).map((g) => g.querySelectorAll('.study-question').length), [2], 'the new question can be ticked');
  assert.deepEqual(ticks(d), [[1]], 'but nobody has claimed it');
  assert.equal(d.querySelectorAll('.methods-group').length, 1, 'no group appeared for it: groups follow studies, not questions');
  assert.deepEqual(app.jsdomErrors, []);
});
