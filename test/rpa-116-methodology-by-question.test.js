'use strict';

// RPA-116 organised Methodology by research question: Methods, Characteristics,
// User Groups and Sample Size asked once per question, the question pinned
// above them, and saved per question in draft version 8. RPA-142 moved the
// unit from the question to the study (Gus's decisions of 16 September
// 2026): a study answers one or more questions, Methodology is asked once
// per study with its questions pinned, and the answers are saved per study
// in draft version 10. What this file holds to is what survived the move:
// the four fields inside each group, the pinned head, the per-group saving
// and restoring, the migration of older plans, and the check page and the
// error summary naming each group.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, listInputs, completeStep, DRAFT_KEY } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const groups = (d) => Array.from(d.querySelectorAll('.methods-group'));
const studyGroups = (d) => Array.from(d.querySelectorAll('.study-group'));
const inGroup = (g, key) => Array.from(g.querySelectorAll('.list-rows[data-list-key="' + key + '"] .list-input')).map((i) => i.value);
const chosen = (g) => { const r = g.querySelector('.select-cell[data-field-key="sampleSize"] input[type=radio]:checked'); return r ? r.value : ''; };
const headOf = (g) => Array.from(g.querySelectorAll('.methods-group-text li')).map(text);
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 220));
const stepOf = (d, slug) => Array.from(d.querySelectorAll('.step')).find((s) => s.dataset.stepSlug === slug);

async function twoQuestionsTwoStudies(app) {
  const { document: d, window } = app;
  window.location.hash = '#research';
  await waitFor(() => listInputs(d, 'researchQuestions').length > 0);
  setValue(window, listInputs(d, 'researchQuestions')[0], 'Where does choosing a delivery slot break down?');
  d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
  setValue(window, listInputs(d, 'researchQuestions')[1], 'Do people understand the delivery fee?');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups(d)[1].querySelectorAll('.study-question-input')[1].click();
  await settle();
}

test('each study carries its own Methods, Characteristics, User Groups and Sample Size, under the questions it answers, pinned', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await twoQuestionsTwoStudies(app);

  assert.equal(groups(d).length, 2, 'one group per study');
  groups(d).forEach((g, i) => {
    assert.equal(text(g.querySelector('.methods-group-q')), 'Study ' + (i + 1) + ' answers');
    assert.equal(g.querySelector('.methods-group-head').hidden, false, 'the head shows once a study is declared');
    ['methods', 'characteristics', 'userGroups'].forEach((key) => assert.ok(g.querySelector('.list-rows[data-list-key="' + key + '"]'), key + ' in group ' + (i + 1)));
    assert.ok(g.querySelector('.select-cell[data-field-key="sampleSize"]'), 'sample size in group ' + (i + 1));
    assert.deepEqual(Array.from(g.querySelectorAll('.per-question-of')).map(text), Array(4).fill('for Study ' + (i + 1)), 'each field is named for its study');
  });
  assert.deepEqual(headOf(groups(d)[0]), ['RQ1 Where does choosing a delivery slot break down?'], 'the whole question, not an abbreviation');
  assert.deepEqual(headOf(groups(d)[1]), ['RQ2 Do people understand the delivery fee?']);
  assert.equal(groups(d)[0].getAttribute('aria-label'), 'Methods for Study 1: RQ1 Where does choosing a delivery slot break down?');

  // A question in two studies shows under both, and says so on the studies page.
  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  await settle();
  assert.deepEqual(headOf(groups(d)[0]), ['RQ1 Where does choosing a delivery slot break down?', 'RQ2 Do people understand the delivery fee?']);
  assert.equal(text(studyGroups(d)[1].querySelectorAll('.study-question-also')[1]), 'Also answered by Study 1');
  assert.equal(text(studyGroups(d)[0].querySelectorAll('.study-question-also')[1]), 'Also answered by Study 2');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the answers are saved per study, in draft version 10, and come back per study', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await twoQuestionsTwoStudies(app);
  const [g1, g2] = groups(d);
  setValue(window, g1.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Moderated usability testing');
  setValue(window, g1.querySelector('.list-rows[data-list-key="characteristics"] .list-input'), 'Abandoned a checkout in the last 30 days');
  setValue(window, g1.querySelector('.list-rows[data-list-key="userGroups"] .list-input'), 'New customers');
  g1.querySelector('.select-cell[data-field-key="sampleSize"] input[value="Small (1–5)"]').click();
  setValue(window, g2.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Online survey');
  g2.querySelector('.select-cell[data-field-key="sampleSize"] input[value="Very Large (30+)"]').click();
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.studies && s.studies[1] && s.studies[1].sampleSize.v === 'Very Large (30+)' && s; });
  assert.equal(saved.version, 10);
  assert.equal(saved.methods, undefined, 'the per-question shape is gone');
  assert.deepEqual(saved.selects.studyCount, { v: 'Two', o: '' });
  assert.deepEqual(saved.studies, [
    { questions: [1], methods: ['Moderated usability testing'], characteristics: ['Abandoned a checkout in the last 30 days'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
    { questions: [2], methods: ['Online survey'], characteristics: [''], userGroups: [''], sampleSize: { v: 'Very Large (30+)', o: '' } },
  ]);

  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  const dd = again.document;
  assert.equal(groups(dd).length, 2);
  assert.deepEqual(studyGroups(dd).map((g) => Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => c.value)), [['1'], ['2']], 'the ticks come back');
  assert.deepEqual(inGroup(groups(dd)[0], 'methods'), ['Moderated usability testing']);
  assert.deepEqual(inGroup(groups(dd)[0], 'characteristics'), ['Abandoned a checkout in the last 30 days']);
  assert.deepEqual(inGroup(groups(dd)[0], 'userGroups'), ['New customers']);
  assert.equal(chosen(groups(dd)[0]), 'Small (1–5)');
  assert.deepEqual(inGroup(groups(dd)[1], 'methods'), ['Online survey']);
  assert.equal(chosen(groups(dd)[1]), 'Very Large (30+)');
  assert.deepEqual(headOf(groups(dd)[1]), ['RQ2 Do people understand the delivery fee?']);
  assert.deepEqual(again.jsdomErrors, []);
});

