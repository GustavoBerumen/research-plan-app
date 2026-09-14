'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const { createPilotGuard, PILOT_BODY_BYTES } = require('../pilot-guard');
const { loadServer, AUTHORIZATION, PILOT_PASSWORD, ASSETS } = require('./rpa-89-server-harness.cjs');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const env = { RPA_PILOT_PASSWORD: PILOT_PASSWORD, RPA_AI_ENABLED: 'true' };
const evaluationBody = JSON.stringify({ fieldKey: 'background', text: 'Synthetic research plan.',
  rubric: [{ name: 'Clarity', desc: 'Names the participants.' }] });
const frameworkBody = JSON.stringify({ fields: { background: 'Synthetic research plan.' } });
const methodsBody = JSON.stringify({ objective: 'Synthetic objective', researchQuestions: ['Synthetic question?'] });
const paidRoutes = [['/api/evaluate', evaluationBody], ['/api/suggest-framework', frameworkBody], ['/api/suggest-methods', methodsBody]];

test('pilot and Render startup fail closed for missing or malformed protection', () => {
  for (const password of [undefined, '', 'short', ' '.repeat(25), 'a'.repeat(201), 'a'.repeat(20) + '\n']) {
    assert.throws(() => loadServer({ env: { RPA_PILOT_PASSWORD: password } }), /RPA_PILOT_PASSWORD/);
  }
  assert.throws(() => loadServer({ env: { RPA_AI_ENABLED: 'TRUE' } }), /RPA_AI_ENABLED/);
  for (const pilot of ['false', null]) assert.throws(() => loadServer({ pilot, env: { RENDER: 'true' } }), /requires RPA_PILOT_MODE=true/);
});

test('every app asset and API requires the password on every hostname before any reads or body listeners', async () => {
  const urls = ['/', ...ASSETS.map(s => '/' + s), '/api/config', '/api/framework?name=Synthetic',
    '/api/evaluate', '/api/suggest-framework', '/api/suggest-methods', '/api/upload', '/api/calibration', '/api/add-framework', '/api/jira/search'];
  for (const host of ['example.onrender.com', 'pilot.example.org']) {
    const app = loadServer();
    for (const url of urls) {
      const result = await app.request(url, url.startsWith('/api/') ? 'POST' : 'GET', '{', { authorization: undefined, host });
      assert.equal(result.status, 401, url);
      assert.match(result.headers['WWW-Authenticate'], /^Basic/);
      assert.deepEqual(result.listeners, []);
      assert.doesNotMatch(result.body, /synthetic-pilot|synthetic-unused|SYNTHETIC PRIVATE/);
    }
    assert.equal(app.reads.length, 0);
    assert.equal((await app.request('/')).status, 200);
    assert.equal((await app.request('/pilot-guard.js')).status, 404);
    assert.equal(app.providerCalls.length, 0);
    assert.deepEqual(app.writes, []);
  }
});

test('only exact public GET/HEAD health probes bypass login; no secrets in config', async () => {
  const app = loadServer();
  for (const method of ['GET', 'HEAD']) {
    const result = await app.request('/healthz', method, '', { authorization: undefined });
    assert.equal(result.status, 200);
    assert.equal(result.body, method === 'HEAD' ? '' : 'ok');
  }
  for (const url of ['/healthz/', '/healthz/app.js', '/healthz/../app.js']) assert.notEqual((await app.request(url, 'GET', '', { authorization: undefined })).status, 200);
  assert.equal((await app.request('/healthz', 'POST', '', { authorization: undefined })).status, 401);
  assert.equal((await app.request('/healthz', 'POST')).status, 405);
  assert.equal(app.reads.length, 0);
  const config = await app.request('/api/config');
  assert.doesNotMatch(config.body, /password|synthetic-unused|synthetic-token|synthetic-google/);
  assert.equal(config.headers['X-Frame-Options'], 'DENY');
  assert.equal(config.headers['Cache-Control'], 'no-store');
});

