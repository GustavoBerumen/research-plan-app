'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp: bootPlain, setValue, listInputs, waitFor, withFieldUncommented } = require('./app-harness');
const fs = require('node:fs');
const path = require('node:path');
// These tests evaluate Hypothesis among the Research fields; it is dormant
// since RPA-117, so every boot here brings it back.
const WITH_HYPOTHESIS = withFieldUncommented(fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'), 'hypothesis');
const bootApp = (opts = {}) => bootPlain({ ...opts, textAssets: Object.assign({ 'research-plan-template.md': WITH_HYPOTHESIS }, opts.textAssets || {}) });

const result = (name = 'Clarity', score = 3) => ({
  metrics: [{ name, score, desc: 'Detailed explanation for ' + name }],
  recommendations: [],
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const section = (app, key) => app.document.querySelector(`[data-evaluate-section="${key}"]`);
const controls = (app, key) => app.document.querySelector(`[data-field="${key}"], [data-list-key="${key}"]`).closest('.field').querySelector('.eval-controls');
const fill = (app, key, text) => setValue(app.window, app.document.querySelector(`[data-field="${key}"]`) || listInputs(app.document, key)[0], text);
const status = (app, key) => app.document.getElementById('evaluation-progress-' + key).textContent;
async function finish(app, key) { await waitFor(() => !section(app, key).disabled); }

test('Research retains its explicit section action, skips empty fields and prevents duplicate batches', async t => {
  const job = deferred();
  const app = await bootApp({ evaluate: () => job.promise }); t.after(() => app.close());
  assert.deepEqual([...app.document.querySelectorAll('.section-eval-btn')].map(b => b.textContent), ['Evaluate research']);
  section(app,'research').click();
  assert.match(status(app,'research'), /Add content to at least one field/);
  assert.equal(app.evaluationRequests.length,0);
  fill(app,'objective','Research objective');
  section(app,'research').click(); section(app,'research').click();
  await waitFor(() => app.evaluationRequests.length === 1);
  assert.equal(section(app,'research').disabled,true);
  assert.equal(controls(app,'hypothesis').querySelector('.eval-btn').hidden,true);
  job.resolve(result()); await finish(app,'research');
  assert.equal(status(app,'research'),'1 of 1 fields finished.');
  assert.equal(controls(app,'objective').querySelector('.eval-panel').hidden,true);
});

test('structured lists retain gaps, numbering, positional pairing and Objective context', async t => {
  const app = await bootApp({ evaluate: () => result() }); t.after(() => app.close());
  const q = app.document.querySelector('[data-list-key="researchQuestions"]');
  q.closest('.field').querySelector('.add-btn').click();
  q.closest('.field').querySelector('.add-btn').click();
  fill(app, 'objective', 'Compare checkout paths');
  setValue(app.window, listInputs(app.document, 'researchQuestions')[1], 'Question two');
  setValue(app.window, listInputs(app.document, 'researchQuestions')[2], 'Question three');
  setValue(app.window, listInputs(app.document, 'outcomes')[2], 'Outcome three');
  section(app, 'research').click(); await finish(app, 'research');
  assert.deepEqual(app.evaluationRequests.map(r => r.body.fieldKey), ['objective', 'researchQuestions', 'outcomes']);
  const request = app.evaluationRequests[2].body;
  assert.deepEqual(request.entries, [{ number: 3, text: 'Outcome three' }]);
  assert.deepEqual(request.researchQuestions, [{ number: 2, text: 'Question two' }, { number: 3, text: 'Question three' }]);
  assert.deepEqual(request.context, { objective: 'Compare checkout paths' });
  fill(app, 'objective', 'Revised objective');
  for (const key of ['researchQuestions', 'outcomes']) assert.equal(controls(app, key).querySelector('.eval-stale-status').hidden, false);
  assert.equal(app.evaluationRequests.length, 3, 'edits never evaluate automatically');
});

test('paired Question edits during an Outcome request make the arriving feedback stale', async t => {
  const pending = deferred();
  const app = await bootApp({ evaluate: body => body.fieldKey === 'outcomes' ? pending.promise : result() }); t.after(() => app.close());
  fill(app, 'researchQuestions', 'Original question'); fill(app, 'outcomes', 'Original outcome');
  section(app, 'research').click(); await waitFor(() => app.evaluationRequests.length === 2);
  fill(app, 'researchQuestions', 'Changed pairing context'); pending.resolve(result()); await finish(app, 'research');
  assert.equal(controls(app, 'outcomes').querySelector('.eval-stale-status').hidden, false);
});

test('viewing feedback during a structured update does not falsely stale the replacement', async t => {
  const pending = deferred(); let updating = false;
  const app = await bootApp({ evaluate: () => updating ? pending.promise : result() }); t.after(() => app.close());
  fill(app, 'researchQuestions', 'Question'); fill(app, 'outcomes', 'Outcome');
  section(app, 'research').click(); await finish(app, 'research');
  fill(app, 'researchQuestions', 'Revised Question');
  const c = controls(app, 'outcomes'); updating = true;
  c.querySelector('.eval-quick-reevaluate-btn').click();
  await waitFor(() => app.evaluationRequests.length === 3);
  c.querySelector('.eval-result-btn').click();
  controls(app, 'researchQuestions').querySelector('.eval-result-btn').click();
  pending.resolve(result('Updated context'));
  await waitFor(() => !c.querySelector('.eval-quick-reevaluate-btn').disabled);
  assert.equal(c.querySelector('.eval-stale-status').hidden, true);
  assert.equal(c.querySelector('.eval-save-btn').disabled, false);
});
