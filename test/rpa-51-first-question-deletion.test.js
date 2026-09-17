'use strict';

// RPA-51: deleting the first research question used to leave the form
// confused about which outcome and which methods went with which question.
// The pairing rule is positional and the first row is the one people delete
// most, so it gets its own file. RPA-142 moved methods to studies: deleting
// a question drops it from every study and moves later ticks up one; no
// methods are deleted; the studies and their groups are the same nodes
// before and after. The outcome pairing, numbering, focus, draft and Last
// updated behave as they did.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, listInputs, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const inputs = (app, key) => listInputs(app.document, key);
const values = (app, key) => inputs(app, key).map(input => input.value);
const groups = app => Array.from(app.document.querySelectorAll('.methods-group'));
const studies = app => Array.from(app.document.querySelectorAll('.study-group'));
const ticks = app => studies(app).map(g => Array.from(g.querySelectorAll('.study-question-input:checked')).map(c => Number(c.value)));
const add = (app, key = 'researchQuestions') => inputs(app, key)[0].closest('.field').querySelector('.add-btn').click();
const remove = (app, index = 0) => {
  const button = inputs(app, 'researchQuestions')[index].closest('.list-row').querySelector('.list-remove');
  button.focus(); button.click(); return button;
};
const settle = () => new Promise(r => setTimeout(r, 220));
// Three questions, three studies, one question and one method each.
async function populate(app, outcomes = ['O1', 'O2', 'O3'], methods = ['M1', 'M2', 'M3']) {
  add(app); add(app);
  ['Q1', 'Q2', 'Q3'].forEach((v, i) => setValue(app.window, inputs(app, 'researchQuestions')[i], v));
  outcomes.forEach((v, i) => setValue(app.window, inputs(app, 'outcomes')[i], v));
  app.document.querySelector('.select-cell[data-field-key="studyCount"] input[value="Three"]').click();
  await settle();
  studies(app).forEach((g, i) => g.querySelectorAll('.study-question-input')[i].click());
  methods.forEach((v, i) => setValue(app.window, groups(app)[i].querySelector('.list-input'), v));
  await settle();
}
function paired(app, qs, os, ms, tk) {
  assert.deepEqual(values(app, 'researchQuestions'), qs);
  assert.deepEqual(values(app, 'outcomes'), os);
  assert.deepEqual(groups(app).map(g => g.querySelector('.list-input').value), ms);
  assert.deepEqual(ticks(app), tk);
  for (const key of ['researchQuestions', 'outcomes']) {
    inputs(app, key).forEach((input, i) => {
      assert.equal(input.closest('.list-row').querySelector('.list-num').textContent, `${i + 1}.`);
      assert.match(input.getAttribute('aria-label'), new RegExp(` ${i + 1}$`));
    });
  }
  studies(app).forEach((g) => {
    const rows = Array.from(g.querySelectorAll('.study-question'));
    assert.equal(rows.length, qs.length, 'a checkbox per question that exists');
    rows.forEach((row, i) => assert.equal(row.querySelector('.study-question-text').textContent, qs[i]));
  });
}

test('first deletion confirms the outcome, keeps every study and its methods, moves the ticks up, preserves surviving nodes and extra Outcomes, and focuses the next Question', async t => {
  const messages = [];
  const app = await bootApp({ confirm: message => { messages.push(message); return true; } });
  t.after(() => app.close()); await populate(app);
  add(app, 'outcomes'); setValue(app.window, inputs(app, 'outcomes')[3], 'Extra');
  const surviving = inputs(app, 'researchQuestions').slice(1);
  const sameGroups = groups(app);
  remove(app);
  await settle();
  assert.deepEqual(messages, ['Deleting Research Question 1 means:\n\n- Outcome 1 will be deleted\n- Study 1 will no longer answer any research question']);
  paired(app, ['Q2', 'Q3'], ['O2', 'O3', 'Extra'], ['M1', 'M2', 'M3'], [[], [1], [2]]);
  assert.deepEqual(inputs(app, 'researchQuestions'), surviving);
  assert.deepEqual(groups(app), sameGroups, 'the same three groups, none rebuilt');
  assert.equal(app.document.activeElement, surviving[0]);
  const extra = inputs(app, 'outcomes')[2].closest('.list-row').querySelector('.list-remove');
  assert.equal(extra.disabled, false, 'a stray outcome can still be removed on its own');
  assert.deepEqual(app.jsdomErrors, []);
});

