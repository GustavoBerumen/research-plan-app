'use strict';

// RPA-119: the words of the form. Gus wrote, field by field, the question
// each page asks, the hint under it and the help note behind its link (the
// "Field-information" table, 17 September 2026). They are in the template,
// not in code. Three things the template could not say before, it now can:
//
//   question=   on any kind of field, not only radios (RPA-118). The heading
//               asks the question; the label stays the field's name, which
//               is what an error message, the check page and Review call it.
//   Help:       the title of the field's help note, the words on its closed
//               link. Without one, "Help with this section" stands (RPA-107).
//   Guidance: - an item of a list; **bold** beside *italics*.
//
// And one decision of his: who takes part is one question, "Who should take
// part in this study?", not two lists. The answers of a plan saved with two
// are read as one (plan-model.js); that is tested in RPA-55, RPA-46, RPA-116.
// Fields his table does not cover yet keep the words they had.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, withFieldFlag } = require('./app-harness');
const contract = require('../submission-contract');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = () => new Promise((r) => setTimeout(r, 260));
// A study's fields are numbered by group ("field-methods-g1-label"): the first group's stands for them.
const labelOf = (d, key) => d.getElementById('field-' + key + '-label') || d.querySelector('[id^="field-' + key + '-g"][id$="-label"]');
const wrapOf = (d, key) => labelOf(d, key).closest('.field, .mf') || labelOf(d, key).parentElement;
const helpOf = (d, key) => {
  const wrap = labelOf(d, key).closest('.field, .mf');
  if (wrap) return Array.from(wrap.children).find((k) => k.classList.contains('field-help')) || null;
  return d.getElementById('field-' + key).nextElementSibling;   // the title has no wrapper (RPA-107)
};
// The heading without the hidden " for Study 1" a study's field may carry.
const asked = (label) => text(label.firstChild);

// Gus's table, as the form must say it: field, its name, its question, the title of its note.
const WORDS = [
  ['researchTitle', 'Research title', 'What is the name of your research plan?', 'I am not sure what to name my research'],
  ['jiraProject', 'Project name', 'Which project or initiative does this research support?', 'Why we ask for the project name'],
  ['leadResearcher', 'Lead researcher', 'Who is leading this research?', 'Why we ask for the lead researcher'],
  ['projectRequester', 'Project requester', 'Who requested this research?', 'Why we ask for the project requester'],   // titled at review, in the voice of its siblings
  ['projectDecision', 'Project decision', 'When will the findings be used to make a decision?', 'Why we ask for a decision date'],
  ['researchReadout', 'Research readout', 'When will the findings be shared with the team?', 'Why this date needs to be before the decision date'],
  ['background', 'Background', 'What do people need to know about this project?', 'Why we ask for the background'],
  ['goal', 'Goal', 'What is the goal of this project?', 'How to define the project goal'],
  ['problemStatement', 'Problem Statement', 'What problem are you trying to solve?', 'How to write a strong problem statement'],
  ['objective', 'Objective', 'What do you want to learn from this research?', 'How to define your research objective'],
  ['researchQuestions', 'Research Questions', 'What questions do you need this research to answer?', 'How to write strong research questions'],
  ['outcomes', 'Outcomes', 'What deliverables will answer your research questions?', 'How to define research outcomes'],
  ['studyCount', 'Number of studies', 'How many studies will you run?', 'How to plan your studies'],
  ['methods', 'Methods', 'Which research methods will you use for this study?', 'What is a research method?'],
  ['characteristics', 'Participant criteria', 'Who should take part in this study?', 'How to define your participants'],
];

test('every field in the table asks its question, keeps its name, and titles its help note', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  for (const [key, name, question, title] of WORDS) {
    const label = labelOf(d, key);
    assert.ok(label, key + ' is labelled');
    assert.equal(asked(label), question, key + ': the heading asks the question');
    const wrap = wrapOf(d, key);
    assert.equal(wrap.dataset.fieldName || (label.closest('[data-field-name]') || {}).dataset?.fieldName, name, key + ': and the field keeps its name');
    const help = helpOf(d, key);
    assert.ok(help && help.classList.contains('field-help'), key + ' has a note');
    assert.equal(text(help.querySelector('summary')), title, key + ': the note says what is in it');
    assert.doesNotMatch(text(help), /No further help/, key + ': and it is written');
    assert.equal(help.open, false);
  }
  assert.deepEqual(app.jsdomErrors, []);
});

