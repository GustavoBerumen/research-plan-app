'use strict';
const test = require('node:test');
const PLAN = require('../plan-model');
const assert = require('node:assert/strict');
const { bootApp, waitFor, setValue, DRAFT_KEY } = require('./app-harness');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const F = require('./rpa-64-fixtures.cjs');
const W = require('../plan-workflow');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = (on = false, feedback = false) => ({ ok: true, json: async () => ({
  pilotMode: true, capabilities: { submissions: on, feedback, calibration: false,
    uploads: false, addFramework: false, jira: false, googleDrive: false },
  ...(on ? { submissions: F.config } : {}),
}) });
function seed(kind) {
  const p = F.plan(); p.version = 9; p.fields.emailAddress = 'owner@example.com';
  p.fields.comments = 'Dormant local comment'; p.fields.background = '';
  p.lists.researchQuestions.push('');
  p.lists.outcomes.push('');
  p.methods.push({ question: '', methods: [''], characteristics: [''], userGroups: [''], sampleSize: { v: '', o: '' } });
  p.signOff = W.createPlan({ id: 'synthetic-rpa6', at: p.savedAt, authorRole: 'leadResearcher',
    parties: { leadResearcher: { email: 'owner@example.com' }, projectRequester: { email: 'other@example.com' } },
    tokens: { leadResearcher: 'owner-token', projectRequester: 'review-token' } }).plan;
  if (kind === 'revoked') p.signOff = W.apply(p.signOff, { transition: 'revokeLink',
    role: 'leadResearcher', forRole: 'projectRequester', at: '2026-09-15T12:00:00Z', version: p.signOff.version }).plan;
  return p;
}
async function backup(app) {
  let blob;
  app.window.URL.createObjectURL = value => { blob = value; return 'blob:synthetic'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () {};
  app.document.getElementById('download-backup-btn').click();
  assert.ok(blob, 'normal own-plan download creates a backup');
  return JSON.parse(await new Promise(resolve => {
    const reader = new app.window.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob);
  }));
}
const content = p => Object.fromEntries(['fields', 'selects', 'lists', 'tables', 'custom', 'studies', 'signOff', 'createdAt'].map(k => [k, p[k]]));
// A version 9 seed reads back as version 10: its groups are studies, and the radios say how many (RPA-142).
const migrated = p => {
  const studies = PLAN.studiesFromGroups(p.methods, p.lists.researchQuestions);
  // Plan details also asks whether other researchers are involved (RPA-141): unanswered, and an empty row of names.
  return { ...p, studies, lists: { ...p.lists, researcherNames: [''] },
    selects: { ...p.selects, otherResearchers: { v: '', o: '' }, ...(studies.length ? { studyCount: PLAN.studyCountChoice(studies.length) } : {}) } };
};

test('entering a dead link cancels a pending save and refuses an already queued or direct save', async t => {
  const app = await bootApp({ draft: seed('unknown'), transformScript: (name, source) => name === 'app.js'
    ? source.replace(/\}\)\(\);\s*$/, 'window.rpa6Probe = { saveDraft, scheduleDraftSave, resolveLink, openDeadLink };\n})();') : source });
  t.after(() => app.close());
  const { window: w, document: d } = app;
  await pause(450);
  const before = w.localStorage.getItem(DRAFT_KEY);
  const probe = w.rpa6Probe;
  let callback, cancelled = false;
  const timeout = w.setTimeout, clear = w.clearTimeout;
  w.setTimeout = (fn, ms) => {
    if (ms === 400) { callback = fn; return 987654; }
    return timeout(fn, ms);
  };
  w.clearTimeout = id => { if (id === 987654) cancelled = true; else clear(id); };
  setValue(w, d.querySelector('[data-field="background"]'), 'An unsaved edit must not replace the saved plan after refusal.');
  assert.equal(typeof callback, 'function');
  w.history.replaceState(null, '', '/?as=unknown-token#review');
  probe.resolveLink(); probe.openDeadLink();
  assert.equal(cancelled, true);
  callback();
  assert.equal(probe.saveDraft(), false);
  assert.equal(w.localStorage.getItem(DRAFT_KEY), before, 'even an already queued callback cannot collect missing form data');
  callback = null; probe.scheduleDraftSave(); assert.equal(callback, null);
  assert.equal(d.querySelector('[data-field="researchTitle"]'), null);
});

