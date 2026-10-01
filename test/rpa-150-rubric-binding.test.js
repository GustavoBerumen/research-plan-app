'use strict';

// RPA-150, first slice: the guard. Evaluate scores a field against the
// criteria under that field's heading in research-plan-rubric.md. The two are
// joined by name: a heading "# Problem Statement" becomes the key
// problemStatement, and the field with that key gets those criteria. (By
// key, not by label, so rewording a field's label is safe: the template
// pins every key.) Nothing checked the join. Rename a heading, or change a
// field's key, and the field's evaluation would go on with no criteria at
// all, scoring against nothing and saying so to nobody. That is the
// name-to-code coupling that cost a day in RPA-55, on the AI side.
//
// Held here, end to end through the real form, so no copy of the naming
// rule lives in this file: every field the template marks "eval" sends a
// request whose criteria are exactly the ones written under its heading, in
// their order. The audit of the criteria against the RPA-119 guidance is on
// the ticket; rewording any of them is content work and is not done here.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');
const { evaluationFixture } = require('./rpa-63-fixtures.cjs');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const RUBRIC = fs.readFileSync(path.join(ROOT, 'research-plan-rubric.md'), 'utf8');

// The fields the form evaluates today: a field line, not commented out, carrying the "eval" flag.
function evaluatedFields(template) {
  return template.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
    .map((line) => /^(?:# )?([^(\n]+?)\s*\(([^)]*)\)/.exec(line)).filter(Boolean)
    .filter((m) => m[2].split(',').map((p) => p.trim().toLowerCase()).includes('eval'))
    .map((m) => ({ label: m[1].trim(), key: (/key=([A-Za-z][A-Za-z0-9]*)/.exec(m[2]) || [])[1] }));
}
// The rubric as written: heading, then its criteria's names in order.
function rubricSections(rubric) {
  const sections = new Map();
  let current = null;
  rubric.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).forEach((line) => {
    const heading = /^#\s+(.+?)\s*$/.exec(line);
    if (heading) { current = heading[1]; sections.set(current, []); return; }
    const criterion = /^-\s*([^:]+):\s*\S/.exec(line);
    if (criterion && current) sections.get(current).push(criterion[1].trim());
  });
  return sections;
}
async function requestsOf(app) {
  const { document: d, window } = app;
  // Something to evaluate in every evaluated field.
  for (const key of ['background', 'goal', 'problemStatement', 'objective']) { const el = d.querySelector('[data-field="' + key + '"]'); if (el) setValue(window, el, 'A sentence to evaluate for ' + key + '.'); }
  for (const key of ['researchQuestions', 'outcomes']) { const el = d.querySelector('.list-rows[data-list-key="' + key + '"] .list-input'); if (el) setValue(window, el, 'An entry to evaluate for ' + key + '.'); }
  d.querySelectorAll('.section-eval-btn').forEach((button) => button.click());
  await waitFor(() => app.evaluationRequests.length >= 6);
  await new Promise((r) => setTimeout(r, 300));
  return new Map(app.evaluationRequests.map((r) => [r.body.fieldKey, r.body]));
}

test('every evaluated field is scored against one section of the rubric, whole and in order, and no section is left unused', async (t) => {
  const fields = evaluatedFields(TEMPLATE);
  assert.deepEqual(fields.map((f) => f.key), ['background', 'goal', 'problemStatement', 'objective', 'researchQuestions', 'outcomes'],
    'the six fields with an Evaluate control today (Hypothesis is dormant, RPA-117)');
  const sections = rubricSections(RUBRIC);
  const app = await bootApp({ evaluate: (body) => evaluationFixture(body, 'ready') });
  t.after(() => app.close());
  const sent = await requestsOf(app);
  const used = new Set();
  for (const field of fields) {
    const body = sent.get(field.key);
    assert.ok(body, field.label + ' is evaluated');
    const names = body.rubric.map((c) => c.name);
    const unused = () => Array.from(sections.keys()).filter((h) => !used.has(h)).join(', ');
    assert.ok(names.length, field.label + ' (key=' + field.key + ') is scored against nothing: no heading in research-plan-rubric.md turns into its key. '
      + 'A heading was renamed, or the field\'s key changed. Headings not yet matched: ' + unused());
    const match = Array.from(sections).find(([, written]) => JSON.stringify(written) === JSON.stringify(names));
    assert.ok(match, field.label + ': its criteria (' + names.join(', ') + ') are not those of any one section, whole and in order');
    used.add(match[0]);
    assert.ok(body.rubric.every((c) => c.desc && c.desc.length > 20), field.label + ': and each criterion says what good looks like');
  }
  const idle = Array.from(sections.keys()).filter((h) => !used.has(h));
  assert.deepEqual(idle, ['Hypothesis'], 'a section no field uses is criteria nobody is scored against: only the dormant Hypothesis may be one (RPA-117)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the guard notices: a rubric heading that drifts from its field leaves that field with no criteria', async (t) => {
  const drifted = RUBRIC.replace(/^# Problem Statement$/m, '# The Problem');
  assert.notEqual(drifted, RUBRIC, 'the fixture must find the heading');
  const app = await bootApp({ textAssets: { 'research-plan-rubric.md': drifted }, evaluate: (body) => evaluationFixture(body, 'ready') });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="problemStatement"]'), 'People leave at payment and we do not know why.');
  const field = d.querySelector('[data-field="problemStatement"]').closest('.field');
  const sections = rubricSections(drifted);
  assert.equal(sections.has('Problem Statement'), false);
  // What the form does with such a field today: it has nothing to score against.
  const button = field.querySelector('.eval-btn');
  if (button && !button.hidden && !button.disabled) {
    button.click();
    await new Promise((r) => setTimeout(r, 400));
    const body = (app.evaluationRequests.find((r) => r.body.fieldKey === 'problemStatement') || {}).body;
    assert.ok(!body || body.rubric.length === 0, 'no criteria reach the request');
  }
  assert.ok(sections.has('The Problem'), 'and its criteria sit under a heading no field answers to, which is the other thing the first test refuses');
});

test('criterion names are unique within a field, and the two fields that share a name are known', () => {
  // Calibration records store criterion names (calibration-data.jsonl), and
  // the weak and strong examples in server.js are keyed by bare name. Two
  // criteria called "Actionable", under Objective and under Outcomes, is a
  // collision waiting for the day examples reach the list prompts.
  const sections = rubricSections(RUBRIC);
  for (const [heading, names] of sections) assert.equal(new Set(names).size, names.length, heading + ': no name twice');
  const owners = new Map();
  for (const [heading, names] of sections) names.forEach((n) => owners.set(n, (owners.get(n) || []).concat(heading)));
  const shared = Array.from(owners).filter(([, hs]) => hs.length > 1).map(([n, hs]) => n + ': ' + hs.join(' and '));
  assert.deepEqual(shared, ['Actionable: Objective and Outcomes'], 'one shared name, recorded on RPA-150; a second would need the same decision');
});
