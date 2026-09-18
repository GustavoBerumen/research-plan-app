'use strict';

// RPA-146. Lead researcher and Project requester were each one box for a
// full name, and people filled it inconsistently: a first name only,
// initials, "surname, first name". Each now asks First name and Surname,
// two labelled boxes under the one question.
//
// How, and why this way. The ticket proposed four new fields, in the
// submission record, with a new draft version. A new draft version is a
// one-way door (RPA-143), and the record is Max's. Neither was needed: the
// field keeps its key and keeps holding the whole name as one string,
// "First name Surname", which is what the sign-off, the check page, print,
// the backup and the submission record already read; the two parts are
// saved beside it as <key>FirstName and <key>Surname, in a place older
// builds already carry forward untouched. A plan saved while it was one box
// is read, not migrated: its first word is the first name, the rest the
// surname. The template marks the field "name"; its type stays "text".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');
const contract = require('../submission-contract');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const planOf = (d) => d.querySelector('.doc-header');
const field = (d, key) => d.querySelector('[data-field="' + key + '"]');
const groupOf = (d, key) => field(d, key).closest('.mf');
const links = (d) => Array.from(planOf(d).querySelectorAll('.error-summary-link')).map(text);
const press = (d) => planOf(d).querySelector('.step-continue').click();
const ROLES = [['leadResearcher', 'Who is leading this research?', 'the person leading this research'], ['projectRequester', 'Who requested this research?', 'the person who requested this research']];

test('each role is one question with two labelled boxes, and the hint and the help belong to the question', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  for (const [key, question] of ROLES) {
    const group = groupOf(d, key);
    assert.equal(group.tagName, 'FIELDSET', key + ': grouped as one question');
    assert.equal(text(group.querySelector('legend')), question, 'whose legend asks it');
    const boxes = Array.from(group.querySelectorAll('.name-part-input'));
    assert.deepEqual(boxes.map((i) => i.dataset.field), [key + 'FirstName', key + 'Surname']);
    assert.deepEqual(boxes.map((i) => text(d.querySelector('label[for="' + i.id + '"]'))), ['First name', 'Surname'], 'each with a visible label of its own');
    assert.ok(boxes.every((i) => i.getAttribute('placeholder') === null || i.getAttribute('placeholder') === ''), 'and no placeholder standing in for one');
    assert.ok(boxes.every((i) => i.classList.contains('input-w-20')));
    assert.equal(group.querySelectorAll('.field-hint-text').length, 1, 'one hint, for the question');
    assert.equal(group.querySelectorAll('.field-help').length, 1, 'one help note, for the question');
    assert.ok((group.getAttribute('aria-describedby') || '').split(/\s+/).includes(group.querySelector('.field-hint-text').id), 'the group is described by its hint');
    assert.equal(field(d, key).type, 'hidden', 'the whole name rides along unseen');
  }
  assert.match(CSS, /\.name-parts\{display:flex;flex-wrap:wrap/, 'side by side where there is room');
  assert.match(CSS, /@media screen and \(max-width:600px\)\{\.name-part\{flex:1 1 100%\}\}/, 'one above the other where there is not');
  assert.match(TEMPLATE, /^Lead researcher \(text, name, width=20, /m, 'marked "name" in the template; its type stays text');
  assert.deepEqual(app.jsdomErrors, []);
});

test('both parts are required, each with its own words and its own link, and one page holds them both', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#plan-details/3';
  await settle();
  const shown = Array.from(planOf(d).querySelectorAll('.title-field, .mf')).filter((u) => !u.hidden && !u.classList.contains('page-hidden') && !u.querySelector('[data-field="lastUpdated"]'));
  assert.deepEqual(shown, [groupOf(d, 'leadResearcher')], 'the two boxes are one page');
  press(d);
  assert.deepEqual(links(d), ['Enter the first name of the person leading this research', 'Enter the surname of the person leading this research']);
  const group = groupOf(d, 'leadResearcher');
  assert.deepEqual(Array.from(group.querySelectorAll(':scope > .field-error')).map((e) => text(e).replace(/^Error:\s*/, '')), links(d), 'the same two at the question');
  planOf(d).querySelectorAll('.error-summary-link')[1].click();
  assert.equal(d.activeElement, field(d, 'leadResearcherSurname'), 'the surname\'s link goes to the surname\'s box');
  assert.ok((field(d, 'leadResearcherSurname').getAttribute('aria-describedby') || '').split(/\s+/).some((id) => /surname/.test(text(d.getElementById(id)))), 'which is described by its own error');

  setValue(window, field(d, 'leadResearcherFirstName'), 'Priya');
  assert.deepEqual(links(d), ['Enter the surname of the person leading this research'], 'a first name alone is not a name; the answered part stops asking');
  assert.equal(group.querySelectorAll(':scope > .field-error').length, 1);
  press(d);
  assert.equal(window.location.hash, '#plan-details/3', 'and it holds the page');
  setValue(window, field(d, 'leadResearcherSurname'), 'Nair');
  assert.equal(planOf(d).querySelector('.error-summary').hidden, true);
  assert.equal(group.classList.contains('field-invalid'), false);
  press(d);
  await settle();
  assert.equal(window.location.hash, '#plan-details/4', 'both given, on it goes');
  assert.match(TEMPLATE, /^  Error: Enter the first name of the person who requested this research\n  Error: Enter the surname of the person who requested this research$/m, 'two Error lines in the template, first name then surname');
  assert.deepEqual(app.jsdomErrors, []);
});

