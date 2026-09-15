'use strict';

// RPA-46, first slice. The plan's linked relationships as information: one
// place that says how the parts connect, instead of every reader counting
// elements on the page for itself.
//
// Two relationships run through a plan. Outcome N answers Question N, and
// Methods are grouped one per question. Position is identity in both, and a
// blank row keeps its place, so answering question three later cannot turn
// the outcome written for it into the answer to question two.
//
// Print is untouched in this slice; it still renders from the form's own
// DOM. The point of putting the rules here first is that a second view can
// render from the plan without asking the first view how it counted.

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
});

test('one methods group per question, and one to write in before there are any', () => {
  assert.equal(PLAN.groupCount([]), 1, 'an empty plan still offers somewhere to start');
  assert.equal(PLAN.groupCount(['', '']), 1, 'and so does one with rows but no questions yet');
  assert.equal(PLAN.groupCount(['Where does it break down?']), 1);
  assert.equal(PLAN.groupCount(['One?', '', 'Three?']), 3, 'a blank question in the middle still has its group');
  assert.equal(PLAN.hasAnyQuestion(['', '  ']), false);
  assert.equal(PLAN.hasAnyQuestion(['', 'Something?']), true);
});

test('outcomes track questions row for row, not answer for answer', () => {
  assert.equal(PLAN.outcomeCount([]), 0, 'nothing to answer yet');
  assert.equal(PLAN.outcomeCount(['', '']), 2, 'a question still to be written already has the row that will answer it');
  assert.equal(PLAN.outcomeCount(['One?', 'Two?', 'Three?']), 3);
});

test('the linked view puts each question with the outcome that answers it and the methods that serve it', () => {
  const links = PLAN.link({
    questions: ['Where does it break down?', '', 'For whom?'],
    outcomes: ['A ranked list.', '', 'A segment map.'],
    methods: [
      { methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
      {},
      { methods: ['Interviews'] },
    ],
  });
  assert.equal(links.length, 3);
  assert.deepEqual(links[0], {
    number: 1, label: 'RQ1', question: 'Where does it break down?', outcome: 'A ranked list.',
    methods: ['Usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'],
    sampleSize: { v: 'Small (1–5)', o: '' },
  });
  assert.deepEqual(links[1], { number: 2, label: 'RQ2', question: '', outcome: '', methods: [], characteristics: [], userGroups: [], sampleSize: null },
    'the blank one is present and empty, not missing');
  assert.equal(links[2].question, 'For whom?');
  assert.equal(links[2].outcome, 'A segment map.', 'the third outcome answers the third question, not the second');
  assert.deepEqual(links[2].methods, ['Interviews']);

  const empty = PLAN.link({});
  assert.equal(empty.length, 1, 'an empty plan reads as one empty question, so nothing has to special-case nothing');
  assert.deepEqual(empty[0], { number: 1, label: 'RQ1', question: '', outcome: '', methods: [], characteristics: [], userGroups: [], sampleSize: null });
});

test('the same view can be taken from a saved draft, which is what a second view will render from', () => {
  const draft = {
    lists: { researchQuestions: ['Where does it break down?', 'For whom?'], outcomes: ['A ranked list.', 'A segment map.'] },
    methods: [{ methods: ['Usability testing'] }, { methods: ['Interviews'] }],
  };
  assert.deepEqual(PLAN.linksOf(draft).map((l) => [l.label, l.question, l.outcome, l.methods]), [
    ['RQ1', 'Where does it break down?', 'A ranked list.', ['Usability testing']],
    ['RQ2', 'For whom?', 'A segment map.', ['Interviews']],
  ]);
  assert.equal(PLAN.linksOf({}).length, 1, 'a draft with nothing in it reads the same as an empty plan');
  assert.equal(PLAN.linksOf(null).length, 1);
});

test('the copy a link hands back is its own: changing it cannot reach back into the plan', () => {
  const methods = ['Interviews'];
  const links = PLAN.link({ questions: ['One?'], methods: [{ methods }] });
  links[0].methods.push('Survey');
  assert.deepEqual(methods, ['Interviews'], 'the plan is unchanged');
});

test('the form counts the same way the model does: outcomes and groups follow the questions', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#research';
  await waitFor(() => listInputs(d, 'researchQuestions').length > 0);
  const groups = () => d.querySelectorAll('.methods-group').length;
  const outcomes = () => listInputs(d, 'outcomes').length;
  const questions = () => listInputs(d, 'researchQuestions').map((i) => i.value);

  assert.equal(groups(), PLAN.groupCount(questions()), 'an empty plan: one group to write in');
  assert.equal(outcomes(), PLAN.outcomeCount(questions()));

  setValue(window, listInputs(d, 'researchQuestions')[0], 'Where does choosing a slot break down?');
  d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
  setValue(window, listInputs(d, 'researchQuestions')[1], 'For whom?');
  await settle();
  assert.equal(questions().length, 2);
  assert.equal(groups(), PLAN.groupCount(questions()), 'two questions, two groups');
  assert.equal(outcomes(), PLAN.outcomeCount(questions()), 'and two outcome rows');
  assert.equal(d.querySelectorAll('.methods-group')[1].getAttribute('aria-label').startsWith('Methods for ' + PLAN.questionNumber(1)), true,
    'the second group is named for the second question, by the model\'s own numbering');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it runs in a page as well as in the server, the way the other shared modules do', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), context, { filename: 'plan-model.js' });
  assert.ok(context.RPA_PLAN_MODEL, 'it puts itself on the page when there is no module to export to');
  assert.equal(context.RPA_PLAN_MODEL.questionNumber(2), 'RQ3');
  assert.equal(context.RPA_PLAN_MODEL.groupCount([]), 1);
});
