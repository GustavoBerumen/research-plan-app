'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, listInputs, waitFor } = require('./app-harness');

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

test('two explicit section actions, empty sections and blank optional fields make no unwanted requests', async t => {
  const app = await bootApp({ evaluate: () => result() }); t.after(() => app.close());
  assert.deepEqual(Array.from(app.document.querySelectorAll('.section-eval-btn'), b => b.textContent), ['Evaluate context', 'Evaluate research']);
  assert.equal(app.document.querySelectorAll('.eval-controls > .eval-btn:not([hidden])').length, 0);
  for (const key of ['context', 'research']) {
    section(app, key).click();
    assert.match(status(app, key), /Add content to at least one field/);
    const precedingField = section(app, key).parentElement.previousElementSibling;
    assert.ok(precedingField.querySelector(key === 'context' ? '[data-field="problemStatement"]' : '[data-list-key="outcomes"]'));
  }
  assert.equal(app.evaluationRequests.length, 0);
  fill(app, 'background', 'Background only'); fill(app, 'objective', 'Objective only');
  fill(app, 'hypothesis', '   ');
  section(app, 'context').focus(); section(app, 'context').click(); await finish(app, 'context');
  assert.deepEqual(app.evaluationRequests.map(r => r.body.fieldKey), ['background']);
  assert.equal(app.document.activeElement, section(app, 'context'));
  section(app, 'research').click(); await finish(app, 'research');
  assert.deepEqual(app.evaluationRequests.map(r => r.body.fieldKey), ['background', 'objective']);
  assert.equal(controls(app, 'hypothesis').querySelector('.eval-result-summary').hidden, true);
  assert.equal(controls(app, 'background').querySelector('.eval-panel').hidden, true);
  assert.equal(controls(app, 'background').querySelector('.eval-dots').getAttribute('aria-label'), 'Scored 3 out of 3');
});

test('shared two-request limit, progress and duplicate prevention across both sections and individual actions', async t => {
  const jobs = [];
  const app = await bootApp({ evaluate: body => { const job = deferred(); jobs.push({ ...job, body }); return job.promise; } });
  t.after(() => app.close());
  ['background', 'goal', 'problemStatement', 'objective', 'hypothesis'].forEach(key => fill(app, key, key));
  section(app, 'context').click(); section(app, 'research').click();
  section(app, 'context').click();
  controls(app, 'background').querySelector('.eval-quick-reevaluate-btn').click();
  await waitFor(() => jobs.length === 2);
  assert.match(status(app, 'context'), /0 of 3/);
  assert.match(controls(app, 'problemStatement').querySelector('.field-eval-progress').textContent, /queued/);
  jobs[0].resolve(result()); await waitFor(() => jobs.length === 3);
  assert.match(status(app, 'context'), /1 of 3/);
  jobs[1].resolve(result()); await waitFor(() => jobs.length === 4);
  jobs[2].resolve(result()); await waitFor(() => jobs.length === 5);
  jobs[3].resolve(result()); jobs[4].resolve(result());
  await finish(app, 'context'); await finish(app, 'research');
  assert.equal(jobs.length, 5);
  assert.equal(new Set(jobs.map(j => j.body.fieldKey)).size, 5);
});