test('everywhere else a name is one string: first name, a space, surname', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  completeStep(app, planOf(d));
  setValue(window, field(d, 'leadResearcherFirstName'), '  Mary Ann ');
  setValue(window, field(d, 'leadResearcherSurname'), 'de la Cruz');
  setValue(window, field(d, 'projectRequesterFirstName'), 'Tom');
  setValue(window, field(d, 'projectRequesterSurname'), 'Reyes');
  assert.equal(field(d, 'leadResearcher').value, 'Mary Ann de la Cruz', 'the field\'s own key holds the whole name, trimmed');
  window.location.hash = '#plan-details/99';
  await settle();
  for (let i = 0; i < 4 && !planOf(d).classList.contains('step-checking'); i++) { press(d); await settle(120); }
  const rows = Object.fromEntries(Array.from(planOf(d).querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]));
  assert.equal(rows['Lead researcher'], 'Mary Ann de la Cruz', 'the check page, in one row');
  assert.equal(rows['Project requester'], 'Tom Reyes');
  assert.equal(text(groupOf(d, 'leadResearcher').querySelector('.name-print')), 'Mary Ann de la Cruz', 'the printed plan');
  assert.match(CSS, /@media print\{\.name-parts\{display:none\}\.name-print\{display:block\}\}/, 'where the two boxes give way to the name');

  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.leadResearcherSurname === 'de la Cruz' && s; });
  assert.equal(saved.fields.leadResearcher, 'Mary Ann de la Cruz', 'saved whole under the key it always had');
  assert.equal(saved.fields.leadResearcherSurname, 'de la Cruz', 'and in its parts beside it');
  assert.equal(saved.fields.leadResearcherFirstName.trim(), 'Mary Ann', 'a first name of two words stays a first name');
  assert.equal(saved.version, Number(/const DRAFT_VERSION = (\d+);/.exec(APP)[1]), 'no new draft version: the parts ride in a place older builds already carry forward');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the submission record is what it was: the whole name under the old key, and no parts', async () => {
  const fixtures = require('./rpa-64-fixtures.cjs');
  const draft = fixtures.plan();
  Object.assign(draft.fields, { leadResearcher: 'Mary Ann de la Cruz', leadResearcherFirstName: 'Mary Ann', leadResearcherSurname: 'de la Cruz' });
  const record = contract.project(draft);
  assert.equal(record.fields.leadResearcher, 'Mary Ann de la Cruz');
  assert.equal(Object.keys(record.fields).some((k) => /FirstName|Surname/.test(k)), false, 'the contract\'s FIELDS is untouched, so the record carries no parts');
  assert.deepEqual(contract.FIELDS.filter((k) => /FirstName|Surname/.test(k)), []);
  const config = { pilotMode: true, capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: fixtures.config };
  const app = await bootApp({ configResponse: async () => ({ ok: true, status: 200, json: async () => config }) });
  try {
    assert.ok(app.document.querySelector('.submission-send'), 'and the form is still one the contract recognises: the field\'s type is still text');
    assert.doesNotMatch(text(app.document.querySelector('.submission-status')), /form has changed/i);
  } finally { app.close(); }
});

