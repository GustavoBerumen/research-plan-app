'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY, withFieldUncommented } = require('./app-harness');
const contract = require('../submission-contract');
const f = require('./rpa-64-fixtures.cjs');
const KEY = 'research-plan-app:submission:v1:synthetic:test';
const response = (body, status = 201) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const configResponse = () => response({ pilotMode: true, capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: f.config }, 200);
const send = app => app.document.querySelector('.submission-send');
const status = app => app.document.querySelector('.submission-status').textContent;
const field = (app, key) => app.document.querySelector('[data-field="' + key + '"]');
const draft = () => ({ ...f.plan(), ui: { timelineVisible: false, section: 'review' } });
async function boot(t, options = {}) { const app = await bootApp({ draft: draft(), configResponse, ...options }); t.after(() => app.close()); return app; }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const links = app => Array.from(app.document.querySelectorAll('.submission-errors .error-summary-link'));

test('submission remains absent on older/disabled configuration; complete active schema sends only approved data', async t => {
  const old = await bootApp(); t.after(() => old.close()); assert.equal(send(old), null);
  let request;
  const p = draft(); p.fields.hypothesis = 'DORMANT SENTINEL';
  const app = await boot(t, { draft: p, submit: async body => { request = body; return response(f.receipt(body)); } });
  setValue(app.window, field(app, 'background'), 'Newest unsaved context');
  send(app).click(); await waitFor(() => /privately saved/.test(status(app)));
  assert.equal(request.plan.fields.background, 'Newest unsaved context'); assert.deepEqual(contract.validate(request.plan), []);
  assert.equal(JSON.stringify(request).includes('DORMANT SENTINEL'), false);
  assert.equal(JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).fields.hypothesis, 'DORMANT SENTINEL');
  assert.equal(field(app, 'researchTitle').value, p.fields.researchTitle); assert.equal(send(app).disabled, true);
  assert.equal(app.evaluationRequests.length, 0); assert.deepEqual(app.jsdomErrors, []);
});
test('missing later outcome and per-question Other text open the exact page/control and preserve hint associations', async t => {
  const p = draft(); p.lists.researchQuestions.push('Second question'); p.lists.outcomes.push('Second outcome');
  p.methods.push({ ...structuredClone(p.methods[0]), question: 'Second question' });
  let calls = 0; const app = await boot(t, { draft: p, submit: async () => { calls++; } });
  const outcomes = app.document.querySelectorAll('[data-list-key="outcomes"] .list-input');
  setValue(app.window, outcomes[1], '');
  const second = app.document.querySelectorAll('.methods-group')[1];
  second.querySelector('input[type=radio][value="__other__"]').click();
  const other = second.querySelector('.radio-other-row input[type=text]');
  send(app).click(); assert.equal(calls, 0); assert.equal(app.document.activeElement, app.document.querySelector('.submission-errors'));
  links(app).find(l => /outcome.*row 2/.test(l.textContent)).click();
  assert.equal(app.document.activeElement, outcomes[1]); assert.equal(outcomes[1].closest('.step').hidden, false);
  assert.equal(outcomes[1].closest('.field').classList.contains('page-hidden'), false);
  outcomes[1].closest('.step').querySelector('.step-continue').click();
  assert.equal(outcomes[1].closest('.list-row').querySelectorAll('.field-error').length, 1, 'final and question summaries share one inline error');
  const describedErrors = () => (outcomes[1].getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id.startsWith('submission-error-'));
  assert.equal(describedErrors().length, 1);
  outcomes[1].closest('.step').querySelector('.step-continue').click();
  assert.equal(outcomes[1].closest('.list-row').querySelectorAll('.field-error').length, 1, 'repeated validation does not duplicate the mark');
  assert.equal(describedErrors().length, 1);
  setValue(app.window, outcomes[1], 'Repaired outcome');
  assert.equal(outcomes[1].hasAttribute('aria-invalid'), false);
  outcomes[1].closest('.step').querySelector('.step-continue').click();
  assert.equal(app.document.querySelector('.review-step').hidden, false, 'Save returns to Review');
  links(app).find(l => /other sample size.*2/.test(l.textContent)).click();
  assert.equal(app.document.activeElement, other); assert.equal(other.closest('.radio-other-row').hidden, false);
  const originalHints = (other.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => !x.startsWith('submission-error-'));
  setValue(app.window, other, '5');
  assert.equal(other.hasAttribute('aria-invalid'), false);
  for (const hint of originalHints) assert.ok((other.getAttribute('aria-describedby') || '').includes(hint));
});

