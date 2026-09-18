'use strict';

// RPA-140: a research question no study answers. RPA-142 required every
// study to answer at least one question; this is the mirror. Gus's decision
// of 17 September 2026: an unclaimed question blocks Studies from being
// complete, so the plan cannot reach sign-off, and the person is told where
// they are standing.
//
// Found by walking the form: complete a plan, go back, add a question, and
// every section kept its tick while Review read "Studies complete". The
// form speaks once every study answers something, never before: part-way
// through saying which questions go where, every question not yet reached
// would be "in no study", and the empty study says what to fix first. It is
// the state that matters, not the moment, so a plan opened with such a
// question says the same. A blank row is not a question yet.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, listInputs, completeStep, DRAFT_KEY, pagePosition, pageCount } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const statuses = (d) => Object.fromEntries(Array.from(d.querySelectorAll('.task-item')).map((li) => [text(li.querySelector('.task-name')), text(li.querySelector('.task-status'))]));
const studyGroups = (d) => Array.from(d.querySelectorAll('.study-group'));
const blocks = (d) => Array.from(d.querySelectorAll('.study-unclaimed')).map((g) => [text(g.querySelector('.flabel')), text(g.querySelector('.study-unclaimed-text'))]);
const marks = (g) => Array.from(g.querySelectorAll('.study-question-also')).map(text);
const banner = (d) => d.querySelector('.notification-banner');
const bannerSays = (d) => (banner(d) && !banner(d).hidden ? text(banner(d).querySelector('.notification-banner-heading')) : null);
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 260));
const go = async (app, slug) => { app.window.location.hash = '#' + slug; await settle(); return stepOf(app.document, slug); };
const addQuestion = async (app, question, outcome) => {
  const { document: d, window } = app;
  d.querySelector('.list-rows[data-list-key="researchQuestions"]').closest('.field').querySelector('.add-btn').click();
  const i = listInputs(d, 'researchQuestions').length - 1;
  if (question !== undefined) setValue(window, listInputs(d, 'researchQuestions')[i], question);
  if (outcome !== undefined) setValue(window, listInputs(d, 'outcomes')[i], outcome);
  await settle();
};

// A plan complete through Execution: one question, one study that answers it.
async function completedPlan(options = {}) {
  const app = await bootApp(options);
  const { document: d } = app;
  for (const i of [1, 2, 3, 4, 5, 6]) {
    await go(app, steps(d)[i].dataset.stepSlug);
    completeStep(app, steps(d)[i]);
    await settle();
  }
  setValue(app.window, listInputs(d, 'researchQuestions')[0], 'Where does choosing a delivery slot break down?');
  await settle();
  return app;
}