for (const on of [false, true]) for (const timing of ['early', 'late']) for (const kind of ['unknown', 'revoked']) {
  test(`dead ${kind} link preserves the entire draft and blocks plan actions: submissions ${on}, config ${timing}`, async t => {
    const draft = seed(kind); let resolve;
    const delayed = new Promise(r => { resolve = r; });
    const app = await bootApp({ draft, configResponse: () => timing === 'early' ? response(on) : delayed,
      url: 'https://research-plan.test/?as=' + (kind === 'revoked' ? 'review-token' : 'unknown-token') + '#review' });
    t.after(() => app.close());
    const { window: w, document: d } = app;
    const stored = w.localStorage.getItem(DRAFT_KEY);
    assert.equal(stored, JSON.stringify(draft), 'even startup must not rewrite saved data');
    if (timing === 'late') { resolve(response(on)); await pause(20); }
    let writes = 0, downloads = 0, prints = 0, confirms = 0, reads = 0;
    const setItem = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function (...args) { writes++; return setItem.apply(this, args); };
    w.URL.createObjectURL = () => { downloads++; return 'blob:unexpected'; };
    w.print = () => { prints++; }; w.confirm = () => { confirms++; return true; };
    w.FileReader = class { constructor() { reads++; } };
    const dead = d.querySelector('.dead-link:not([hidden])'); assert.ok(dead);
    assert.equal(d.querySelector('[data-field="researchTitle"]'), null, 'no plan disclosure');
    assert.equal(dead.querySelector('a').getAttribute('href'), '/');
    for (const type of ['click', 'input', 'change']) dead.dispatchEvent(new w.Event(type, { bubbles: true }));
    for (const id of ['download-backup-btn', 'restore-backup-btn', 'clear-btn', 'print-btn', 'options-plan-change']) {
      const button = d.getElementById(id); assert.equal(button.disabled, true, id);
      // A stale/direct listener invocation is guarded as well as a normal disabled click.
      button.dispatchEvent(new w.Event('click', { bubbles: true }));
    }
    const picker = d.getElementById('backup-file');
    Object.defineProperty(picker, 'files', { value: [new w.File([JSON.stringify(draft)], 'synthetic.json')] });
    picker.dispatchEvent(new w.Event('change', { bubbles: true }));
    await pause(450);
    assert.equal(w.localStorage.getItem(DRAFT_KEY), stored);
    assert.deepEqual({ writes, downloads, prints, confirms, reads }, { writes: 0, downloads: 0, prints: 0, confirms: 0, reads: 0 });
    assert.deepEqual(app.jsdomErrors, []);
    // Follow the own-plan route by booting the same saved bytes on its normal URL.
    const own = await bootApp({ draft: stored, configResponse: () => response(on) }); t.after(() => own.close());
    const result = await backup(own);
    assert.deepEqual(content(result), content(migrated(draft)), 'all fields, sparse rows, studies and review history survive');
    const restore = own.document.getElementById('backup-file');
    Object.defineProperty(restore, 'files', { value: [new own.window.File([JSON.stringify(result)], 'recovery.json')] });
    restore.dispatchEvent(new own.window.Event('change', { bubbles: true }));
    await waitFor(() => /Backup restored and saved/.test(own.document.getElementById('backup-status').textContent), { timeout: 20000 });
    assert.deepEqual(content(await backup(own)), content(result));
    assert.deepEqual(own.jsdomErrors, []);
  });
}