test('nonsensical Other sample size blocks Send at the text box while the draft remains editable', async t => {
  const p = draft(); p.methods[0].sampleSize = { v: '__other__', o: 'asdf' };
  const requests = [];
  const app = await boot(t, { draft: p, submit: async body => { requests.push(body); return response(f.receipt(body)); } });
  const other = app.document.querySelector('.radio-other-row input[type=text]');
  assert.equal(other.value, 'asdf', 'invalid final values still restore as editable drafts');
  send(app).click(); assert.equal(requests.length, 0);
  links(app).find(l => /valid sample size for research question 1/.test(l.textContent)).click();
  assert.equal(app.document.activeElement, other);
  assert.equal(other.getAttribute('aria-invalid'), 'true');
  setValue(app.window, other, '5–8');
  assert.equal(other.hasAttribute('aria-invalid'), false);
  send(app).click(); await waitFor(() => /privately saved/.test(status(app)));
  assert.equal(requests[0].plan.methods[0].sampleSize.o, '5–8');
});

test('a receipt from before validation tightened remains readable and an update still needs correction', async t => {
  const original = f.request(); original.plan.methods[0].sampleSize = { v: '__other__', o: 'asdf' };
  const stored = { version: 1, state: 'stored', request: original, fingerprint: contract.fingerprint(original.plan), receipt: f.receipt(original) };
  const app = await boot(t, { draft: { ...original.plan, ui: { section: 'review' } }, storage: { [KEY]: JSON.stringify(stored) } });
  assert.match(status(app), /privately saved/); assert.equal(send(app).disabled, true);
  setValue(app.window, field(app, 'background'), 'An updated context');
  send(app).click();
  assert.match(status(app), /confirm both declarations again/);
  assert.ok(links(app).some(l => /valid sample size for research question 1/.test(l.textContent)));
  assert.equal(JSON.parse(app.window.localStorage.getItem(KEY)).receipt.submissionId, original.submissionId);
});
test('unfinished schedule date buffer blocks a stale valid native date and focuses its incomplete year', async t => {
  let calls = 0; const app = await boot(t, { submit: async () => { calls++; } });
  const cell = app.document.querySelector('#stageTimeline-table tbody tr').children[2];
  const native = cell.querySelector('input[type=date]'), year = cell.querySelector('.date-year');
  const before = native.value; year.value = '20'; // Send reads typing buffers even before debounce or events.
  send(app).click();
  assert.equal(calls, 0); assert.equal(native.value, before);
  links(app).find(l => /completion date in schedule row 1/.test(l.textContent)).click();
  assert.equal(app.document.activeElement, year); assert.equal(year.getAttribute('aria-invalid'), 'true');
  setValue(app.window, year, '2026'); assert.equal(year.hasAttribute('aria-invalid'), false);
});

test('restoring initials-only JSON preserves it until Send then dates both sign-offs without field focus', async t => {
  const app = await boot(t, { submit: async body => { requests.push(body); return response(f.receipt(body)); } });
  const requests = [], p = draft();
  p.fields.signOffResearcher = 'AB'; p.fields.signOffProjectOwner = 'CD';
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [new app.window.File([JSON.stringify(p)], 'undated.json', { type: 'application/json' })] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled);
  assert.match(app.document.getElementById('backup-status').textContent, /restored/i);
  for (const key of ['signOffResearcher', 'signOffProjectOwner']) {
    assert.equal(field(app, key).value, p.fields[key], 'restore does not date an approval');
    assert.equal(JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).fields[key], p.fields[key]);
  }
  send(app).click(); await waitFor(() => /privately saved/.test(status(app)));
  const today = new Intl.DateTimeFormat('en-GB').format(new Date());
  for (const key of ['signOffResearcher', 'signOffProjectOwner']) {
    assert.equal(requests[0].plan.fields[key], p.fields[key] + ' — ' + today);
    assert.equal(field(app, key).value, requests[0].plan.fields[key]);
  }
  assert.deepEqual(contract.validate(requests[0].plan), []);
});

test('Send preserves dated approvals and does not date an unchecked declaration', async t => {
  const p = draft(); p.fields.signOffResearcher = 'AB — 29/02/2024';
  p.fields.signOffProjectOwner = 'CD'; p.fields.declarationRequester = '';
  const requests = [];
  const app = await boot(t, { draft: p, submit: async body => { requests.push(body); return response(f.receipt(body)); } });
  send(app).click(); assert.equal(requests.length, 0);
  assert.equal(field(app, 'signOffProjectOwner').value, 'CD');
  field(app, 'declarationRequester').click();
  send(app).click(); await waitFor(() => requests.length === 1);
  assert.equal(requests[0].plan.fields.signOffResearcher, 'AB — 29/02/2024');
  assert.match(requests[0].plan.fields.signOffProjectOwner, /^CD — \d{2}\/\d{2}\/\d{4}$/);
});