test('the bug as found: a question added to a finished plan left every tick in place; now Studies reopens and Review is locked', async (t) => {
  const app = await completedPlan();
  t.after(() => app.close());
  const { document: d } = app;
  await go(app, 'sections');
  assert.deepEqual(statuses(d), { 'Plan details': 'Completed', Context: 'Completed', Research: 'Completed', Studies: 'Completed', Methodology: 'Completed', Execution: 'Completed', Review: 'Not started' });

  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  await go(app, 'sections');
  assert.deepEqual(statuses(d), { 'Plan details': 'Completed', Context: 'Completed', Research: 'Completed', Studies: 'Incomplete', Methodology: 'Completed', Execution: 'Completed', Review: 'Cannot start yet' },
    'Studies is reopened; Methodology and Execution stay open to return to (RPA-100); Review waits');
  app.window.location.hash = '#review';
  await settle();
  assert.deepEqual(visible(d), ['sections'], 'a plan with a question no study answers cannot be signed');
  assert.equal(d.querySelectorAll('.methods-group').length, 1, 'no methods group appears for the question: groups follow studies');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the person is told on the page they are on: the notification banner on Research, with a way to Studies', async (t) => {
  const app = await completedPlan();
  t.after(() => app.close());
  const { document: d } = app;
  const research = await go(app, 'research');
  assert.equal(bannerSays(d), null, 'nothing to say about a finished plan');

  await addQuestion(app);
  assert.equal(bannerSays(d), null, 'a blank row is not a question yet');
  setValue(app.window, listInputs(d, 'researchQuestions')[1], 'For whom does it break down?');
  await settle();
  assert.equal(bannerSays(d), 'RQ2 is not yet in any study', 'said the moment the question says something');
  const b = banner(d);
  assert.equal(b.closest('.step'), research, 'on Research, where the person is');
  assert.equal(b.getAttribute('role'), 'region');
  assert.equal(text(d.getElementById(b.getAttribute('aria-labelledby'))), 'Important', 'the design system\'s banner, named by its title');
  assert.ok(b.compareDocumentPosition(research.querySelector('.step-heading, .acc-head')) & 4, 'above the section\'s heading');

  await addQuestion(app, 'Do people understand the delivery fee?', 'A fee map.');
  assert.equal(bannerSays(d), 'RQ2 and RQ3 are not yet in any study');
  assert.equal(text(b.querySelector('.notification-banner-link')), 'Choose which study answers them');

  b.querySelector('.notification-banner-link').click();
  await settle();
  assert.deepEqual(visible(d), ['studies'], 'the link opens Studies');
  assert.deepEqual([pagePosition(stepOf(d, 'studies')), await pageCount(app, stepOf(d, 'studies'))], [1, 2], 'from its first page');
  assert.match(CSS, /@media print\{\.notification-banner,\.study-unclaimed-list\{display:none!important\}\}/, 'a notice about the form is not part of the printed plan');
  assert.deepEqual(app.jsdomErrors, []);
});

test('while the section the person is in is unfinished, the banner says what to do next instead of offering a link that would be refused', async (t) => {
  const app = await completedPlan();
  t.after(() => app.close());
  const { document: d, window } = app;
  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  const b = banner(d);
  assert.equal(b.querySelector('.notification-banner-go').hidden, false);
  setValue(window, d.querySelector('[data-field="objective"]'), '');
  await settle();
  assert.equal(b.querySelector('.notification-banner-go').hidden, true, 'Research is incomplete, so Studies cannot be opened yet');
  assert.equal(text(b.querySelector('.notification-banner-wait')), 'When this section is complete, choose which study answers it in Studies.');
  assert.equal(b.querySelector('.notification-banner-wait').hidden, false);
  setValue(window, d.querySelector('[data-field="objective"]'), 'Learn where choosing a slot breaks down.');
  await settle();
  assert.equal(b.querySelector('.notification-banner-go').hidden, false, 'and the link comes back with the section');
  assert.equal(b.querySelector('.notification-banner-wait').hidden, true);
  assert.deepEqual(app.jsdomErrors, []);
});

test('on Studies the question is named, marked in every study\'s list, and Save and continue says how to fix it, landing on a checkbox', async (t) => {
  const app = await completedPlan();
  t.after(() => app.close());
  const { document: d } = app;
  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  const studies = await go(app, 'studies');
  assert.deepEqual(blocks(d), [['RQ2 is not yet in any study', 'For whom does it break down?']], 'in full, not a count');
  assert.deepEqual(marks(studyGroups(d)[0]), ['', 'Not yet answered by any study'], 'where the overlap note sits');

  app.window.location.hash = '#studies/2';
  await settle();
  studies.querySelector('.step-continue').click();
  const links = Array.from(studies.querySelectorAll('.error-summary-link'));
  assert.deepEqual(links.map(text), ['Choose a study to answer RQ2'], 'one error per unclaimed question, by number');
  assert.equal(studies.classList.contains('step-checking'), false, 'Studies does not complete');
  links[0].click();
  await settle();
  const box = d.activeElement;
  assert.ok(box.classList.contains('study-question-input'), 'the link lands on a checkbox');
  assert.equal(box.dataset.question, '2', 'the one for that question');
  assert.equal(box.closest('.study-group'), studyGroups(d)[0], 'in the first study');

  box.click();
  await settle();
  assert.deepEqual(blocks(d), [], 'ticked anywhere, it is claimed');
  assert.deepEqual(marks(studyGroups(d)[0]), ['', '']);
  assert.equal(bannerSays(d), null);
  studies.querySelector('.step-continue').click();
  assert.ok(studies.classList.contains('step-checking'), 'and Studies completes');
  await go(app, 'sections');
  assert.equal(statuses(d).Studies, 'Completed');
  assert.equal(statuses(d).Review, 'Not started', 'Review opens again');
  assert.deepEqual(app.jsdomErrors, []);
});

