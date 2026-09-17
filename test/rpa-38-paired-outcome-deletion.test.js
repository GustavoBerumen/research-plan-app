'use strict';

// RPA-38: deleting a research question deletes the outcome paired with it,
// after confirming when something written would go. RPA-142 changed what is
// linked: methods belong to a study, not to a question, so deleting a
// question never deletes methods. The studies drop the question, the
// questions after it move up one so every tick keeps pointing at the
// question it meant, and a study left answering nothing stays, flagged, for
// the person to fix or remove. The outcome pairing is exactly as it was.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DRAFT_KEY,
  bootApp,
  listInputs,
  setValue,
  waitFor,
} = require('./app-harness');

function listNumbers(document, key) {
  return Array.from(document.querySelectorAll(
    '.list-rows[data-list-key="' + key + '"] > .list-row > .list-num'
  )).map((number) => number.textContent);
}
function methodsGroups(document) { return Array.from(document.querySelectorAll('.methods-group')); }
function methodValues(group) {
  return Array.from(group.querySelectorAll('.list-rows[data-list-key="methods"] .list-input')).map((input) => input.value).filter(Boolean);
}
function ticks(document) {
  return Array.from(document.querySelectorAll('.study-group')).map((g) => Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => Number(c.value)));
}
function addListRow(document, key) {
  document.querySelector('.list-rows[data-list-key="' + key + '"]').closest('.field').querySelector('.add-btn').click();
}
function removeQuestion(document, index) {
  const row = listInputs(document, 'researchQuestions')[index].closest('.list-row');
  const button = row.querySelector('.list-remove');
  button.focus();
  button.click();
  return button;
}
const settle = () => new Promise((r) => setTimeout(r, 220));

// Three questions; Study 1 answers RQ1 and RQ2, Study 2 answers RQ2 and RQ3.
async function threeQuestionsTwoStudies(app, { outcomes = ['O1', 'O2', 'O3'], methods = ['M1', 'M2'] } = {}) {
  const { document, window } = app;
  addListRow(document, 'researchQuestions'); addListRow(document, 'researchQuestions');
  ['Q1', 'Q2', 'Q3'].forEach((v, i) => setValue(window, listInputs(document, 'researchQuestions')[i], v));
  outcomes.forEach((v, i) => setValue(window, listInputs(document, 'outcomes')[i], v));
  document.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  const studies = document.querySelectorAll('.study-group');
  studies[0].querySelectorAll('.study-question-input')[0].click();
  studies[0].querySelectorAll('.study-question-input')[1].click();
  studies[1].querySelectorAll('.study-question-input')[1].click();
  studies[1].querySelectorAll('.study-question-input')[2].click();
  methods.forEach((v, i) => setValue(window, methodsGroups(document)[i].querySelector('.list-input'), v));
  await settle();
}