test('an older undated receipt remains recognised without stamping or resubmitting it', async t => {
  const original = f.request(); original.plan.fields.signOffResearcher = 'AB'; original.plan.fields.signOffProjectOwner = 'CD';
  const stored = { version: 1, state: 'stored', request: original, fingerprint: contract.fingerprint(original.plan), receipt: f.receipt(original) };
  let requests = 0;
  const app = await boot(t, { draft: { ...original.plan, ui: { section: 'review' } }, storage: { [KEY]: JSON.stringify(stored) }, submit: async () => { requests++; } });
  await waitFor(() => send(app).disabled);
  assert.match(status(app), /privately saved/);
  assert.equal(field(app, 'signOffProjectOwner').value, 'CD');
  assert.equal(requests, 0);
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem(KEY)), stored);
});
test('pending snapshot survives a lost receipt and reload; retry preserves exact request and original receipt', async t => {
  const requests = [];
  const app = await boot(t, { submit: async body => { requests.push(body); throw new Error('Lost response after possible write'); } });
  send(app).click(); await waitFor(() => /Receipt unconfirmed/.test(status(app)));
  const saved = app.window.localStorage.getItem(KEY); assert.ok(saved); assert.equal(JSON.parse(saved).state, 'pending');
  const reloaded = await boot(t, { storage: { [KEY]: saved }, submit: async body => { requests.push(body); return response(f.receipt(body), 200); } });
  assert.equal(send(reloaded).textContent, 'Retry saved snapshot'); send(reloaded).click();
  await waitFor(() => /privately saved/.test(status(reloaded)));
  assert.deepEqual(requests[0], requests[1]);
  const confirmed = app.window.JSON.parse(reloaded.window.localStorage.getItem(KEY));
  const third = await boot(t, { storage: { [KEY]: JSON.stringify(confirmed) }, submit: async () => { throw new Error('No new request expected'); } });
  assert.equal(send(third).disabled, true); assert.match(status(third), /2026-09-14T12:34:56/);
});
test('double click, current edits and a late receipt never label the current edited plan as sent', async t => {
  const gate = deferred(); const requests = [];
  const app = await boot(t, { submit: async body => { requests.push(body); return gate.promise; } });
  send(app).click(); send(app).click(); assert.equal(requests.length, 1);
  setValue(app.window, field(app, 'background'), 'An unsent edit');
  gate.resolve(response(f.receipt(requests[0]))); await waitFor(() => /earlier snapshot/.test(status(app)));
  assert.equal(send(app).textContent, 'Prepare updated submission');
  send(app).click(); assert.equal(field(app, 'declarationResearcher').checked, false); assert.equal(field(app, 'declarationRequester').checked, false);
  send(app).click(); assert.equal(requests.length, 1, 'fresh declarations are required');
});
test('clear and backup replacement during an in-flight send retain the old reference separately', async t => {
  for (const replace of ['clear', 'restore']) {
    const gate = deferred(); let request;
    const app = await boot(t, { submit: async body => { request = body; return gate.promise; } });
    send(app).click();
    if (replace === 'clear') app.document.getElementById('clear-btn').click();
    else {
      const p = draft(); p.fields.researchTitle = 'Replacement plan';
      const file = new app.window.File([JSON.stringify(p)], 'synthetic.json', { type: 'application/json' });
      const picker = app.document.getElementById('backup-file'); Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
      picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
      await waitFor(() => field(app, 'researchTitle').value === 'Replacement plan');
    }
    gate.resolve(response(f.receipt(request))); await waitFor(() => JSON.parse(app.window.localStorage.getItem(KEY)).state === 'stored');
    assert.equal(field(app, 'researchTitle').value, replace === 'clear' ? '' : 'Replacement plan');
    assert.match(status(app), /earlier snapshot|replacement plan/); assert.notEqual(send(app).textContent, 'Plan received');
  }
});
test('blocked persistence, malformed receipts and stale 422 responses cannot create false success or misplaced errors', async t => {
  let calls = 0; const app = await boot(t, { submit: async () => { calls++; } });
  const original = app.window.Storage.prototype.setItem;
  app.window.Storage.prototype.setItem = function (key, value) { if (key === KEY) throw new Error('Quota exceeded'); return original.call(this, key, value); };
  send(app).click(); await waitFor(() => /Nothing was sent/.test(status(app))); assert.equal(calls, 0);
  const malformed = await boot(t, { submit: async () => response({ status: 'stored' }) });
  send(malformed).click(); await waitFor(() => /Receipt unconfirmed/.test(status(malformed))); assert.equal(JSON.parse(malformed.window.localStorage.getItem(KEY)).state, 'pending');
  const gate = deferred(); const stale = await boot(t, { submit: () => gate.promise }); send(stale).click();
  setValue(stale.window, field(stale, 'background'), 'Changed while waiting');
  gate.resolve(response({ code: 'incomplete_plan', errors: [{ key: 'background', message: '<script>bad</script>' }] }, 422));
  await waitFor(() => /not stored/.test(status(stale))); assert.equal(links(stale).length, 0);
});
test('new active fields fail closed while local recovery continues to accept incomplete drafts', async t => {
  const template = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
  const app = await boot(t, { textAssets: { 'research-plan-template.md': withFieldUncommented(template, 'hypothesis') } });
  send(app).click(); assert.match(app.document.querySelector('.submission-errors').textContent, /active form has changed/);
  assert.ok(field(app, 'hypothesis')); assert.equal(app.document.getElementById('download-backup-btn').disabled, false);
});