test('a version 7 plan brings its one answer to every question it had, and a version 9 plan reads as one study per question', async (t) => {
  // v7: participant answers were plan-level; v8 put them in every question's
  // group; v10 makes each group a study answering its own question.
  const v7 = {
    version: 7, fields: { researchTitle: 'Old plan' },
    lists: { researchQuestions: ['Where does it break down?', 'For whom?'], outcomes: ['A list.', 'A map.'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'] },
    selects: { sampleSize: { v: 'Medium (6–12)', o: '' } },
    methods: [{ question: 'Where does it break down?', methods: ['Interviews'] }, { question: 'For whom?', methods: ['Survey'] }],
    tables: {}, custom: {},
  };
  const app = await bootApp({ draft: v7 });
  t.after(() => app.close());
  const { document: d, window } = app;
  assert.equal(groups(d).length, 2, 'two questions, two studies');
  assert.deepEqual(studyGroups(d).map((g) => Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => c.value)), [['1'], ['2']]);
  groups(d).forEach((g) => {
    assert.deepEqual(inGroup(g, 'characteristics'), ['Abandoned a basket'], 'the plan-level answer went to every study');
    assert.deepEqual(inGroup(g, 'userGroups'), ['New customers']);
    assert.equal(chosen(g), 'Medium (6–12)');
  });
  assert.deepEqual(groups(d).map((g) => inGroup(g, 'methods')), [['Interviews'], ['Survey']]);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Old plan, touched');
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.fields.researchTitle === 'Old plan, touched' && s; });
  assert.equal(saved.version, 10);
  assert.equal(saved.lists.characteristics, undefined, 'the plan-level keys go');
  assert.equal(saved.selects.sampleSize, undefined);
  assert.equal(saved.methods, undefined);
  assert.deepEqual(saved.selects.studyCount, { v: 'Two', o: '' }, 'and the radios say how many');
  assert.deepEqual(saved.studies.map((s) => s.questions), [[1], [2]]);
  assert.deepEqual(app.jsdomErrors, []);
});