test('partial request failure preserves successful low scores and retries only the failed field', async t => {
  let fail = true;
  const app = await bootApp({ evaluate: body => {
    if (body.fieldKey === 'goal' && fail) throw new Error('Offline fixture');
    return result(body.fieldKey, 1);
  } }); t.after(() => app.close());
  fill(app, 'background', 'Background'); fill(app, 'goal', 'Goal');
  section(app, 'context').click(); await finish(app, 'context');
  const good = controls(app, 'background'), bad = controls(app, 'goal');
  assert.equal(good.querySelector('.eval-badge').textContent, 'Needs Work');
  assert.equal(good.querySelector('.eval-error').hidden, true);
  assert.equal(bad.querySelector('.eval-result-summary').hidden, true);
  assert.match(bad.querySelector('.eval-error').textContent, /request failed: Offline fixture/);
  assert.match(status(app, 'context'), /1 request failed/);
  assert.equal(bad.querySelector('.eval-btn').textContent, 'Retry Goal');
  fail = false; bad.querySelector('.eval-btn').click();
  await waitFor(() => !bad.querySelector('.eval-btn').disabled);
  assert.deepEqual(app.evaluationRequests.map(r => r.body.fieldKey), ['background', 'goal', 'goal']);
  assert.equal(good.querySelector('.eval-mname').textContent, 'background');
  assert.equal(bad.querySelector('.eval-error').hidden, true);
  assert.equal(status(app, 'context'), '2 of 2 fields finished.', 'retry removes the old batch failure');
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

test('retrying a failed field while its section is still running updates the final summary', async t => {
  const slow = deferred(); let failedOnce = false;
  const app = await bootApp({ evaluate: body => {
    if (body.fieldKey === 'goal' && !failedOnce) { failedOnce = true; throw new Error('Retry me'); }
    if (body.fieldKey === 'problemStatement') return slow.promise;
    return result();
  } }); t.after(() => app.close());
  ['background', 'goal', 'problemStatement'].forEach(key => fill(app, key, key));
  section(app, 'context').click();
  const retry = controls(app, 'goal').querySelector('.eval-btn');
  await waitFor(() => !retry.hidden && !retry.disabled && app.evaluationRequests.length === 3);
  assert.equal(section(app, 'context').disabled, true);
  retry.click(); await waitFor(() => !retry.disabled);
  slow.resolve(result()); await finish(app, 'context');
  assert.equal(status(app, 'context'), '3 of 3 fields finished.');
  assert.deepEqual(app.evaluationRequests.map(r => r.body.fieldKey), ['background', 'goal', 'problemStatement', 'goal']);
});

test('replacement preserves detailed feedback; edits during requests produce stale results without focus jumps', async t => {
  const replacement = deferred(); let count = 0;
  const app = await bootApp({ evaluate: () => ++count === 1 ? result('Original') : replacement.promise }); t.after(() => app.close());
  fill(app, 'background', 'Before'); section(app, 'context').click(); await finish(app, 'context');
  const c = controls(app, 'background');
  c.querySelector('.eval-result-btn').click();
  fill(app, 'background', 'At request');
  c.querySelector('.eval-reevaluate-btn').click();
  await waitFor(() => count === 2);
  section(app, 'context').click(); // joins the in-flight individual request
  assert.equal(c.querySelector('.eval-panel').hidden, false);
  assert.equal(c.querySelector('.eval-mname').textContent, 'Original');
  const input = app.document.querySelector('[data-field="background"]'); input.focus();
  fill(app, 'background', 'After request'); replacement.resolve(result('Replacement'));
  await finish(app, 'context');
  assert.equal(count, 2);
  assert.equal(c.querySelector('.eval-mname').textContent, 'Replacement');
  assert.equal(c.querySelector('.eval-stale-status').hidden, false);
  assert.equal(c.querySelector('.eval-save-btn').disabled, true);
  assert.equal(app.document.activeElement, input);
});

test('paired Question edits during an Outcome request make the arriving feedback stale', async t => {
  const pending = deferred();
  const app = await bootApp({ evaluate: body => body.fieldKey === 'outcomes' ? pending.promise : result() }); t.after(() => app.close());
  fill(app, 'researchQuestions', 'Original question'); fill(app, 'outcomes', 'Original outcome');
  section(app, 'research').click(); await waitFor(() => app.evaluationRequests.length === 2);
  fill(app, 'researchQuestions', 'Changed pairing context'); pending.resolve(result()); await finish(app, 'research');
  assert.equal(controls(app, 'outcomes').querySelector('.eval-stale-status').hidden, false);
});

test('a queued field cleared before its turn is skipped', async t => {
  const pending = deferred();
  const app = await bootApp({ evaluate: () => pending.promise }); t.after(() => app.close());
  ['background', 'goal', 'problemStatement'].forEach(key => fill(app, key, key));
  section(app, 'context').click(); await waitFor(() => app.evaluationRequests.length === 2);
  fill(app, 'problemStatement', ''); pending.resolve(result()); await finish(app, 'context');
  assert.equal(app.evaluationRequests.length, 2); assert.match(status(app, 'context'), /1 empty field skipped/);
});

for (const reset of ['clear', 'profile']) test(`${reset} invalidates active and queued work, including late responses and errors`, async t => {
  const jobs = [];
  const app = await bootApp({ url: 'https://research-plan.test/?test', evaluate: () => {
    const job = deferred(); jobs.push(job); return job.promise;
  } }); t.after(() => app.close());
  ['background', 'goal', 'problemStatement', 'objective'].forEach(key => fill(app, key, key));
  section(app, 'context').click(); section(app, 'research').click();
  await waitFor(() => jobs.length === 2);
  if (reset === 'clear') app.document.getElementById('clear-btn').click();
  else app.window.applyTestProfile('experienced');
  assert.ok(app.evaluationRequests.every(request => request.signal.aborted));
  for (const key of ['context', 'research']) {
    assert.equal(section(app, key).disabled, false); assert.equal(status(app, key), '');
  }
  fill(app, 'background', 'New plan'); section(app, 'context').click();
  jobs[0].resolve(result('Obsolete')); jobs[1].reject(new Error('Obsolete failure'));
  await waitFor(() => jobs.length >= 3);
  assert.equal(controls(app, 'background').querySelector('.eval-result-summary').hidden, true);
  assert.equal(controls(app, 'goal').querySelector('.eval-error').hidden, true);
  jobs[2].resolve(result('New plan'));
  if (reset === 'profile') {
    await waitFor(() => jobs.length === 5);
    jobs[3].resolve(result()); jobs[4].resolve(result());
  }
  await finish(app, 'context');
  assert.equal(controls(app, 'background').querySelector('.eval-mname').textContent, 'New plan');
  assert.equal(app.evaluationRequests.some(r => r.body.fieldKey === 'objective'), false, 'old queued research never starts');
});

test('a failed replacement keeps existing scores, expanded details and feedback controls', async t => {
  const pending = deferred(); let count = 0;
  const app = await bootApp({ evaluate: () => ++count === 1 ? result('Retained') : pending.promise }); t.after(() => app.close());
  fill(app, 'background', 'Unchanged content'); section(app, 'context').click(); await finish(app, 'context');
  const c = controls(app, 'background'); c.querySelector('.eval-result-btn').click();
  c.querySelector('.eval-reevaluate-btn').click(); await waitFor(() => count === 2);
  assert.equal(c.querySelector('.eval-save-btn').disabled, true);
  pending.reject(new Error('Replacement offline'));
  await waitFor(() => !c.querySelector('.eval-reevaluate-btn').disabled);
  assert.equal(c.querySelector('.eval-panel').hidden, false);
  assert.equal(c.querySelector('.eval-mname').textContent, 'Retained');
  assert.equal(c.querySelector('.eval-save-btn').disabled, false);
  assert.equal(c.querySelector('.eval-stale-status').hidden, true);
  assert.equal(c.querySelector('.eval-btn').hidden, false);
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

test('Print uses the existing handler without evaluating or changing collapsed feedback', async t => {
  const app = await bootApp({ evaluate: () => result() }); t.after(() => app.close());
  fill(app, 'background', 'Print content'); section(app, 'context').click(); await finish(app, 'context');
  let printed = 0; app.window.print = () => printed++;
  const c = controls(app, 'background');
  app.document.getElementById('print-btn').click();
  app.window.dispatchEvent(new app.window.Event('beforeprint'));
  app.window.dispatchEvent(new app.window.Event('afterprint'));
  assert.equal(printed, 1);
  assert.equal(c.querySelector('.eval-panel').hidden, true);
  c.querySelector('.eval-result-btn').click();
  app.window.dispatchEvent(new app.window.Event('beforeprint'));
  app.window.dispatchEvent(new app.window.Event('afterprint'));
  assert.equal(c.querySelector('.eval-panel').hidden, false);
  assert.equal(app.evaluationRequests.length, 1);
});