test('with several studies the section is judged on the last study\'s page, and the link goes back to the first study\'s page to land on its checkbox', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3]) { await go(app, steps(d)[i].dataset.stepSlug); completeStep(app, steps(d)[i]); await settle(); }
  setValue(window, listInputs(d, 'researchQuestions')[0], 'Where does it break down?');
  await addQuestion(app, 'For whom?', 'A map.');
  const studies = await go(app, 'studies');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  studyGroups(d)[1].querySelectorAll('.study-question-input')[0].click();   // both answer RQ1; nobody answers RQ2
  await settle();
  window.location.hash = '#studies/3';
  await settle();
  assert.deepEqual([pagePosition(studies), await pageCount(app, studies)], [3, 3], 'Study 2\'s page, the last');
  assert.equal(studyGroups(d)[0].classList.contains('page-hidden'), true, 'Study 1 is on another page');
  studies.querySelector('.step-continue').click();
  const link = Array.from(studies.querySelectorAll('.error-summary-link')).find((a) => text(a) === 'Choose a study to answer RQ2');
  assert.ok(link);
  link.click();
  await settle();
  assert.equal(pagePosition(studies), 2, 'the link opens Study 1\'s page');
  assert.equal(studyGroups(d)[0].classList.contains('page-hidden'), false);
  assert.equal(d.activeElement, studyGroups(d)[0].querySelectorAll('.study-question-input')[1], 'and lands on its checkbox for RQ2');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the check page and Review name the question in full rather than counting fields', async (t) => {
  const app = await completedPlan();
  t.after(() => app.close());
  const { document: d } = app;
  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  await addQuestion(app, 'Do people understand the delivery fee?', 'A fee map.');
  // Review is locked for this plan; a person already there sees the summary redrawn, which is what is read here.
  app.window.location.hash = '#review';
  await settle();
  const review = stepOf(d, 'review');
  const row = review.querySelector('.review-row[data-slug="studies"]');
  assert.equal(text(row.querySelector('.review-state')), 'RQ2 and RQ3 not yet in any study', 'not "2 of 4 fields"');
  const answers = review.querySelector('.review-answers[data-slug="studies"]');
  answers.open = true;
  answers.dispatchEvent(new app.window.Event('toggle'));
  await settle();
  const listed = Array.from(answers.querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
  assert.deepEqual(listed.filter(([k]) => k === 'Not yet in any study'), [
    ['Not yet in any study', 'RQ2 For whom does it break down?'],
    ['Not yet in any study', 'RQ3 Do people understand the delivery fee?'],
  ]);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the form speaks once every study answers something, never while someone is still saying which questions go where', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  for (const i of [1, 2, 3]) { await go(app, steps(d)[i].dataset.stepSlug); completeStep(app, steps(d)[i]); await settle(); }
  setValue(window, listInputs(d, 'researchQuestions')[0], 'Where does it break down?');
  await addQuestion(app, 'For whom?', 'A map.');
  await addQuestion(app, 'Why?', 'A reason.');
  assert.equal(bannerSays(d), null, 'before any study is declared there is nothing to reopen');

  await go(app, 'studies');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  assert.deepEqual(blocks(d), [], 'a fresh page does not open by listing every question as unanswered');
  assert.deepEqual(marks(studyGroups(d)[0]), ['', '', '']);
  studyGroups(d)[0].querySelectorAll('.study-question-input')[0].click();
  await settle();
  assert.deepEqual(blocks(d), [], 'Study 2 still answers nothing: that is the thing to fix first');
  studyGroups(d)[1].querySelectorAll('.study-question-input')[2].click();
  await settle();
  assert.deepEqual(blocks(d), [['RQ2 is not yet in any study', 'For whom?']], 'every study answers something, so the second question has been left over');
  assert.deepEqual(marks(studyGroups(d)[1]), ['Also answered by Study 1', 'Not yet answered by any study', '']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a third question after the second was claimed; a claim taken back; and removing the question removes the problem', async (t) => {
  const app = await completedPlan({ confirm: () => true });
  t.after(() => app.close());
  const { document: d } = app;
  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  await settle();
  assert.equal(bannerSays(d), null, 'the second is claimed');
  await addQuestion(app, 'Do people understand the delivery fee?', 'A fee map.');
  assert.equal(bannerSays(d), 'RQ3 is not yet in any study', 'the third is named by its own number');

  studyGroups(d)[0].querySelectorAll('.study-question-input')[1].click();
  await settle();
  assert.equal(bannerSays(d), 'RQ2 and RQ3 are not yet in any study', 'unticking takes the claim back');

  listInputs(d, 'researchQuestions')[2].closest('.list-row').querySelector('.list-remove').click();
  await settle();
  assert.equal(bannerSays(d), 'RQ2 is not yet in any study', 'the third is gone, and its problem with it');
  listInputs(d, 'researchQuestions')[1].closest('.list-row').querySelector('.list-remove').click();
  await settle();
  assert.equal(bannerSays(d), null);
  await go(app, 'sections');
  assert.equal(statuses(d).Studies, 'Completed');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it is the state that matters, not the moment: a plan opened with an unclaimed question says so, and one fixed stays quiet', async (t) => {
  const app = await completedPlan();
  const { document: d, window } = app;
  await go(app, 'research');
  await addQuestion(app, 'For whom does it break down?', 'A segment map.');
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.lists.researchQuestions.length === 2 && s.lists.outcomes[1] === 'A segment map.' && s; });
  app.close();
  assert.deepEqual(saved.studies.map((s) => s.questions), [[1]], 'nothing about the notice is saved: it is read from the plan');

  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  await go(again, 'research');
  assert.equal(bannerSays(again.document), 'RQ2 is not yet in any study');
  await go(again, 'sections');
  assert.equal(statuses(again.document).Studies, 'Incomplete');

  saved.studies[0].questions = [1, 2];
  const fixed = await bootApp({ draft: saved });
  t.after(() => fixed.close());
  await go(fixed, 'research');
  assert.equal(bannerSays(fixed.document), null, 'claimed, it does not come back on reload');
  await go(fixed, 'sections');
  assert.equal(statuses(fixed.document).Studies, 'Completed');
  assert.deepEqual(fixed.jsdomErrors, []);
});

test('older plans open complete: a plan migrated from per-question groups has every written question claimed', async (t) => {
  const v9 = {
    version: 9, fields: { researchTitle: 'Older plan' }, selects: {},
    lists: { researchQuestions: ['Where does it break down?', 'For whom?'], outcomes: ['A list.', 'A map.'] },
    methods: [
      { question: 'Where does it break down?', methods: ['Interviews'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
      { question: 'For whom?', methods: ['Survey'], characteristics: ['Placed an order'], userGroups: ['Returning customers'], sampleSize: { v: 'Very Large (30+)', o: '' } },
    ],
    tables: {}, custom: {}, signOff: null,
  };
  const app = await bootApp({ draft: v9 });
  t.after(() => app.close());
  assert.deepEqual(blocks(app.document), []);
  await go(app, 'research');
  assert.equal(bannerSays(app.document), null);
  assert.deepEqual(app.jsdomErrors, []);
});
