'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue } = require('./app-harness');
const { config } = require('./rpa-64-fixtures.cjs');

test('submission validation does not prevent completing the separate email page', async t => {
  let submissions = 0;
  const app = await bootApp({ email: false, configResponse: async () => ({ ok: true, status: 200,
    json: async () => ({ pilotMode: true, capabilities: { submissions: true, feedback: false, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: config }) }),
    submit: async () => { submissions++; throw Error('Nothing should be sent'); } });
  t.after(() => app.close());
  assert.ok(app.document.querySelector('.submission-panel'), 'the submission capability is active');
  const gate = app.document.querySelector('.email-step');
  const input = gate.querySelector('input[type=email]');
  const next = gate.querySelector('.step-continue');
  assert.equal(gate.hidden, false);
  setValue(app.window, input, 'not-an-address'); next.click();
  assert.equal(gate.hidden, false, 'invalid address stays on the email page');
  setValue(app.window, input, 'person@example.com'); next.click();
  assert.equal(gate.hidden, true, 'a valid email can continue while the plan is still incomplete');
  assert.equal(submissions, 0);
  assert.deepEqual(app.jsdomErrors, []);
});

const compatF = require('./rpa-64-fixtures.cjs');
const compatW = require('../plan-workflow');
const { waitFor, DRAFT_KEY } = require('./app-harness');
const configResponse = () => ({ ok: true, status: 200, json: async () => ({ pilotMode: true,
  capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: config }) });
const control = (app, key) => app.document.querySelector('[data-field="' + key + '"]');
async function backupOf(app) {
  let blob;
  app.window.URL.createObjectURL = value => { blob = value; return 'blob:synthetic-backup'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () {};
  app.document.getElementById('download-backup-btn').click();
  assert.ok(blob, app.document.getElementById('backup-status').textContent);
  return JSON.parse(await new Promise(resolve => {
    const reader = new app.window.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob);
  }));
}
async function restoreInto(app, draft) {
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true,
    value: [new app.window.File([JSON.stringify(draft)], 'synthetic.json', { type: 'application/json' })] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  // A full-suite run contends with many jsdom renders; this is a completion
  // wait, not a performance assertion. The exact restored data is checked below.
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled,
    { timeout: 20000, message: 'Synthetic backup restore did not finish: ' + app.document.getElementById('backup-status').textContent });
  return app.document.getElementById('backup-status').textContent;
}
function draftWithHistory() {
  const p = compatF.plan(); p.fields.emailAddress = 'owner@example.com'; p.fields.comments = 'DORMANT COMMENT';
  p.signOff = compatW.createPlan({ id: 'synthetic-history', at: p.savedAt, authorRole: 'leadResearcher',
    parties: { leadResearcher: { email: 'owner@example.com', displayName: 'AB' }, projectRequester: { email: 'other@example.com', displayName: 'CD' } } }).plan;
  return p;
}

test('late MVP configuration preserves control identity and switches to the tested declaration flow', async t => {
  let resolve;
  const deferred = new Promise(r => { resolve = r; });
  const app = await bootApp({ draft: compatF.plan(), configResponse: () => deferred }); t.after(() => app.close());
  assert.ok(app.document.querySelector('.sign-off'));
  const initials = control(app, 'signOffResearcher');
  setValue(app.window, initials, 'MY — 15/09/2026');
  resolve(configResponse()); await waitFor(() => app.document.querySelector('.submission-panel'));
  assert.equal(control(app, 'signOffResearcher'), initials);
  assert.equal(initials.value, 'MY — 15/09/2026');
  assert.equal(app.document.querySelector('.sign-off'), null);
  assert.equal(app.document.querySelectorAll('.submission-signoffs .field').length, 4);
  assert.match(app.document.querySelector('.email-step .field-hint-text').textContent, /does not send email/);
  assert.doesNotMatch(app.document.querySelector('.email-playback-lead').textContent, /will be sent/);
  assert.deepEqual(app.jsdomErrors, []);
});