for (const kind of ['failed', 'malformed', 'no-draft']) test(`dead link remains safe with ${kind} configuration or storage`, async t => {
  const app = await bootApp({ ...(kind === 'no-draft' ? {} : { draft: seed('unknown') }),
    url: 'https://research-plan.test/?as=unknown-token#review',
    configResponse: async () => kind === 'failed' ? { ok: false } : kind === 'malformed' ? { ok: true, json: async () => ({}) } : response() });
  t.after(() => app.close());
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  app.document.querySelector('.dead-link').click(); await pause(450);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  assert.equal(app.document.getElementById('download-backup-btn').disabled, true);
  assert.deepEqual(app.jsdomErrors, []);
});

test('feedback defaults off in pilot, keeps the non-pilot default, and permits explicit overrides', async () => {
  for (const [pilot, setting, enabled] of [['true', undefined, false], ['false', undefined, true],
    ['true', 'true', true], ['false', 'true', true], ['true', 'false', false], ['false', 'false', false]]) {
    const app = loadServer({ pilot, env: { RPA_FEEDBACK_ENABLED: setting } });
    assert.equal(JSON.parse((await app.request('/api/config')).body).capabilities.feedback, enabled);
    for (const body of ['{bad', JSON.stringify({ usefulness: 4 })]) {
      const result = await app.request('/api/feedback', 'POST', body);
      if (!enabled) {
        assert.equal(result.status, 403); assert.deepEqual(result.listeners, []);
        assert.deepEqual(app.writes, []); assert.deepEqual(app.providerCalls, []);
      } else assert.equal(result.status, body === '{bad' ? 400 : 200);
    }
    if (enabled) assert.deepEqual(app.writes.map(w => w.name), ['appendFile']);
  }
  for (const value of ['', 'TRUE', '1', ' false ']) assert.throws(() => loadServer({ env: { RPA_FEEDBACK_ENABLED: value } }), /RPA_FEEDBACK_ENABLED must be true or false/);
});

for (const timing of ['off', 'on', 'pending', 'failed', 'malformed']) test(`honest email wording and feedback gate during ${timing} configuration`, async t => {
  let resolve; const delayed = new Promise(r => { resolve = r; });
  const app = await bootApp({ email: false, configResponse: async () => timing === 'pending' ? delayed :
    timing === 'failed' ? { ok: false } : timing === 'malformed' ? { ok: true, json: async () => ({ pilotMode: true }) } : response(timing === 'on') });
  t.after(() => app.close());
  const { document: d, window: w } = app;
  const email = d.querySelector('[data-field="emailAddress"]'); setValue(w, email, 'typed@example.com');
  assert.match(d.querySelector('.email-step .field-hint-text').textContent, /does not send email/);
  assert.equal(d.querySelector('.email-playback-lead').textContent, 'Email address for this browser:');
  assert.doesNotMatch(d.querySelector('.email-step').textContent, /will be sent|use it to send/i);
  let posts = 0, blobs = 0;
  w.fetch = async () => { posts++; throw Error('Unexpected request'); };
  w.URL.createObjectURL = () => { blobs++; return 'blob:unexpected'; };
  for (const id of ['tool-feedback-open', 'tool-feedback-send', 'tool-feedback-download']) {
    const b = d.getElementById(id); assert.equal(b.hidden, true, id);
    b.dispatchEvent(new w.Event('click', { bubbles: true }));
  }
  assert.equal(d.getElementById('tool-feedback-form').hidden, true);
  assert.match(d.getElementById('tool-feedback-status').textContent, /collection is unavailable/);
  assert.doesNotMatch(d.getElementById('tool-feedback-status').textContent, /send.*file/i);
  assert.equal(posts, 0); assert.equal(blobs, 0);
  if (timing === 'pending') {
    resolve(response(true, true));
    await waitFor(() => d.querySelector('.submission-panel'));
    await waitFor(() => !d.getElementById('tool-feedback-open').hidden);
    assert.equal(d.querySelector('[data-field="emailAddress"]'), email);
    assert.equal(email.value, 'typed@example.com');
    assert.match(d.querySelector('.email-step .field-hint-text').textContent, /does not send email/);
  }
  assert.deepEqual(app.jsdomErrors, []);
});
