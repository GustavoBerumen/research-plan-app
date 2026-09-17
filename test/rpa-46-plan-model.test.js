'use strict';

// RPA-46, first slice, and RPA-142. The plan's linked relationships as
// information: one place that says how the parts connect, instead of every
// reader counting elements on the page for itself.
//
// Three relationships run through a plan. Outcome N answers Question N. A
// study answers one or more questions, and a question may be answered by
// more than one study. Methods, Characteristics, User Groups and Sample Size
// belong to a study. Position is identity for questions and outcomes, and a
// blank row keeps its place, so answering question three later cannot turn
// the outcome written for it into the answer to question two.
//
// Print is untouched by either ticket so far; it still renders from the
// form's own DOM. The point of putting the rules here first is that a second
// view can render from the plan without asking the first view how it counted.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PLAN = require('../plan-model');
const { bootApp, setValue, waitFor, listInputs } = require('./app-harness');

const SOURCE = path.join(__dirname, '..', 'plan-model.js');
const settle = () => new Promise((r) => setTimeout(r, 220));

test('position is identity: a blank row keeps its place so the numbering cannot shift', () => {
  assert.deepEqual(PLAN.numbered(['One', '', 'Three']), [
    { number: 1, text: 'One' }, { number: 2, text: '' }, { number: 3, text: 'Three' },
  ]);
  assert.deepEqual(PLAN.answered(['One', '', 'Three']), [{ number: 1, text: 'One' }, { number: 3, text: 'Three' }],
    'the empty one is not an answer, and the one after it is still the third');
  assert.deepEqual(PLAN.numbered(['  spaced  ']), [{ number: 1, text: 'spaced' }], 'trimmed, as a person meant it');
  assert.deepEqual(PLAN.numbered(undefined), [], 'a plan with nothing written has nothing to number');
  assert.deepEqual(PLAN.answered(null), []);
  assert.equal(PLAN.hasAnyQuestion(['', '  ']), false);
  assert.equal(PLAN.hasAnyQuestion(['', 'Something?']), true);
  assert.equal(PLAN.questionNumber(2), 'RQ3');
});

test('outcomes track questions row for row, not answer for answer', () => {
  assert.equal(PLAN.outcomeCount([]), 0, 'nothing to answer yet');
  assert.equal(PLAN.outcomeCount(['', '']), 2, 'a question still to be written already has the row that will answer it');
  assert.equal(PLAN.outcomeCount(['One?', 'Two?', 'Three?']), 3);
});

test('how many studies: the radios say One, Two or Three, and More than three carries the number', () => {
  assert.equal(PLAN.studyCount({ v: 'One', o: '' }), 1);
  assert.equal(PLAN.studyCount({ v: 'Two', o: '' }), 2);
  assert.equal(PLAN.studyCount({ v: 'Three', o: '' }), 3);
  assert.equal(PLAN.studyCount({ v: '__other__', o: '5' }), 5);
  assert.equal(PLAN.studyCount({ v: '__other__', o: ' 4 ' }), 4, 'a number is a number however it was typed');
  assert.equal(PLAN.studyCount({ v: '__other__', o: '2' }), 0, '"more than three" is not two');
  assert.equal(PLAN.studyCount({ v: '__other__', o: 'many' }), 0, 'nor is a word');
  assert.equal(PLAN.studyCount({ v: '__other__', o: '' }), 0, 'nor nothing yet');
  assert.equal(PLAN.studyCount({ v: '', o: '' }), 0, 'unanswered is none');
  assert.equal(PLAN.studyCount(undefined), 0);
  assert.deepEqual([1, 2, 3, 4, 0].map(PLAN.studyCountChoice), [
    { v: 'One', o: '' }, { v: 'Two', o: '' }, { v: 'Three', o: '' }, { v: '__other__', o: '4' }, { v: '', o: '' },
  ], 'and the other way round, for a plan that already has that many');
  assert.equal(PLAN.studyLabel(1), 'Study 2', 'a study has a number and no name');
});

test('one methods group per study; before any study is declared there is nothing to answer methods for', () => {
  assert.equal(PLAN.groupCount([]), 0);
  assert.equal(PLAN.groupCount([{ questions: [1] }, { questions: [1, 2] }]), 2);
  assert.equal(PLAN.groupCount(undefined), 0);
});

test('a study is kept honest: whole, unique, ordered question numbers, never past the questions the plan has', () => {
  assert.deepEqual(PLAN.study({ questions: [3, '1', 3, 0, -2, 1.5, 'x'], methods: ['Interviews'] }), {
    questions: [1, 3], methods: ['Interviews'], characteristics: [], userGroups: [], sampleSize: { v: '', o: '' },
  });
  assert.deepEqual(PLAN.study({ questions: [1, 4] }, 3).questions, [1], 'question four does not exist in a plan with three');
  assert.deepEqual(PLAN.study(null), { questions: [], methods: [], characteristics: [], userGroups: [], sampleSize: { v: '', o: '' } });
  assert.deepEqual(PLAN.studiesOf({ lists: { researchQuestions: ['a', 'b'] }, studies: [{ questions: [2, 3] }] }).map((s) => s.questions), [[2]]);
  assert.deepEqual(PLAN.studiesOf(null), []);
});