test('nothing of the markup shows: no asterisks, no list dashes, no disclosure glyph, no "Guidance:"', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const notes = Array.from(d.querySelectorAll('.field-help'));
  assert.ok(notes.length > 20);
  for (const note of notes) {
    const words = text(note);
    assert.doesNotMatch(words, /\*/, 'an asterisk shows in: ' + words.slice(0, 60));
    assert.doesNotMatch(words, /[▶►▸]/, 'the link draws its own marker');
    assert.doesNotMatch(words, /\b(Guidance|Help|Hint):/, 'a template keyword shows in: ' + words.slice(0, 60));
    Array.from(note.querySelectorAll('p, li')).forEach((n) => assert.doesNotMatch(text(n), /^[-•]\s/, 'a list dash shows: ' + text(n).slice(0, 60)));
    assert.equal(note.querySelector('ul:empty, li:empty, p:empty, strong:empty'), null);
  }
  Array.from(d.querySelectorAll('.field-hint-text')).forEach((h) => assert.doesNotMatch(text(h), /\*\*|^- /, text(h).slice(0, 60)));
  // The fields, not the file's own header comment, which lines its examples up in columns.
  assert.doesNotMatch(TEMPLATE.slice(TEMPLATE.indexOf('\n-->')), /^ +(Guidance|Hint|Help):.*\S {2,}\S/m, 'no doubled spaces inside a hint or a note');
  assert.match(CSS, /\.field-help-list\{/, 'the list is styled');
  assert.match(CSS.slice(CSS.indexOf('@media print{')), /\.field-help,/, 'and still none of it prints (RPA-107)');
});

test('a run of "- " lines is one list where it was written; a paragraph between two runs makes two lists', async (t) => {
  const tpl = TEMPLATE.replace(/^([^\r\n]*\bkey=previousKnowledge\b[^\r\n]*)(\r?\n)/m,
    '$1$2  Help: What counts as previous knowledge$2  Guidance: Before.$2  Guidance: - **One:** first$2  Guidance: - second, with *stress*$2  Guidance: Between.$2  Guidance: - third$2');
  assert.notEqual(tpl, TEMPLATE, 'the fixture must find a field with no note of its own');
  const app = await bootApp({ textAssets: { 'research-plan-template.md': tpl } });
  t.after(() => app.close());
  const help = helpOf(app.document, 'previousKnowledge');
  assert.equal(text(help.querySelector('summary')), 'What counts as previous knowledge');
  const body = help.querySelector('.field-help-body');
  assert.deepEqual(Array.from(body.children).map((k) => k.tagName + ':' + text(k)),
    ['P:Before.', 'UL:One: firstsecond, with stress', 'P:Between.', 'UL:third'], 'in the order written');
  const first = body.querySelector('ul');
  assert.deepEqual(Array.from(first.children).map((li) => li.tagName), ['LI', 'LI']);
  assert.equal(text(first.querySelector('li strong')), 'One:');
  assert.equal(text(first.querySelectorAll('li')[1].querySelector('em')), 'stress', 'italics still work beside bold');
  assert.deepEqual(app.jsdomErrors, []);
});

test('an unanswered field is asked for in its own words (RPA-120), never by pasting its question in, and the check page lists it by name', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  window.location.hash = '#context';
  await settle();
  const step = d.querySelector('.step[data-step-slug="context"]');
  const press = () => step.querySelector('.step-continue').click();
  press();
  assert.deepEqual(Array.from(step.querySelectorAll('.error-summary-link')).map(text), ['Enter what people need to know about this project'], 'not "Enter the what do people need to know..."');
  setValue(window, d.querySelector('[data-field="background"]'), 'Checkout was rebuilt in June and abandonment rose.');
  press(); await settle();
  setValue(window, d.querySelector('[data-field="goal"]'), 'Reduce abandonment at payment.');
  press(); await settle();
  setValue(window, d.querySelector('[data-field="problemStatement"]'), 'People leave at the payment page and we do not know why.');
  press(); await settle();
  if (!step.classList.contains('step-checking')) { press(); await settle(); }   // the section's optional last page
  await waitFor(() => step.classList.contains('step-checking'));
  const keys = Array.from(step.querySelectorAll('.summary-key')).map(text);
  assert.deepEqual(keys.slice(0, 3), ['Background', 'Goal', 'Problem Statement'], 'the check page names the fields');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the project field asks for a project name now, in a box sized for one', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const input = d.querySelector('[data-field="jiraProject"]');
  assert.match(TEMPLATE, /^Project name \(text, width=20, question=Which project or initiative does this research support\?, key=jiraProject\):/m,
    'the key is unchanged, so every saved plan still has its answer');
  assert.ok(input.classList.contains('input-w-20'), Array.from(input.classList).join(' '));
  const hint = text(wrapOf(d, 'jiraProject').querySelector('.field-hint-text, .mf-hint'));
  assert.doesNotMatch(hint, /\bkey\b|RPA-\d+/i, 'it no longer asks for a Jira key: ' + hint);
});

