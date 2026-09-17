'use strict';

// RPA-141: name every researcher involved. The plan named one Lead
// researcher and one Project requester and had nowhere to say who else. After
// the Lead researcher, Plan details asks whether other researchers are
// involved and, only if so, their names.
//
// Built from the template, not from code about researchers: a radios field
// marked "closed" offers no "Other", and "reveals=" names the field that is
// asked only when its first option is chosen. While that field is not asked
// it is no page, no required answer, no check row and nothing in print; what
// was typed in it is kept in case the answer changes back. Names only, for
// now. The sign-off stays between the two roles (RPA-134), evaluation never
// sees the names, and the submission wire format does not carry them.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');
const contract = require('../submission-contract');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = () => new Promise((r) => setTimeout(r, 260));
const planOf = (d) => d.querySelector('.doc-header');
const caption = (d) => text(planOf(d).querySelector('.step-page-caption'));
const cellOf = (d) => d.querySelector('.select-cell[data-field-key="otherResearchers"]');
const namesUnit = (d) => d.querySelector('.list-rows[data-list-key="researcherNames"]').closest('.mf');
const nameInputs = (d) => Array.from(namesUnit(d).querySelectorAll('.list-input'));
const choose = (d, value) => cellOf(d).querySelector('input[value="' + value + '"]').click();
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const press = (d) => planOf(d).querySelector('.step-continue').click();
const links = (d) => Array.from(planOf(d).querySelectorAll('.error-summary-link')).map(text);
const rowsOf = (d) => Array.from(planOf(d).querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
async function onPlanDetails(app) { app.window.location.hash = '#plan-details'; await settle(); return planOf(app.document); }

test('the template asks it after Lead researcher, as a closed yes or no that reveals the names', () => {
  const lead = TEMPLATE.indexOf('\nLead researcher (');
  const other = TEMPLATE.indexOf('\nOther researchers (');
  const names = TEMPLATE.indexOf('\nResearcher names (');
  const requester = TEMPLATE.indexOf('\nProject requester (');
  assert.ok(lead < other && other < names && names < requester, 'Lead researcher, whether others are involved, their names, then the requester');
  assert.match(TEMPLATE, /^Other researchers \(radios, closed, reveals=researcherNames, question=Are other researchers involved in this research\?, key=otherResearchers\): Yes,No$/m);
  assert.match(TEMPLATE, /^Researcher names \(list, width=20, key=researcherNames\):$/m);
  assert.match(CSS, /\.mf\[hidden\]\{display:none\}/, 'a header field lays itself out with flex, which would beat the hidden attribute without this');
});

test('yes or no, with no "Other"; the names are not asked until the answer is yes', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  await onPlanDetails(app);
  const fieldset = cellOf(d).closest('fieldset');
  assert.equal(text(fieldset.querySelector('legend')), 'Are other researchers involved in this research?', 'the legend asks the question');
  assert.deepEqual(Array.from(cellOf(d).querySelectorAll('.radio-label')).map(text), ['Yes', 'No'], 'a closed set: there is no third answer');
  assert.equal(cellOf(d).querySelector('.radio-other-row'), null);
  assert.equal(namesUnit(d).hidden, true, 'not asked yet');
  assert.equal(caption(d), 'Question 1 of 7', 'seven pages while nobody else is involved (the two dates have a page each since RPA-144)');

  choose(d, 'Yes');
  await settle();
  assert.equal(namesUnit(d).hidden, false, 'asked');
  assert.equal(caption(d), 'Question 1 of 8', 'and it is a page of its own');
  assert.equal(text(namesUnit(d).querySelector('.add-btn')), '+ Add researcher name');
  namesUnit(d).querySelector('.add-btn').click();
  assert.deepEqual(nameInputs(d).map((i) => i.getAttribute('aria-label')), ['Researcher name 1', 'Researcher name 2'], 'each row names itself');

  choose(d, 'No');
  await settle();
  assert.equal(namesUnit(d).hidden, true, 'put away again');
  assert.equal(caption(d), 'Question 1 of 7');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the question is required; the names are required only while they are asked', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onPlanDetails(app);
  completeStep(app, planOf(d));   // answers Yes and gives a name
  window.location.hash = '#plan-details/8';
  await settle();
  assert.equal(caption(d), 'Question 8 of 8');
  nameInputs(d).forEach((i) => setValue(window, i, ''));
  press(d);
  assert.deepEqual(links(d), ['Enter the name of at least one other researcher'], 'yes, but nobody named');

  choose(d, 'No');
  await settle();
  window.location.hash = '#plan-details/7';
  await settle();
  press(d);
  assert.ok(planOf(d).classList.contains('step-checking'), 'no: the empty names are not asked for, and the section completes');
  assert.deepEqual(rowsOf(d).filter(([k]) => /researcher/i.test(k)), [['Lead researcher', 'Filled.'], ['Other researchers', 'No']], 'and the check page has no row for a question that was not asked');

  cellOf(d).querySelectorAll('.radio-input').forEach((r) => { r.checked = false; });
  cellOf(d).querySelector('.radio-input').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.location.hash = '#plan-details/7';
  await settle();
  press(d);
  assert.deepEqual(links(d), ['Select yes if other researchers are involved in this research'], 'unanswered, the question is asked for in the template\'s own words');
  assert.match(TEMPLATE, /^  Error: Select yes if other researchers are involved in this research$/m);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the check page and Review show who else is involved', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onPlanDetails(app);
  completeStep(app, planOf(d));
  setValue(window, nameInputs(d)[0], 'Sam Okoro');
  namesUnit(d).querySelector('.add-btn').click();
  setValue(window, nameInputs(d)[1], 'Lena Fischer');
  window.location.hash = '#plan-details/8';
  await settle();
  press(d);
  assert.ok(planOf(d).classList.contains('step-checking'));
  const rows = Object.fromEntries(rowsOf(d));
  assert.equal(rows['Other researchers'], 'Yes', 'the field keeps its name on the check page while the legend asks the question');
  assert.equal(rows['Researcher names'], 'Sam OkoroLena Fischer', 'one line each');
  assert.deepEqual(app.jsdomErrors, []);
});