test('which studies answer a question, which studies answer none, and which questions nobody answers yet', () => {
  const studies = [{ questions: [1, 2] }, { questions: [2, 3] }, { questions: [] }];
  assert.deepEqual(PLAN.studiesFor(studies, 2), [0, 1], 'a question can be answered by more than one study');
  assert.deepEqual(PLAN.studiesFor(studies, 3), [1]);
  assert.deepEqual(PLAN.studiesFor(studies, 4), []);
  assert.deepEqual(PLAN.emptyStudies(studies), [2], 'the third answers nothing, which the check page must say');
  assert.deepEqual(PLAN.unassigned(['a', 'b', 'c', 'd'], studies), [4], 'the fourth question is in no study');
  assert.deepEqual(PLAN.unassigned(['a'], []), [1]);
  assert.deepEqual(PLAN.unassigned(['a', '', '  ', 'd'], [{ questions: [1] }]), [4], 'a blank row is not a question yet, so it needs no study (RPA-140)');
  assert.equal(PLAN.hasContent({ questions: [1] }), false, 'a study that has said nothing has no content');
  assert.equal(PLAN.hasContent({ methods: [' Interviews '] }), true);
  assert.equal(PLAN.hasContent({ sampleSize: { v: 'Small (1–5)', o: '' } }), true);
  assert.equal(PLAN.hasContent({ characteristics: ['', ' '] }), false, 'blank rows are not content');
});

test('when the form speaks about a question in no study: once every study answers something, never before', () => {
  assert.deepEqual(PLAN.unclaimed(['a', 'b', 'c'], []), [], 'before any study is declared there is nothing to reopen');
  assert.deepEqual(PLAN.unclaimed(['a', 'b', 'c'], [{ questions: [1] }, { questions: [] }]), [],
    'part-way through saying which questions go where, the empty study is the thing to fix first');
  assert.deepEqual(PLAN.unclaimed(['a', 'b', 'c'], [{ questions: [1] }, { questions: [3] }]), [2], 'every study answers something: the second question has been left over');
  assert.deepEqual(PLAN.unclaimed(['a', 'b', 'c'], [{ questions: [1, 2] }, { questions: [2, 3] }]), [], 'all claimed');
  assert.deepEqual(PLAN.unclaimed(['a', ''], [{ questions: [1] }]), [], 'a blank row is not left over');
});

test('removing a question: every study drops it, and the questions after it move up one', () => {
  const studies = [{ questions: [1, 2], methods: ['Usability testing'] }, { questions: [2, 3] }, { questions: [3] }];
  const after = PLAN.withoutQuestion(studies, 2);
  assert.deepEqual(after.map((s) => s.questions), [[1], [2], [2]], 'what was question three is question two now');
  assert.deepEqual(after[0].methods, ['Usability testing'], 'the methods belong to the study and stay');
  assert.deepEqual(PLAN.withoutQuestion([{ questions: [1] }], 1).map((s) => s.questions), [[]], 'a study can be left answering nothing; it is not deleted');
  assert.deepEqual(studies.map((s) => s.questions), [[1, 2], [2, 3], [3]], 'the plan handed in is unchanged');
});