test('password rotation rejects old credentials; malformed credentials and brute force are bounded', async () => {
  const app = loadServer({ env: { RPA_PILOT_PASSWORD: 'a-different-synthetic-password' } });
  assert.equal((await app.request('/')).status, 401);
  const correct = 'Basic ' + Buffer.from('pilot:a-different-synthetic-password').toString('base64');
  assert.equal((await app.request('/', 'GET', '', { authorization: correct })).status, 200);
  for (const authorization of ['Bearer token', 'Basic ???', 'Basic cGlsb3Q6', AUTHORIZATION.slice(0, -2), 'Basic ' + Buffer.from('wrong:' + PILOT_PASSWORD).toString('base64')]) {
    assert.equal((await app.request('/', 'GET', '', { authorization })).status, 401);
  }
  for (let i = 0; i < 30; i++) await app.request('/', 'GET', '', { authorization: undefined });
  assert.equal((await app.request('/', 'GET', '', { authorization: undefined })).status, 429);
  assert.equal((await app.request('/', 'GET', '', { authorization: correct })).status, 200, 'valid sign-in is not locked out');
});

test('cross-site POSTs are rejected before parsing even with valid browser credentials', async () => {
  const app = loadServer({ env: { RENDER: 'true' } });
  for (const headers of [{ origin: 'https://evil.invalid' }, { origin: 'null' }, { origin: 'https://pilot.invalid/path' },
    { origin: 'http://pilot.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
    const result = await app.request('/api/evaluate', 'POST', evaluationBody, headers);
    assert.equal(result.status, 403);
    assert.deepEqual(result.listeners, []);
  }
  const accepted = await app.request('/api/evaluate', 'POST', '{}', { origin: 'https://pilot.invalid' });
  assert.equal(accepted.status, 400, 'same-origin reaches input validation');
  assert.equal(app.providerCalls.length, 0);
});

test('pilot AI starts paused unless explicitly enabled; editing assets and backups remain available', async () => {
  for (const enabled of [undefined, 'false']) {
    const app = loadServer({ env: { RPA_AI_ENABLED: enabled } });
    for (const [url, body] of paidRoutes) {
      const result = await app.request(url, 'POST', body);
      assert.equal(result.status, 503);
      assert.match(result.body, /writing is safe/);
      assert.deepEqual(result.listeners, []);
    }
    assert.equal((await app.request('/')).status, 200);
    assert.equal((await app.request('/api/config')).status, 200);
    assert.equal(app.providerCalls.length, 0);
  }
});

test('request limit is shared across paid routes and cannot be bypassed with forwarded IP headers', async () => {
  const app = loadServer();
  for (let i = 0; i < 30; i++) {
    assert.equal((await app.request(paidRoutes[i % 3][0], 'POST', '{}', { 'x-forwarded-for': String(i) })).status, 400);
  }
  const result = await app.request('/api/evaluate', 'POST', evaluationBody, { 'x-forwarded-for': 'new-ip' });
  assert.equal(result.status, 429);
  assert.equal(result.headers['Retry-After'], '60');
  assert.deepEqual(result.listeners, []);
  assert.equal((await app.request('/api/config')).status, 200);
  assert.equal(app.providerCalls.length, 0);
});

test('byte limits and invalid object bodies return errors without provider calls', async () => {
  for (const [url] of paidRoutes) {
    const app = loadServer();
    for (const body of ['null', '[]', '"text"', '{']) assert.equal((await app.request(url, 'POST', body)).status, 400);
    const body = JSON.stringify({ text: 'é'.repeat(PILOT_BODY_BYTES / 2) });
    assert.equal((await app.request(url, 'POST', body)).status, 413, 'UTF-8 bytes, not JS character count');
    const declared = await app.request(url, 'POST', '', { 'content-length': String(PILOT_BODY_BYTES + 1) });
    assert.equal(declared.status, 413);
    assert.deepEqual(declared.listeners, []);
    assert.equal(app.providerCalls.length, 0);
  }
});

test('provider concurrency and rolling minute limits include failures and release settled slots', async () => {
  let time = 1_000, calls = 0;
  const pending = [];
  const guard = createPilotGuard({ pilot: true, env, now: () => time });
  const client = guard.wrapClient({ messages: { create: (request, options) => {
    calls++;
    assert.equal(options.maxRetries, 0);
    assert.ok(options.timeout <= 30_000);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } } });
  const four = Array.from({ length: 4 }, () => client.messages.create({}));
  await assert.rejects(client.messages.create({}), /busy/);
  assert.equal(calls, 4);
  pending.shift().reject(new Error('synthetic provider failure'));
  await assert.rejects(four[0], /synthetic/);
  const replacement = client.messages.create({});
  while (pending.length) pending.shift().resolve({ content: [] });
  await Promise.all([...four.slice(1), replacement]);
  // A fresh wrapper shares the same guard's provider budget.
  const fast = guard.wrapClient({ messages: { create: async () => ({ content: [] }) } });
  for (let i = 5; i < 60; i++) await fast.messages.create({});
  await assert.rejects(fast.messages.create({}), /request limit/);
  time += 60_000;
  await fast.messages.create({});
});

test('all provider calls disable hidden retries and use bounded timeouts', async () => {
  const app = loadServer();
  assert.equal((await app.request('/api/suggest-framework', 'POST', frameworkBody)).status, 200);
  assert.equal(app.providerOptions[0].maxRetries, 0);
  assert.equal(app.providerOptions[0].timeout, 30_000);
});

test('deadline cancels stalled calls without freeing their slots before transport settlement', async () => {
  const pending = [];
  const guard = createPilotGuard({ pilot: true, env, timeoutMs: 20 });
  const client = guard.wrapClient({ messages: { create: (request, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal })) } });
  await Promise.all(Array.from({ length: 4 }, () => assert.rejects(client.messages.create({}), /timed out/)));
  assert.ok(pending.every(call => call.signal.aborted));
  await assert.rejects(client.messages.create({}), /busy/);
  pending.forEach(call => call.resolve({ content: [] }));
  await new Promise(resolve => setImmediate(resolve));
  await guard.wrapClient({ messages: { create: async () => ({ content: [] }) } }).messages.create({});
});