test('Save and continue judges every study: a second study left blank lists its four fields by name, and the check page names each study', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const steps = Array.from(d.querySelectorAll('.step'));
  for (const i of [1, 2, 3]) {
    window.location.hash = '#' + steps[i].dataset.stepSlug;
    await waitFor(() => steps[i].hidden === false);
    completeStep(app, steps[i]);
  }
  await twoQuestionsTwoStudies(app);
  window.location.hash = '#methodology';
  await waitFor(() => stepOf(d, 'methodology').hidden === false);
  const methodology = stepOf(d, 'methodology');
  const g1 = groups(d)[0];
  setValue(window, g1.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Interviews');
  setValue(window, g1.querySelector('.list-rows[data-list-key="characteristics"] .list-input'), 'Abandoned a basket');
  setValue(window, g1.querySelector('.list-rows[data-list-key="userGroups"] .list-input'), 'New customers');
  g1.querySelector('.select-cell[data-field-key="sampleSize"] input[value="Small (1–5)"]').click();
  // The last page judges the whole section (RPA-108): eight pages, four per study.
  window.location.hash = '#methodology/8';
  await waitFor(() => text(methodology.querySelector('.step-page-caption')) === 'Question 8 of 8');
  methodology.querySelector('.step-continue').click();
  const links = Array.from(methodology.querySelectorAll('.error-summary-link')).map(text);
  assert.deepEqual(links, [
    'Add to Methods for Study 2',
    'Add to Characteristics for Study 2',
    'Add to User Groups for Study 2',
    'Select a sample size for Study 2',
  ], 'the second study, by name, field by field');
  const g2 = groups(d)[1];
  setValue(window, g2.querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Survey');
  setValue(window, g2.querySelector('.list-rows[data-list-key="characteristics"] .list-input'), 'Placed an order');
  setValue(window, g2.querySelector('.list-rows[data-list-key="userGroups"] .list-input'), 'Returning customers');
  g2.querySelector('.select-cell[data-field-key="sampleSize"] input[value="Very Large (30+)"]').click();
  for (let presses = 0; presses < 12 && !methodology.classList.contains('step-checking'); presses++) methodology.querySelector('.step-continue').click();
  assert.ok(methodology.classList.contains('step-checking'), 'complete: the check page');
  const rows = Object.fromEntries(Array.from(methodology.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]));
  assert.equal(rows['Methods for Study 1'], 'Interviews');
  assert.equal(rows['Sample Size for Study 2'], 'Very Large (30+)');
  assert.equal(rows['User Groups for Study 2'], 'Returning customers');
  assert.deepEqual(app.jsdomErrors, []);
});

test('deleting a research question leaves the studies and their methods; a study left with no question says so, and is not deleted', async (t) => {
  const confirms = [];
  const app = await bootApp({ confirm: (message) => { confirms.push(message); return true; } });
  t.after(() => app.close());
  const { document: d, window } = app;
  await twoQuestionsTwoStudies(app);
  setValue(window, groups(d)[1].querySelector('.list-rows[data-list-key="methods"] .list-input'), 'Survey');
  setValue(window, listInputs(d, 'outcomes')[1], 'A fee map.');
  await settle();
  listInputs(d, 'researchQuestions')[1].closest('.list-row').querySelector('.list-remove').click();
  await settle();
  assert.deepEqual(confirms, ['Deleting Research Question 2 means:\n\n- Outcome 2 will be deleted\n- Study 2 will no longer answer any research question']);
  assert.equal(groups(d).length, 2, 'the study and its group stay');
  assert.deepEqual(inGroup(groups(d)[1], 'methods'), ['Survey'], 'and so do its methods');
  assert.equal(text(groups(d)[1].querySelector('.methods-group-q')), 'Study 2 answers no research question yet');
  assert.deepEqual(studyGroups(d).map((g) => g.querySelectorAll('.study-question').length), [1, 1], 'one question left to tick');
  assert.deepEqual(studyGroups(d).map((g) => Array.from(g.querySelectorAll('.study-question-input:checked')).map((c) => c.value)), [['1'], []]);
  assert.deepEqual(app.jsdomErrors, []);
});