test('a project name is typed into a plain box: no ticket search, no ticket tag, nothing said about ticket keys', async (t) => {
  // Found at review of PR #111. The ticket picker was wired to the field's
  // key, so the new question kept it: a project name turned into a blue tag,
  // and the pilot (Jira off) answered every name with "Jira suggestions are
  // unavailable. You can still enter a ticket key manually."
  for (const jiraEnabled of [false, true]) {
    const searched = [];
    const app = await bootApp({ jiraEnabled, jiraSearch: async (q) => { searched.push(q); return { ok: true, json: async () => ({ issues: [] }) }; } });
    t.after(() => app.close());
    const d = app.document;
    const input = d.querySelector('[data-field="jiraProject"]');
    setValue(app.window, input, 'Checkout redesign');
    await settle();
    await new Promise((r) => setTimeout(r, 400));   // past the picker's search delay
    assert.equal(input.classList.contains('jira-input'), false, 'not a ticket field');
    assert.equal(input.classList.contains('jira-filled'), false, 'so a name is not shown as a tag');
    assert.equal(input.getAttribute('role'), null, 'nor announced as a search');
    assert.equal(d.querySelector('.jira-status'), null, 'and nothing speaks of ticket keys');
    assert.deepEqual(searched, [], 'Jira is not searched for a project name');
    assert.ok(input.classList.contains('input-w-20'), 'it keeps the width its answer needs');
  }
  // The picker is kept, behind a flag, for the field that next asks for a ticket.
  const flagged = await bootApp({ jiraEnabled: true, textAssets: { 'research-plan-template.md': withFieldFlag(TEMPLATE, 'jiraProject', 'jira') } });
  t.after(() => flagged.close());
  const picker = flagged.document.querySelector('[data-field="jiraProject"]');
  assert.ok(picker.classList.contains('jira-input'));
  assert.equal(picker.getAttribute('role'), 'combobox');
});

test('a study\'s headings name the study they ask about, once there is one', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const headings = () => Array.from(d.querySelectorAll('.methods-group .field-per-question .flabel')).map(asked);
  assert.deepEqual(headings(), ['Which research methods will you use for this study?', 'Who should take part in this study?', 'How many participants do you need?'],
    'before any study is declared, "this study" is all there is to say');
  setValue(app.window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Where do people give up?');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="Two"]').click();
  await settle();
  const groups = Array.from(d.querySelectorAll('.methods-group'));
  assert.equal(groups.length, 2);
  groups.forEach((g, i) => {
    const n = 'Study ' + (i + 1);
    assert.deepEqual(Array.from(g.querySelectorAll('.field-per-question .flabel')).map(asked),
      ['Which research methods will you use for ' + n + '?', 'Who should take part in ' + n + '?', 'How many participants do you need?']);
    assert.deepEqual(Array.from(g.querySelectorAll('.field-per-question .flabel')).map(text),
      ['Which research methods will you use for ' + n + '?', 'Who should take part in ' + n + '?', 'How many participants do you need? for ' + n],
      'a heading that cannot name the study keeps the hidden words that do');
  });
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="One"]').click();
  await settle();
  assert.deepEqual(headings().slice(0, 2), ['Which research methods will you use for Study 1?', 'Who should take part in Study 1?'], 'renamed from the template\'s words each time, not from the last name');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a receipt taken while there were two lists still matches its plan', () => {
  // Max's contract fingerprints a plan so a receipt can be matched to it
  // later (RPA-64). Who takes part is read as one list on both sides, so the
  // same answers give the same fingerprint however they were stored.
  const base = () => ({ version: 8, savedAt: '2026-09-10T09:00:00.000Z', createdAt: '2026-09-10', fields: { researchTitle: 'Checkout' }, selects: {},
    lists: { researchQuestions: ['Why?'], outcomes: ['A reason.'] }, tables: {}, custom: {}, lastUpdatedManual: false, ui: { timelineVisible: false } });
  const two = base(); two.methods = [{ question: 'Why?', methods: ['Interviews'], characteristics: ['Abandoned a basket', ''], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } }];
  const one = base(); one.methods = [{ question: 'Why?', methods: ['Interviews'], characteristics: ['Abandoned a basket', 'New customers'], userGroups: [], sampleSize: { v: 'Small (1–5)', o: '' } }];
  assert.equal(contract.fingerprint(two), contract.fingerprint(one));
  const other = base(); other.methods = [{ question: 'Why?', methods: ['Interviews'], characteristics: ['Abandoned a basket'], userGroups: [], sampleSize: { v: 'Small (1–5)', o: '' } }];
  assert.notEqual(contract.fingerprint(other), contract.fingerprint(one), 'and a criterion taken away is still noticed');
});