test('suggestion fallbacks run sequentially, retain their results and stop on budget denial', async () => {
  for (const exhausted of [false, true]) {
    let searches = 0, active = 0, peak = 0;
    const app = loadServer({ provider: async request => {
      if (request.tools[0].name !== 'web_search') return { content: [{ type: 'tool_use', input: {
        questions: Array.from({ length: 3 }, () => ({ methods: [], needsSearch: true })) } }] };
      searches++; active++; peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      if (exhausted) throw Object.assign(new Error('Your credit balance is too low'), { status: 400 });
      return { content: [{ type: 'web_search_tool_result' }, { type: 'tool_use', name: 'submit_gap_method', input: {
        name: 'Synthetic method', description: 'Synthetic reason', source: 'https://example.invalid' } }] };
    } });
    const result = await app.request('/api/suggest-methods', 'POST', JSON.stringify({ objective: 'Synthetic', researchQuestions: ['One?', 'Two?', 'Three?'] }));
    assert.equal(result.status, exhausted ? 503 : 200, result.body);
    assert.equal(searches, exhausted ? 1 : 3);
    assert.equal(peak, 1);
    assert.ok(app.providerOptions.every(options => options.maxRetries === 0));
    if (!exhausted) assert.equal(JSON.parse(result.body).perQuestion.length, 3);
  }
});