test('a plan saved before studies existed reads as one study per group, with every answer in place', () => {
  const groups = [
    { question: 'Where does it break down?', methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
    { question: '', methods: [''] },
    { question: 'For whom?', methods: [] },
  ];
  const studies = PLAN.studiesFromGroups(groups, ['Where does it break down?', '', 'For whom?']);
  assert.deepEqual(studies.map((s) => s.questions), [[1], [3]], 'an untouched default group is not a study: nobody declared one');
  assert.deepEqual(studies[0], {
    questions: [1], methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' },
  });
  assert.deepEqual(PLAN.studiesFromGroups([{ methods: ['Survey'] }], []).map((s) => s.questions), [[]],
    'a group with content but no question row becomes a study answering nothing, rather than losing the survey');
  assert.deepEqual(PLAN.studiesFromGroups([{ question: '', methods: [''] }], ['']), [],
    'one empty group beside one empty question is a fresh plan, not a study');
  assert.deepEqual(PLAN.studiesFromGroups(undefined, ['a']), []);
});

test('the per-question view, for the submission wire format that predates studies', () => {
  const studies = [
    { questions: [1, 2], methods: ['Usability testing'], characteristics: ['Abandoned a basket'], sampleSize: { v: 'Small (1–5)', o: '' } },
    { questions: [2, 3], methods: ['Survey', 'usability testing'], userGroups: ['Returning'], sampleSize: { v: 'Very Large (30+)', o: '' } },
  ];
  const view = PLAN.perQuestionView(['Where?', 'For whom?', 'Why?'], studies);
  assert.deepEqual(view.map((g) => g.question), ['Where?', 'For whom?', 'Why?'], 'one group per question, in order');
  assert.deepEqual(view[1].methods, ['Usability testing', 'Survey'], 'a question in two studies gets both, once each, first study first');
  assert.deepEqual(view[1].characteristics, ['Abandoned a basket']);
  assert.deepEqual(view[1].userGroups, ['Returning']);
  assert.deepEqual(view[1].sampleSize, { v: 'Small (1–5)', o: '' }, 'the sample size is the first covering study\'s');
  assert.deepEqual(view[2].sampleSize, { v: 'Very Large (30+)', o: '' });
  assert.deepEqual(PLAN.perQuestionView(['Alone?'], []), [{ question: 'Alone?', methods: [], characteristics: [], userGroups: [], sampleSize: { v: '', o: '' } }],
    'a question no study answers has an empty group');
});

test('the linked view puts each study with the questions it answers, each with its outcome, and the methods that serve it', () => {
  const links = PLAN.link({
    questions: ['Where does it break down?', '', 'For whom?'],
    outcomes: ['A ranked list.', '', 'A segment map.'],
    studies: [
      { questions: [1, 3], methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
      { questions: [2] },
    ],
  });
  assert.equal(links.length, 2);
  assert.deepEqual(links[0], {
    number: 1, label: 'Study 1',
    questions: [
      { number: 1, label: 'RQ1', question: 'Where does it break down?', outcome: 'A ranked list.' },
      { number: 3, label: 'RQ3', question: 'For whom?', outcome: 'A segment map.' },
    ],
    methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' },
  });
  assert.deepEqual(links[1].questions, [{ number: 2, label: 'RQ2', question: '', outcome: '' }], 'the blank question is present and empty, not missing');
  assert.deepEqual(PLAN.link({}), [], 'a plan with no studies reads as none, which is what it is');
});

test('the same view can be taken from a saved draft, which is what a second view will render from', () => {
  const draft = {
    lists: { researchQuestions: ['Where does it break down?', 'For whom?'], outcomes: ['A ranked list.', 'A segment map.'] },
    studies: [{ questions: [1, 2], methods: ['Usability testing'] }],
  };
  assert.deepEqual(PLAN.linksOf(draft).map((l) => [l.label, l.questions.map((q) => q.label + ': ' + q.outcome), l.methods]), [
    ['Study 1', ['RQ1: A ranked list.', 'RQ2: A segment map.'], ['Usability testing']],
  ]);
  assert.deepEqual(PLAN.linksOf({}), []);
  assert.deepEqual(PLAN.linksOf(null), []);
});

test('the copy a link hands back is its own: changing it cannot reach back into the plan', () => {
  const methods = ['Interviews'];
  const links = PLAN.link({ questions: ['One?'], studies: [{ questions: [1], methods }] });
  links[0].methods.push('Survey');
  assert.deepEqual(methods, ['Interviews'], 'the plan is unchanged');
});

test('the form counts the same way the model does: groups follow the studies, outcomes follow the questions', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#research';
  await waitFor(() => listInputs(d, 'researchQuestions').length > 0);
  const groups = () => d.querySelectorAll('.methods-group').length;
  const outcomes = () => listInputs(d, 'outcomes').length;
  const questions = () => listInputs(d, 'researchQuestions').map((i) => i.value);
  const studies = () => Array.from(d.querySelectorAll('.study-group')).map((g) => ({ questions: Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => Number(c.dataset.question)) }));

  assert.equal(outcomes(), PLAN.outcomeCount(questions()));
  assert.equal(groups(), 1, 'one group to hold the fields before a study is declared');
  assert.equal(PLAN.groupCount(studies()), 0, 'which the model does not count as a study');

  setValue(window, listInputs(d, 'researchQuestions')[0], 'Where does choosing a slot break down?');
  d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
  setValue(window, listInputs(d, 'researchQuestions')[1], 'For whom?');
  await settle();
  assert.equal(outcomes(), PLAN.outcomeCount(questions()), 'two questions, two outcome rows');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  assert.equal(groups(), PLAN.groupCount(studies()), 'two studies, two groups');
  d.querySelectorAll('.study-group')[1].querySelectorAll('.study-question-input')[1].click();
  await settle();
  assert.deepEqual(PLAN.studiesFor(studies(), 2), [1], 'the second study answers the second question');
  assert.equal(d.querySelectorAll('.methods-group')[1].getAttribute('aria-label'), 'Methods for Study 2: RQ2 For whom?',
    'the second group is named for its study and the question it answers, by the model\'s own numbering');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it runs in a page as well as in the server, the way the other shared modules do', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), context, { filename: 'plan-model.js' });
  assert.ok(context.RPA_PLAN_MODEL, 'it puts itself on the page when there is no module to export to');
  assert.equal(context.RPA_PLAN_MODEL.questionNumber(2), 'RQ3');
  assert.equal(context.RPA_PLAN_MODEL.studyCount({ v: 'Two', o: '' }), 2);
});