test('saved in the draft with no new version, restored with the reveal, and the names survive a change of mind', async (t) => {
  const app = await bootApp({});
  const { document: d, window } = app;
  await onPlanDetails(app);
  choose(d, 'Yes');
  await settle();
  setValue(window, nameInputs(d)[0], 'Sam Okoro');
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.lists.researcherNames && s.lists.researcherNames[0] === 'Sam Okoro' && s; });
  assert.deepEqual(saved.selects.otherResearchers, { v: 'Yes', o: '' });
  assert.equal(saved.version, 10, 'two new keys in places older builds already carry forward: no version bump, no one-way door');

  choose(d, 'No');
  await settle();
  const after = await waitFor(() => { const s = draftOf(window); return s && s.selects.otherResearchers.v === 'No' && s; });
  assert.deepEqual(after.lists.researcherNames, ['Sam Okoro'], 'kept, in case the answer changes back');
  choose(d, 'Yes');
  await settle();
  assert.deepEqual(nameInputs(d).map((i) => i.value), ['Sam Okoro']);
  app.close();

  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  assert.equal(namesUnit(again.document).hidden, false, 'a restored yes reveals the names, though restoring fires no change event');
  assert.deepEqual(nameInputs(again.document).map((i) => i.value), ['Sam Okoro']);

  const older = await bootApp({ draft: { version: 9, fields: { researchTitle: 'Older plan', leadResearcher: 'Priya Nair' }, selects: {}, lists: {}, methods: [], tables: {}, custom: {}, signOff: null } });
  t.after(() => older.close());
  assert.equal(cellOf(older.document).querySelector('.radio-input:checked'), null, 'an older plan has simply not been asked yet');
  assert.equal(namesUnit(older.document).hidden, true);
  assert.deepEqual(again.jsdomErrors, []);
  assert.deepEqual(older.jsdomErrors, []);
});

test('Clear Form puts the names away with the answer', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  await onPlanDetails(app);
  choose(d, 'Yes');
  await settle();
  setValue(window, nameInputs(d)[0], 'Sam Okoro');
  d.getElementById('clear-btn').click();
  await settle();
  assert.equal(cellOf(d).querySelector('.radio-input:checked'), null);
  assert.equal(namesUnit(d).hidden, true);
  assert.deepEqual(nameInputs(d).map((i) => i.value), ['']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('nobody else sees the names: evaluation does not, the sign-off is still two people, and receipts do not carry them', async (t) => {
  const app = await bootApp({ evaluate: () => ({ score: 3, justification: 'ok', recommendations: [] }) });
  t.after(() => app.close());
  const { document: d, window } = app;
  await onPlanDetails(app);
  choose(d, 'Yes');
  await settle();
  setValue(window, nameInputs(d)[0], 'Sam Okoro');
  setValue(window, d.querySelector('[data-field="background"]'), 'Checkout was rebuilt in June and abandonment rose.');
  const button = Array.from(d.querySelectorAll('.eval-btn')).find((b) => !b.hidden && !b.disabled && /evaluate/i.test(b.textContent));
  if (button) { button.click(); await settle(); }
  assert.equal(JSON.stringify(app.evaluationRequests).includes('Sam Okoro'), false, 'no evaluation request names them');
  assert.equal(d.querySelectorAll('.sign-off [data-field="signOffResearcher"], .sign-off [data-field="signOffProjectOwner"]').length, 2, 'the sign-off is still the two roles');

  const projected = contract.project({ version: 10, savedAt: '2026-09-17T09:00:00.000Z', createdAt: '2026-09-17', fields: {}, selects: { otherResearchers: { v: 'Yes', o: '' } },
    lists: { researchQuestions: ['Why?'], outcomes: ['A reason.'], researcherNames: ['Sam Okoro'] }, methods: [], tables: {}, custom: {}, lastUpdatedManual: false, ui: { timelineVisible: false } });
  assert.equal(JSON.stringify(projected).includes('Sam Okoro'), false, 'the projection does not carry the names');
  assert.deepEqual(Object.keys(projected.lists).sort(), ['outcomes', 'researchQuestions']);
  assert.deepEqual(app.jsdomErrors, []);
});