test('credit and spending denials stop evaluation retries and stay generic across all AI routes', async () => {
  for (const message of ['Your credit balance is too low', 'You have reached your specified workspace API usage limits', 'enforced_spend_limit_reached']) {
    for (const [url, body] of paidRoutes) {
      const app = loadServer({ provider: async () => { throw Object.assign(new Error(message + ' SECRET PLAN TEXT'), { status: 400 }); } });
      const result = await app.request(url, 'POST', body);
      assert.equal(result.status, 503, result.body);
      assert.match(result.body, /budget or credits/);
      assert.doesNotMatch(result.body + JSON.stringify(app.logs), /SECRET PLAN TEXT/);
      assert.equal(app.providerCalls.length, 1, 'no retry after spending denial');
    }
  }
});

test('methods reject oversized fan-out before any provider call', async () => {
  const app = loadServer();
  const result = await app.request('/api/suggest-methods', 'POST', JSON.stringify({ objective: 'Synthetic', researchQuestions: Array(21).fill('Question?') }));
  assert.equal(result.status, 413);
  assert.equal(app.providerCalls.length, 0);
});

test('disconnecting real HTTP requests cancels every AI path and prevents later fallback calls', async t => {
  for (const [url, originalBody] of paidRoutes) {
    let started, providerSignal;
    const ready = new Promise(resolve => { started = resolve; });
    const app = loadServer({ provider: async (request, options) => {
      if (url === '/api/suggest-methods' && request.tools[0].name !== 'web_search') {
        return { content: [{ type: 'tool_use', input: { questions: [
          { methods: [], needsSearch: true }, { methods: [], needsSearch: true },
        ] } }] };
      }
      providerSignal = options.signal;
      started();
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    } });
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    t.after(() => { app.server.closeAllConnections(); app.server.close(); });
    const req = http.request('http://127.0.0.1:' + app.server.address().port + url, {
      method: 'POST', headers: { authorization: AUTHORIZATION },
    });
    req.on('error', () => {}); // The client deliberately closes before a response.
    req.end(url === '/api/suggest-methods'
      ? JSON.stringify({ objective: 'Synthetic', researchQuestions: ['One?', 'Two?'] }) : originalBody);
    await ready;
    req.destroy();
    await waitFor(() => providerSignal.aborted);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.providerCalls.length, url === '/api/suggest-methods' ? 2 : 1, url);
  }
});

test('real HTTP accepts credentials and handles chunked oversized requests', async t => {
  const app = loadServer();
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => { app.server.closeAllConnections(); app.server.close(); });
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  assert.equal((await fetch(origin)).status, 401);
  assert.equal((await fetch(origin, { headers: { authorization: AUTHORIZATION } })).status, 200);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(origin + '/api/evaluate', { method: 'POST', headers: { authorization: AUTHORIZATION, 'Transfer-Encoding': 'chunked' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write('x'.repeat(40_000)); req.end('x'.repeat(40_000));
  });
  assert.equal(status, 413);
  assert.equal(app.providerCalls.length, 0);
});

for (const status of [401, 429, 503]) test(`HTTP ${status} during evaluation preserves writing, local draft and backup controls`, async t => {
  const app = await bootApp();
  t.after(() => app.close());
  const input = app.document.querySelector('[data-field="background"]');
  setValue(app.window, input, 'Synthetic writing that must survive an access or budget error.');
  await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY)?.includes('must survive'));
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  const fetch = app.window.fetch;
  app.window.fetch = (url, init) => url === '/api/evaluate'
    ? Promise.resolve({ ok: false, status, json: async () => ({ error: 'Pilot AI unavailable. Your writing is safe.' }) }) : fetch(url, init);
  input.closest('.field').querySelector('.eval-btn').click();
  await waitFor(() => input.closest('.field').textContent.includes('Pilot AI unavailable'));
  assert.equal(input.value, 'Synthetic writing that must survive an access or budget error.');
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  assert.equal(app.document.querySelector('#download-backup-btn').disabled, false);
  assert.deepEqual(app.jsdomErrors, []);
});
