'use strict';

// RPA-117. Theory and Action Points are hidden at this stage of the plan:
// Theory added friction, and actions are tracked in Jira. They are dormant,
// not deleted — commented out in the template the way Requirements is —
// so an older draft's saved Theory text and Action Points rows are carried
// forward untouched by every autosave, and two uncommented lines bring
// them back, framework suggestion and all.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, withFieldUncommented } = require('./app-harness');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
function storedDraft(window) {
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) { try { const j = JSON.parse(ls.getItem(ls.key(i))); if (j && j.fields) return j; } catch (e) { /* not ours */ } }
  return null;
}

test('none of the three renders, and the sections count without them', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  assert.equal(d.querySelector('[data-field="theory"]'), null, 'no Theory');
  assert.equal(d.getElementById('actionPoints-table'), null, 'no Action Points');
  assert.equal(d.querySelector('[data-field="hypothesis"]'), null, 'no Hypothesis (Gus, later on 14 September)');
  assert.equal(Array.from(d.querySelectorAll('button')).find((b) => /suggest a framework/i.test(text(b))), undefined, 'no framework suggestion without Theory');
  const counts = Object.fromEntries(Array.from(d.querySelectorAll('.acc')).map((a) => [text(a.querySelector('.acc-title')), text(a.querySelector('.acc-count'))]));
  assert.equal(counts.Research, '3 fields');
  assert.equal(counts.Methodology, '4 fields');
  assert.equal(counts.Execution, '2 fields');
  assert.deepEqual(app.jsdomErrors, []);
});

test('an older draft keeps its Theory text and Action Points rows through an autosave', async (t) => {
  const draft = { version: 7, fields: { theory: 'Activity Theory\nEngeström (1987).', hypothesis: 'If we simplify the basket, fewer people will leave.' }, lists: {}, tables: { 'actionPoints-table': [[{ t: 'text', v: 'Recruit five people' }, { t: 'text', v: 'Gus' }]] } };
  const app = await bootApp({ draft });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit that triggers a save.');
  await waitFor(() => storedDraft(window)?.fields?.background === 'An edit that triggers a save.');
  const saved = storedDraft(window);
  assert.equal(saved.fields.theory, 'Activity Theory\nEngeström (1987).', 'carried, not dropped');
  assert.equal(saved.fields.hypothesis, 'If we simplify the basket, fewer people will leave.', 'Hypothesis carried too');
  assert.deepEqual(saved.tables['actionPoints-table'], draft.tables['actionPoints-table']);
});

test('uncommented lines bring them back: hint, note, word count, framework suggestion and all', async (t) => {
  const restored = withFieldUncommented(withFieldUncommented(withFieldUncommented(TEMPLATE, 'theory'), 'actionPoints'), 'hypothesis');
  const app = await bootApp({ textAssets: { 'research-plan-template.md': restored } });
  t.after(() => app.close());
  const d = app.document;
  assert.ok(d.querySelector('[data-field="theory"]'), 'Theory is back');
  assert.ok(d.getElementById('actionPoints-table'), 'Action Points is back');
  assert.ok(Array.from(d.querySelectorAll('button')).find((b) => /suggest a framework/i.test(text(b))), 'and so is the suggestion');
  const hyp = d.querySelector('[data-field="hypothesis"]');
  assert.ok(hyp, 'Hypothesis is back');
  const field = hyp.closest('.field');
  assert.match(text(field.querySelector('.field-hint-text')), /^An educated assumption/, 'with its hint');
  assert.match(text(field.querySelector('.field-help-body')), /^Specific enough to be wrong/, 'and its help note, so the fixture restores Guidance lines too');
  assert.equal(text(d.getElementById('field-hypothesis-words')), 'You have 30 words remaining', 'and its word count');
});