test('cancellation preserves DOM, values, numbering, ticks, focus, draft and Last updated', async t => {
  const app = await bootApp({ confirm: () => false });
  t.after(() => app.close()); await populate(app);
  const saved = await waitFor(() => { const s = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.studies && s.studies.length === 3 && s.studies[2].methods[0] === 'M3' && s; });
  const nodes = { q: inputs(app, 'researchQuestions'), o: inputs(app, 'outcomes'), g: groups(app), s: studies(app) };
  const lastUpdated = app.document.querySelector('[data-field="lastUpdated"]').value;
  const button = remove(app);
  await settle();
  paired(app, ['Q1', 'Q2', 'Q3'], ['O1', 'O2', 'O3'], ['M1', 'M2', 'M3'], [[1], [2], [3]]);
  assert.deepEqual({ q: inputs(app, 'researchQuestions'), o: inputs(app, 'outcomes'), g: groups(app), s: studies(app) }, nodes);
  assert.equal(app.document.activeElement, button);
  await settle();
  const after = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
  assert.deepEqual({ lists: after.lists, studies: after.studies }, { lists: saved.lists, studies: saved.studies }, 'nothing changed in the draft');
  assert.equal(app.document.querySelector('[data-field="lastUpdated"]').value, lastUpdated);
  assert.deepEqual(app.jsdomErrors, []);
});

test('an empty first question, with nothing paired or claimed, needs no confirmation', async t => {
  let asked = 0;
  const app = await bootApp({ confirm: () => { asked++; return true; } });
  t.after(() => app.close());
  add(app);
  setValue(app.window, inputs(app, 'researchQuestions')[1], 'Q2');
  remove(app);
  assert.equal(asked, 0);
  assert.deepEqual(values(app, 'researchQuestions'), ['Q2']);
  assert.deepEqual(values(app, 'outcomes'), ['']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a study answering only the first question is the reason to confirm, methods or not', async t => {
  const messages = [];
  const app = await bootApp({ confirm: message => { messages.push(message); return true; } });
  t.after(() => app.close());
  add(app);
  ['Q1', 'Q2'].forEach((v, i) => setValue(app.window, inputs(app, 'researchQuestions')[i], v));
  app.document.querySelector('.select-cell[data-field-key="studyCount"] input[value="One"]').click();
  await settle();
  studies(app)[0].querySelectorAll('.study-question-input')[0].click();
  await settle();
  remove(app);
  await settle();
  assert.deepEqual(messages, ['Deleting Research Question 1 means:\n\n- Study 1 will no longer answer any research question']);
  assert.deepEqual(ticks(app), [[]]);
  assert.equal(groups(app).length, 1, 'the study stays for the person to point at Q2, or remove');
  assert.deepEqual(app.jsdomErrors, []);
});

test('repeat first deletion to one, add again, preserve unrelated list and Methods controls and question warning', async t => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close()); await populate(app);
  const characteristics = groups(app)[2].querySelector('.list-rows[data-list-key="characteristics"] .list-input');
  setValue(app.window, characteristics, 'Kept');
  remove(app); await settle();
  remove(app); await settle();
  paired(app, ['Q3'], ['O3'], ['M1', 'M2', 'M3'], [[], [], [1]]);
  assert.equal(groups(app)[2].querySelector('.list-rows[data-list-key="characteristics"] .list-input').value, 'Kept', 'a study\'s other answers are untouched');
  add(app);
  setValue(app.window, inputs(app, 'researchQuestions')[1], 'Q4');
  await settle();
  paired(app, ['Q3', 'Q4'], ['O3', ''], ['M1', 'M2', 'M3'], [[], [], [1]]);
  assert.ok(studies(app).every(g => g.querySelectorAll('.study-question').length === 2), 'the new question can be ticked in any study');
  assert.ok(groups(app).every(g => g.querySelector('.add-btn')), 'each group keeps its Add method control');
  assert.deepEqual(app.jsdomErrors, []);
});

test('first deletion stales evaluations and saves/reloads positional payloads; Clear Form rebuilds controls', async t => {
  const app = await bootApp({ confirm: () => true, evaluate: () => ({ score: 3, justification: 'ok', recommendations: [] }) });
  t.after(() => app.close()); await populate(app);
  remove(app); await settle();
  const saved = await waitFor(() => { const s = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.lists.researchQuestions.length === 2 && s; });
  assert.deepEqual(saved.lists.researchQuestions, ['Q2', 'Q3']);
  assert.deepEqual(saved.lists.outcomes, ['O2', 'O3']);
  assert.deepEqual(saved.studies.map(s => [s.questions, s.methods]), [[[], ['M1']], [[1], ['M2']], [[2], ['M3']]]);
  const again = await bootApp({ draft: saved, confirm: () => true });
  t.after(() => again.close());
  paired(again, ['Q2', 'Q3'], ['O2', 'O3'], ['M1', 'M2', 'M3'], [[], [1], [2]]);
  again.document.getElementById('clear-btn').click();
  await settle();
  assert.deepEqual(values(again, 'researchQuestions'), ['']);
  assert.deepEqual(values(again, 'outcomes'), ['']);
  assert.equal(studies(again).length, 0, 'no studies declared');
  assert.equal(groups(again).length, 1, 'one group to hold the fields');
  assert.deepEqual(again.jsdomErrors, []);
});