test('a plan saved while the name was one box keeps its name, read into the two', async (t) => {
  const older = (name, requester) => ({ version: 10, fields: { researchTitle: 'An older plan', leadResearcher: name, projectRequester: requester }, selects: {}, lists: {}, studies: [], tables: {}, custom: {} });
  const app = await bootApp({ draft: older('Priya Nair', 'Tom van der Berg') });
  t.after(() => app.close());
  const d = app.document;
  assert.deepEqual([field(d, 'leadResearcherFirstName').value, field(d, 'leadResearcherSurname').value], ['Priya', 'Nair']);
  assert.deepEqual([field(d, 'projectRequesterFirstName').value, field(d, 'projectRequesterSurname').value], ['Tom', 'van der Berg'], 'the first word is the first name, the rest the surname');
  assert.equal(field(d, 'leadResearcher').value, 'Priya Nair', 'and nothing of it is lost');

  // One word: it is kept, as a first name, and the surname is asked for. The plan reopens incomplete, which is what "both required" means for it.
  const mononym = await bootApp({ draft: older('Priya', 'TR') });
  t.after(() => mononym.close());
  const dm = mononym.document;
  assert.deepEqual([field(dm, 'leadResearcherFirstName').value, field(dm, 'leadResearcherSurname').value], ['Priya', '']);
  assert.equal(field(dm, 'leadResearcher').value, 'Priya');
  mononym.window.location.hash = '#plan-details/3';
  await settle();
  press(dm);
  assert.deepEqual(links(dm), ['Enter the surname of the person leading this research']);

  // A plan saved with the parts has them back as they were, not split again from the whole.
  const parted = await bootApp({ draft: { version: 10, fields: { leadResearcher: 'Mary Ann de la Cruz', leadResearcherFirstName: 'Mary Ann', leadResearcherSurname: 'de la Cruz' }, selects: {}, lists: {}, studies: [], tables: {}, custom: {} } });
  t.after(() => parted.close());
  assert.deepEqual([field(parted.document, 'leadResearcherFirstName').value, field(parted.document, 'leadResearcherSurname').value], ['Mary Ann', 'de la Cruz']);
  assert.deepEqual(app.jsdomErrors.concat(mononym.jsdomErrors, parted.jsdomErrors), []);
});

test('Clear Form clears the whole name with its parts, and the sign-off still has its two distinct people', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, field(d, 'leadResearcherFirstName'), 'Priya');
  setValue(window, field(d, 'leadResearcherSurname'), 'Nair');
  d.getElementById('clear-btn').click();
  await settle();
  assert.deepEqual(['leadResearcher', 'leadResearcherFirstName', 'leadResearcherSurname'].map((k) => field(d, k).value), ['', '', ''], 'a hidden input is not a text box, and would have outlived the form it belonged to');
  assert.equal(text(groupOf(d, 'leadResearcher').querySelector('.name-print')), '');
  assert.deepEqual(Array.from(d.querySelectorAll('.sign-off-setup input[type="radio"]')).map((r) => r.value), ['leadResearcher', 'projectRequester'], 'the workflow\'s two roles are keyed as they were (plan-workflow.js)');
  assert.deepEqual(app.jsdomErrors, []);
});