test('deleting a Question with an empty paired Outcome, that no study answers alone, needs no confirmation and removes the exact pair', async (t) => {
  let asked = 0;
  const app = await bootApp({ confirm: () => { asked++; return true; } });
  t.after(() => app.close());
  const { document, window } = app;
  addListRow(document, 'researchQuestions');
  addListRow(document, 'researchQuestions');
  ['Q1', 'Q2', 'Q3'].forEach((v, i) => setValue(window, listInputs(document, 'researchQuestions')[i], v));
  setValue(window, listInputs(document, 'outcomes')[0], 'O1');
  setValue(window, listInputs(document, 'outcomes')[2], 'O3');

  removeQuestion(document, 1);
  assert.equal(asked, 0, 'nothing written would go');
  assert.deepEqual(listInputs(document, 'researchQuestions').map((i) => i.value), ['Q1', 'Q3']);
  assert.deepEqual(listInputs(document, 'outcomes').map((i) => i.value), ['O1', 'O3'], 'the second outcome went with the second question');
  assert.deepEqual(listNumbers(document, 'researchQuestions'), ['1.', '2.']);
  assert.deepEqual(listNumbers(document, 'outcomes'), ['1.', '2.']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('confirming deletion removes a populated Outcome; the studies drop the question and later ticks move up; methods stay', async (t) => {
  const messages = [];
  const app = await bootApp({ confirm: (m) => { messages.push(m); return true; } });
  t.after(() => app.close());
  const { document } = app;
  await threeQuestionsTwoStudies(app);
  assert.deepEqual(ticks(document), [[1, 2], [2, 3]]);

  removeQuestion(document, 1);
  await settle();
  assert.deepEqual(messages, ['Deleting Research Question 2 means:\n\n- Outcome 2 will be deleted'], 'the outcome is what goes; the methods belong to the studies');
  assert.deepEqual(listInputs(document, 'researchQuestions').map((i) => i.value), ['Q1', 'Q3']);
  assert.deepEqual(listInputs(document, 'outcomes').map((i) => i.value), ['O1', 'O3']);
  assert.deepEqual(ticks(document), [[1], [2]], 'what was RQ3 is RQ2 now, and Study 2 still answers it');
  assert.equal(methodsGroups(document).length, 2, 'both studies stay');
  assert.deepEqual(methodsGroups(document).map(methodValues), [['M1'], ['M2']], 'with their methods');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a study that answered only the deleted question is warned about, kept, and marked as answering nothing', async (t) => {
  const messages = [];
  const app = await bootApp({ confirm: (m) => { messages.push(m); return true; } });
  t.after(() => app.close());
  const { document } = app;
  await threeQuestionsTwoStudies(app);
  document.querySelectorAll('.study-group')[1].querySelectorAll('.study-question-input')[1].click();   // Study 2 answers RQ3 only now
  await settle();
  assert.deepEqual(ticks(document), [[1, 2], [3]]);
  setValue(app.window, listInputs(document, 'outcomes')[2], '');

  removeQuestion(document, 2);
  await settle();
  assert.deepEqual(messages, ['Deleting Research Question 3 means:\n\n- Study 2 will no longer answer any research question']);
  assert.deepEqual(ticks(document), [[1, 2], []]);
  assert.equal(methodsGroups(document).length, 2, 'not deleted: the person decides what to do with it');
  assert.deepEqual(methodValues(methodsGroups(document)[1]), ['M2']);
  assert.equal(methodsGroups(document)[1].querySelector('.methods-group-q').textContent, 'Study 2 answers no research question yet');
  assert.deepEqual(app.jsdomErrors, []);
});

test('cancelling populated deletion leaves values, numbering, ticks, controls, and focus unchanged', async (t) => {
  const app = await bootApp({ confirm: () => false });
  t.after(() => app.close());
  const { document } = app;
  await threeQuestionsTwoStudies(app);
  const before = {
    questions: listInputs(document, 'researchQuestions').map((i) => i.value),
    outcomes: listInputs(document, 'outcomes').map((i) => i.value),
    numbers: [listNumbers(document, 'researchQuestions'), listNumbers(document, 'outcomes')],
    ticks: ticks(document),
    methods: methodsGroups(document).map(methodValues),
    groups: methodsGroups(document),
  };
  const button = removeQuestion(document, 1);
  await settle();
  assert.deepEqual(listInputs(document, 'researchQuestions').map((i) => i.value), before.questions);
  assert.deepEqual(listInputs(document, 'outcomes').map((i) => i.value), before.outcomes);
  assert.deepEqual([listNumbers(document, 'researchQuestions'), listNumbers(document, 'outcomes')], before.numbers);
  assert.deepEqual(ticks(document), before.ticks);
  assert.deepEqual(methodsGroups(document).map(methodValues), before.methods);
  assert.deepEqual(methodsGroups(document), before.groups, 'the same nodes, not rebuilt ones');
  assert.equal(document.activeElement, button, 'focus stays on the button that was pressed');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the confirmed structure saves, restores, and evaluates without re-pairing later entries', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document, window } = app;
  await threeQuestionsTwoStudies(app);
  removeQuestion(document, 0);
  await settle();
  assert.deepEqual(ticks(document), [[1], [1, 2]], 'RQ2 and RQ3 became RQ1 and RQ2; Study 1 answers the first, Study 2 both');
  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.lists.researchQuestions.length === 2 && s; });
  assert.deepEqual(saved.lists.researchQuestions, ['Q2', 'Q3']);
  assert.deepEqual(saved.lists.outcomes, ['O2', 'O3']);
  assert.deepEqual(saved.studies.map((s) => [s.questions, s.methods]), [[[1], ['M1']], [[1, 2], ['M2']]]);

  const again = await bootApp({ draft: saved, confirm: () => true });
  t.after(() => again.close());
  assert.deepEqual(listInputs(again.document, 'researchQuestions').map((i) => i.value), ['Q2', 'Q3']);
  assert.deepEqual(listInputs(again.document, 'outcomes').map((i) => i.value), ['O2', 'O3']);
  assert.deepEqual(ticks(again.document), [[1], [1, 2]]);
  assert.deepEqual(methodsGroups(again.document).map(methodValues), [['M1'], ['M2']]);
  assert.deepEqual(again.jsdomErrors, []);
});

test('test-profile loading still builds matching Question and Outcome structures, with one group holding the methods until a study is declared', async (t) => {
  const app = await bootApp({ url: 'https://research-plan.test/?test' });
  t.after(() => app.close());
  const select = app.document.querySelector('.test-profile-select');
  const button = app.document.querySelector('.test-profile-controls button');
  const profile = app.window.TEST_PROFILES[select.value];

  button.click();

  assert.deepEqual(
    listInputs(app.document, 'researchQuestions').map((input) => input.value),
    Array.from(profile.fields.researchQuestions)
  );
  assert.deepEqual(
    listInputs(app.document, 'outcomes').map((input) => input.value),
    Array.from(profile.fields.outcomes)
  );
  assert.equal(methodsGroups(app.document).length, 1, 'a profile declares no studies (RPA-142)');
  if (profile.fields.methods) assert.deepEqual(methodValues(methodsGroups(app.document)[0]), Array.from(profile.fields.methods));
  assert.equal(app.document.querySelectorAll('.section-eval-btn').length, 2);
  assert.ok(Array.from(app.document.querySelectorAll('.eval-controls > .eval-btn')).every(button => button.hidden));
});