test('v2 Send preserves the approved collection boundary while a v11 backup retains browser identity and review history', async t => {
  let received;
  const p = draftWithHistory();
  const app = await bootApp({ draft: p, configResponse, submit: async request => {
    received = request; return { ok: true, status: 201, json: async () => compatF.receipt(request) };
  } }); t.after(() => app.close());
  assert.equal(app.document.querySelector('.sign-off'), null);
  app.document.querySelector('.submission-send').click();
  await waitFor(() => /privately saved/.test(app.document.querySelector('.submission-status').textContent));
  assert.equal(received.plan.version, 11);
  assert.equal(received.plan.planId, p.planId);
  assert.deepEqual(received.plan.lists.researcherNames, ['Sam Okoro']);
  assert.equal(received.plan.fields.emailAddress, undefined);
  assert.equal(received.plan.signOff, undefined);
  assert.equal(received.plan.fields.comments, '');
  assert.doesNotMatch(JSON.stringify(received), /owner@example|other@example|DORMANT COMMENT|synthetic-history/);
  const backup = await backupOf(app);
  assert.equal(backup.version, 11);
  assert.equal(backup.planId, p.planId);
  assert.equal(backup.fields.emailAddress, p.fields.emailAddress);
  assert.equal(backup.fields.comments, p.fields.comments);
  assert.deepEqual(backup.signOff, p.signOff);
  const target = await bootApp({ configResponse }); t.after(() => target.close());
  assert.match(await restoreInto(target, backup), /^Backup restored and saved/);
  const restored = await backupOf(target);
  assert.deepEqual(restored.signOff, p.signOff);
  assert.equal(restored.fields.comments, p.fields.comments);
  assert.equal(restored.fields.researchTitle, p.fields.researchTitle);
  assert.deepEqual(app.jsdomErrors.concat(target.jsdomErrors), []);
});

test('failed v11 restore keeps the original review record and working email-page bindings', async t => {
  const p = draftWithHistory();
  const app = await bootApp({ draft: p, configResponse }); t.after(() => app.close());
  const originalTitle = control(app, 'researchTitle');
  const originalGate = app.document.querySelector('.email-step');
  const replacement = compatF.plan(); replacement.fields.researchTitle = 'Replacement must roll back';
  const proto = app.window.Storage.prototype;
  const setItem = proto.setItem;
  proto.setItem = function (key, value) { if (key === DRAFT_KEY) throw Error('Synthetic storage refusal'); return setItem.call(this, key, value); };
  try { assert.match(await restoreInto(app, replacement), /could not be saved/); }
  finally { proto.setItem = setItem; }
  assert.equal(control(app, 'researchTitle'), originalTitle);
  assert.equal(originalTitle.value, p.fields.researchTitle);
  assert.deepEqual((await backupOf(app)).signOff, p.signOff);
  app.document.getElementById('options-plan-change').click();
  assert.equal(originalGate.hidden, false, 'the restored closure targets the original email page');
  assert.deepEqual(app.jsdomErrors, []);
});

test('editing in the MVP reopens an earlier workflow approval and preserves its history', async t => {
  const source = await bootApp({ draft: compatF.plan() }); t.after(() => source.close());
  const press = label => {
    const button = Array.from(source.document.querySelectorAll('.sign-off-actions button')).find(b => b.textContent === label);
    assert.ok(button, label); button.click();
  };
  source.document.querySelector('.sign-off-setup input[value=leadResearcher]').click();
  press('Continue'); press('Continue');
  setValue(source.window, source.document.getElementById('sign-off-other-email'), 'reviewer@example.com');
  press('Sign for local review'); press('Sign');
  const approved = await backupOf(source);
  assert.equal(approved.signOff.status, 'approved');
  const app = await bootApp({ draft: approved, configResponse }); t.after(() => app.close());
  assert.deepEqual((await backupOf(app)).signOff, approved.signOff, 'restoring alone preserves the record');
  setValue(app.window, control(app, 'background'), 'An authored change in the MVP');
  await waitFor(() => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).signOff?.status === 'draft');
  const revised = await backupOf(app);
  assert.deepEqual(revised.signOff.history.slice(0, approved.signOff.history.length), approved.signOff.history);
  assert.equal(revised.signOff.signatures.leadResearcher, null);
  assert.equal(revised.signOff.signatures.projectRequester, null);
  assert.equal(revised.signOff.history[approved.signOff.history.length].transition, 'reopen');
  assert.deepEqual(source.jsdomErrors.concat(app.jsdomErrors), []);
});
