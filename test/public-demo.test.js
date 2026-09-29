'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadServer, PRIVATE } = require('./rpa-89-server-harness.cjs');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const demoEnv = { RPA_PUBLIC_DEMO: 'true', RPA_PILOT_PASSWORD: undefined, RPA_AI_ENABLED: 'true', RENDER: 'true' };
const disabled = { submissions: false, signOff: false, feedback: false, calibration: false,
  uploads: false, addFramework: false, jira: false, googleDrive: false };
const evaluation = JSON.stringify({ fieldKey: 'background', text: 'Fictional plan text',
  rubric: [{ name: 'Clarity', desc: 'Names the participants.' }] });

test('public demo must retain pilot restrictions and refuse collection settings', () => {
  for (const value of ['TRUE', '', '1']) assert.throws(() => loadServer({ env: { RPA_PUBLIC_DEMO: value } }), /RPA_PUBLIC_DEMO/);
  assert.throws(() => loadServer({ pilot: 'false', env: demoEnv }), /Public demo requires/);
  assert.throws(() => loadServer({ env: { ...demoEnv, RPA_AI_ENABLED: 'false' } }), /Public demo requires/);
  for (const key of ['RPA_FEEDBACK_ENABLED', 'RPA_SUBMISSIONS_ENABLED', 'RPA_SIGN_OFF_ENABLED']) {
    assert.throws(() => loadServer({ env: { ...demoEnv, [key]: 'true' } }), /collection disabled/);
  }
  assert.equal(loadServer({ env: demoEnv }).providerCalls.length, 0);
});

test('anonymous demo allows only public assets and AI; restricted APIs reject before body reads', async () => {
  const app = loadServer({ env: demoEnv });
  assert.equal((await app.request('/', 'GET', '', { authorization: undefined })).status, 200);
  const config = await app.request('/api/config', 'GET', '', { authorization: undefined });
  const parsed = JSON.parse(config.body);
  assert.equal(parsed.publicDemo, true);
  assert.equal(parsed.pilotMode, true);
  assert.deepEqual(parsed.capabilities, disabled);
  assert.doesNotMatch(config.body, /synthetic-unused|synthetic-token|synthetic-google|password/i);
  for (const file of [...PRIVATE, 'research-theoretical-frameworks.md', 'pilot-guard.js']) {
    assert.equal((await app.request('/' + file, 'GET', '', { authorization: undefined })).status, 404, file);
  }
  for (const [url, method] of [['/api/calibration', 'POST'], ['/api/feedback', 'POST'], ['/api/submissions', 'POST'],
    ['/api/sign-off', 'POST'], ['/api/sign-off/read', 'GET'], ['/api/upload', 'POST'], ['/api/add-framework', 'POST'],
    ['/api/jira/search', 'GET']]) {
    const result = await app.request(url, method, '{"pilotMode":false,"capabilities":{"uploads":true}}', { authorization: undefined });
    assert.equal(result.status, 403, url);
    assert.deepEqual(result.listeners, [], url);
  }
  const crossSite = await app.request('/api/evaluate', 'POST', evaluation,
    { authorization: undefined, origin: 'https://other.invalid', 'sec-fetch-site': 'cross-site' });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(crossSite.listeners, []);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.proxyCalls, []);
});

test('anonymous evaluation succeeds with the existing backend and credit failure is safe', async () => {
  const success = loadServer({ env: demoEnv, provider: async request => ({ content: [{ type: 'tool_use',
    name: request.tools[0].name, input: { metrics: [{ name: 'Clarity', score: 2, desc: 'Synthetic result.' }],
      recommendations: [{ criterionName: 'Clarity', text: 'Clarify participants.' }] } }] }) });
  const result = await success.request('/api/evaluate', 'POST', evaluation, { authorization: undefined });
  assert.equal(result.status, 200, result.body);
  assert.equal(success.providerCalls.length, 1);
  assert.equal(success.providerOptions[0].maxRetries, 0);
  assert.ok(success.providerOptions[0].timeout <= 30_000);

  const exhausted = loadServer({ env: demoEnv, provider: async () => {
    throw Object.assign(new Error('Your credit balance is too low: SECRET PLAN TEXT'), { status: 400 });
  } });
  const failed = await exhausted.request('/api/evaluate', 'POST', evaluation, { authorization: undefined });
  assert.equal(failed.status, 503);
  assert.match(failed.body, /AI feedback is unavailable/);
  assert.match(failed.body, /continue editing, back up, or export/);
  assert.doesNotMatch(failed.body + JSON.stringify(exhausted.logs), /SECRET PLAN TEXT|Fictional plan text/);
  assert.equal(exhausted.providerCalls.length, 1);
  assert.deepEqual(exhausted.writes, []);

  const broken = loadServer({ env: demoEnv, provider: async () => {
    throw new Error('Provider failed: SECRET PLAN TEXT');
  } });
  const unavailable = await broken.request('/api/evaluate', 'POST', evaluation, { authorization: undefined });
  assert.equal(unavailable.status, 502);
  assert.match(unavailable.body, /AI feedback is unavailable/);
  assert.doesNotMatch(unavailable.body + JSON.stringify(broken.logs), /SECRET PLAN TEXT|Fictional plan text/);
});

test('reader notice appears only in demo and failed evaluation preserves the browser draft', async t => {
  const config = () => ({ ok: true, json: async () => ({ pilotMode: true, publicDemo: true, capabilities: disabled }) });
  const app = await bootApp({ configResponse: config, evaluate: async () => {
    throw new Error('AI feedback is unavailable right now. Your draft remains in this browser.');
  } });
  t.after(() => app.close());
  assert.equal(app.document.getElementById('public-demo-notice').hidden, false);
  assert.match(app.document.getElementById('public-demo-notice').textContent, /AI suggestions sends relevant text to Anthropic/);
  const background = app.document.querySelector('[data-field="background"]');
  setValue(app.window, background, 'Fictional reader draft');
  const controls = background.closest('.field').querySelector('.eval-controls');
  controls.querySelector('.eval-btn').click();
  await waitFor(() => !controls.querySelector('.eval-error').hidden);
  assert.match(controls.querySelector('.eval-error').textContent, /AI feedback is unavailable/);
  assert.equal(background.value, 'Fictional reader draft');
  await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY)?.includes('Fictional reader draft'));
  assert.equal(app.document.getElementById('download-backup-btn').disabled, false);
  assert.equal(app.document.getElementById('download-word-btn').disabled, false);

  const reloaded = await bootApp({ configResponse: config, draft: app.window.localStorage.getItem(DRAFT_KEY) });
  t.after(() => reloaded.close());
  assert.equal(reloaded.document.querySelector('[data-field="background"]').value, 'Fictional reader draft');
});