test('delayed submission configuration never blocks editing and adds Send without replacing the draft', async t => {
  const gate = deferred();
  const app = await boot(t, { configResponse: () => gate.promise });
  assert.equal(send(app), null);
  setValue(app.window, field(app, 'background'), 'Edit while configuration is pending');
  gate.resolve(configResponse()); await waitFor(() => send(app));
  assert.equal(field(app, 'background').value, 'Edit while configuration is pending');
  assert.equal(app.document.querySelectorAll('.submission-panel').length, 1);
});

test('removing an optional extra outcome clears both final and section error associations immediately', async t => {
  const p = draft(); p.lists.outcomes.push('');
  const app = await boot(t, { draft: p }); send(app).click();
  links(app).find(l => /outcome.*row 2/.test(l.textContent)).click();
  const step = app.document.querySelector('#body-research').closest('.step'); step.querySelector('.step-continue').click();
  assert.equal(step.querySelector('.error-summary').hidden, false);
  app.document.querySelectorAll('[data-list-key="outcomes"] .list-remove')[1].click();
  assert.equal(step.querySelector('.error-summary').hidden, true);
  assert.equal(app.document.querySelector('.submission-errors').hidden, true);
  assert.equal(app.document.querySelector('[data-submission-error-owner]'), null);
});

test('an updated review ignores tool feedback, resets declarations for authored changes and preserves backup replacement', async t => {
  const original = f.request();
  const stored = { version: 1, state: 'stored', request: original, fingerprint: contract.fingerprint(original.plan), receipt: f.receipt(original) };
  const app = await boot(t, { storage: { [KEY]: JSON.stringify(stored) } });
  setValue(app.window, field(app, 'background'), 'Updated authored content'); send(app).click();
  field(app, 'declarationResearcher').click(); field(app, 'declarationRequester').click();
  setValue(app.window, app.document.querySelector('#tool-feedback-not-as-expected'), 'Testing the form');
  assert.equal(field(app, 'declarationResearcher').checked, true, 'tool feedback is outside the active plan');
  assert.equal(field(app, 'declarationRequester').checked, true);
  setValue(app.window, field(app, 'goal'), 'Another authored change');
  assert.equal(field(app, 'declarationResearcher').checked, false);
  const file = new app.window.File([JSON.stringify(draft())], 'synthetic.json', { type: 'application/json' });
  const picker = app.document.getElementById('backup-file'); Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled);
  assert.match(app.document.getElementById('backup-status').textContent, /^Backup restored and saved/);
  assert.equal(field(app, 'declarationResearcher').checked, true, 'restoration preserves declared backup values');
  assert.equal(JSON.parse(app.window.localStorage.getItem(KEY)).prepared, false, 'a replacement needs its own deliberate updated review');
});

test('removing a row after receipt makes the changed snapshot available for a deliberate updated review', async t => {
  const original = f.request(); original.plan.lists.outcomes.push('Additional outcome');
  const stored = { version: 1, state: 'stored', request: original, fingerprint: contract.fingerprint(original.plan), receipt: f.receipt(original) };
  const app = await boot(t, { draft: { ...original.plan, ui: { section: 'review' } }, storage: { [KEY]: JSON.stringify(stored) } });
  assert.equal(send(app).disabled, true);
  app.document.querySelectorAll('[data-list-key="outcomes"] .list-remove')[1].click();
  assert.equal(send(app).disabled, false); assert.equal(send(app).textContent, 'Prepare updated submission');
  assert.match(status(app), /earlier snapshot/);
});
