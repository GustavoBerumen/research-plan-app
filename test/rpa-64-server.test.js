'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const { createSubmissions, readBody } = require('../submissions-server');
const { createR2Store } = require('../r2-submission-store');
const f = require('./rpa-64-fixtures.cjs');
const { removeSubmission } = require('../submission-operations');
const config = { ...f.config, prefix: f.prefix };
const post = (server, body = f.request(), headers = {}) => server.request('/api/submissions', 'POST', typeof body === 'string' ? body : JSON.stringify(body), { 'content-type': 'application/json', ...headers });
const fixture = (options = {}) => { const store = f.memoryStore(); const server = loadServer({ env: f.env, submissionStore: store, ...options }); return { store, server }; };

test('default off, authentication, cross-site, methods and JSON gates precede parsing and storage', async () => {
  const off = loadServer(); const denied = await post(off);
  assert.equal(denied.status, 403); assert.deepEqual(denied.listeners, []);
  const { server, store } = fixture();
  for (const headers of [{ authorization: '' }, { origin: 'https://attacker.invalid' }]) {
    const response = await post(server, 'not json', headers);
    assert.ok([401, 403].includes(response.status)); assert.deepEqual(response.listeners, []);
  }
  assert.equal((await server.request('/api/submissions', 'GET')).status, 405);
  assert.equal((await post(server, '{}', { 'content-type': 'text/plain' })).status, 415);
  assert.equal(store.calls.length, 0); assert.equal(server.providerCalls.length, 0);
  assert.throws(() => createSubmissions({ env: f.env, pilot: false }), /protected pilot/);
  assert.throws(() => createSubmissions({ env: { ...f.env, RPA_SUBMISSIONS_ACCESS: '' }, pilot: true }), /protected pilot/);
  assert.throws(() => createSubmissions({ env: { ...f.env, RPA_SUBMISSIONS_NOTICE: '' }, pilot: true }), /notice/);
});
test('invalid versions, structure, locators, byte limits and payloads never reach storage or AI', async () => {
  const cases = [ ['broken', 400], [{ ...f.request(), submissionId: [f.ID] }, 400], [{ ...f.request(), deleteAfter: '2099-01-01' }, 400],
    [{ ...f.request(), formSchemaVersion: 'forged' }, 409], [' '.repeat(1024 * 1024 + 1), 413] ];
  const incomplete = f.request(); incomplete.plan.studies[0].sampleSize = { v: '__other__', o: '' }; cases.push([incomplete, 422]);
  const nested = f.request(); nested.plan.fields.background = { payload: 'PRIVATE SENTINEL' }; cases.push([nested, 422]);
  for (const [body, status] of cases) {
    const { server, store } = fixture(); const response = await post(server, body);
    assert.equal(response.status, status); assert.equal(store.calls.length, 0); assert.equal(server.providerCalls.length, 0);
    assert.equal(response.body.includes('PRIVATE SENTINEL'), false);
    if (body === incomplete) assert.deepEqual(JSON.parse(response.body).errors.map(e => [e.key, e.study, e.code]), [['sampleSize', 0, 'other']]);
  }
});
test('invalid Other sample sizes are rejected before storage even when client validation is bypassed', async () => {
  for (const value of ['asdf', '-1', '1.5', '8-5']) {
    const { server, store } = fixture(); const body = f.request();
    body.plan.studies[0].sampleSize = { v: '__other__', o: value };
    const result = await post(server, body);
    assert.equal(result.status, 422, value);
    assert.deepEqual(JSON.parse(result.body).errors.map(e => [e.key, e.study, e.code]), [['sampleSize', 0, 'other']]);
    assert.equal(store.calls.length, 0); assert.equal(server.providerCalls.length, 0);
  }
});

test('streaming body bounds, timeout, abort and chunked parsing are bounded independently of pilot defaults', async () => {
  const req = new EventEmitter(); const promise = readBody(req, 100);
  req.emit('data', Buffer.from('{"x":')); req.emit('data', Buffer.from('1}')); req.emit('end');
  assert.deepEqual(await promise, { x: 1 }); assert.equal(req.listenerCount('data'), 0);
  const slow = new EventEmitter();
  await Promise.all([assert.rejects(readBody(slow, 5), e => e.status === 408), new Promise(resolve => setTimeout(resolve, 15))]);
  assert.equal(slow.listenerCount('data'), 0);
  const aborted = new EventEmitter(); const pending = readBody(aborted); aborted.emit('aborted');
  await assert.rejects(pending, e => e.code === 'interrupted_body');
});

test('undated or invalid sign-offs are rejected before storage when client checks are bypassed', async () => {
  for (const key of ['signOffResearcher', 'signOffProjectOwner']) {
    for (const value of ['AB', 'AB — 31/02/2026']) {
      const { server, store } = fixture(); const body = f.request(); body.plan.fields[key] = value;
      const result = await post(server, body);
      assert.equal(result.status, 422);
      assert.deepEqual(JSON.parse(result.body).errors.map(e => [e.key, e.code]), [[key, 'signoff_date']]);
      assert.equal(store.calls.length, 0); assert.equal(server.providerCalls.length, 0);
    }
  }
});
test('successful write/read-back, exact retry, key-order equivalence and conflict preserve one original record', async () => {
  const { store, server } = fixture();
  const first = await post(server); assert.equal(first.status, 201);
  const receipt = JSON.parse(first.body); assert.equal(receipt.status, 'stored'); assert.equal(receipt.submissionId, f.ID);
  const retry = await post(server, Object.fromEntries(Object.entries(f.request()).reverse()));
  assert.equal(retry.status, 200); assert.deepEqual(JSON.parse(retry.body), receipt);
  const changed = f.request(); changed.plan.fields.background += 'changed';
  assert.equal((await post(server, changed)).status, 409);
  assert.equal(store.calls.filter(c => c[0] === 'put').length, 1);
  assert.equal(store.objects.get(f.prefix + `submissions/${f.ID}.json`).value.plan.fields.background, f.plan().fields.background);
});
test('two server instances racing on one ID use conditional creation and agree on the receipt', async () => {
  const store = f.memoryStore();
  const a = loadServer({ env: f.env, submissionStore: store }), b = loadServer({ env: f.env, submissionStore: store });
  const results = await Promise.all([post(a), post(b)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]); assert.equal(results[0].body, results[1].body);
  assert.equal([...store.objects.keys()].filter(k => k.includes('/submissions/')).length, 1);
});
test('possible write failures and failed read-back return no receipt; same-ID retry reconciles', async () => {
  for (const phase of ['before', 'after', 'readback']) {
    const store = f.memoryStore(), put = store.put.bind(store), get = store.get.bind(store);
    let fail = true, written = false;
    store.put = async (...args) => { if (fail && phase === 'before') { fail = false; throw new Error('secret'); } const result = await put(...args); written = true; if (fail && phase === 'after') { fail = false; throw new Error('secret'); } return result; };
    store.get = async key => { if (fail && written && phase === 'readback' && key.includes('/submissions/')) { fail = false; throw new Error('secret'); } return get(key); };
    const server = loadServer({ env: f.env, submissionStore: store });
    const first = await post(server); assert.equal(first.status, 503); assert.equal(first.body.includes('secret'), false); assert.equal(JSON.parse(first.body).submittedAt, undefined);
    assert.ok([200, 201].includes((await post(server)).status));
    assert.equal([...store.objects.keys()].filter(k => k.includes('/submissions/')).length, 1);
  }
});
test('separate request and concurrent-ID limits do not release another request lock or touch AI', async () => {
  const { server, store } = fixture();
  for (let i = 0; i < 5; i++) await post(server, '{}');
  assert.equal((await post(server)).status, 429); assert.equal(store.calls.length, 0);
  const second = fixture(); const get = second.store.get.bind(second.store);
  let release; const gate = new Promise(resolve => { release = resolve; });
  let started; const startedPromise = new Promise(resolve => { started = resolve; });
  second.store.get = async key => { if (key.includes('/submissions/')) { started(); await gate; } return get(key); };
  const inFlight = post(second.server); await startedPromise;
  assert.equal((await post(second.server)).status, 429);
  assert.equal((await post(second.server)).status, 429, 'busy denial must not delete the first request lock');
  release(); assert.equal((await inFlight).status, 201); assert.equal(second.server.providerCalls.length, 0);
});
test('durable cohort metadata, deadlines and tombstones prevent acceptance or resurrection', async () => {
  for (const state of ['missing', 'closed', 'expired']) {
    const { server, store } = fixture(); const key = f.prefix + 'cohort.json';
    if (state === 'missing') store.objects.delete(key);
    else { const c = store.objects.get(key).value; c.collectionOpen = false; if (state === 'expired') { c.finalSessionAt = '2020-01-01T00:00:00.000Z'; c.deleteAfter = '2020-01-29T00:00:00.000Z'; } }
    assert.equal((await post(server)).status, state === 'missing' ? 503 : 403);
    assert.equal(store.calls.filter(c => c[0] === 'put').length, 0);
  }
  const { server, store } = fixture(); await post(server);
  await removeSubmission(store, config, f.ID);
  const retry = await post(server); assert.equal(retry.status, 410);
  const tombstone = store.objects.get(f.prefix + `submissions/${f.ID}.json`).value;
  assert.equal(tombstone.plan, undefined); assert.equal(tombstone.contentSha256, undefined);
});
test('private R2 adapter sends conditionals, paginates, bounds reads and distinguishes missing objects', async () => {
  const commands = [];
  const client = { async send(command, opts) {
    commands.push(command); assert.ok(opts.abortSignal);
    if (command.constructor.name === 'PutObjectCommand') {
      if (command.input.Key === 'conflict') throw { $metadata: { httpStatusCode: 412 } };
      return {};
    }
    if (command.constructor.name === 'GetObjectCommand') {
      if (command.input.Key === 'absent') throw { name: 'NoSuchKey' };
      if (command.input.Key === 'huge') return { Body: Readable.from([Buffer.alloc(2 * 1024 * 1024 + 1)]) };
      return { ETag: 'etag', Body: Readable.from([Buffer.from('{"ok":true}')]) };
    }
    return command.input.ContinuationToken ? { Contents: [{ Key: 'b' }], IsTruncated: false } : { Contents: [{ Key: 'a' }], IsTruncated: true, NextContinuationToken: 'next' };
  } };
  const store = createR2Store({ RPA_R2_ACCOUNT_ID: '0'.repeat(32), RPA_R2_BUCKET: 'synthetic-bucket', RPA_R2_ACCESS_KEY_ID: 'synthetic', RPA_R2_SECRET_ACCESS_KEY: 'synthetic' }, client);
  assert.equal(await store.put('new', {}, { absent: true }), true); assert.equal(commands.at(-1).input.IfNoneMatch, '*');
  await store.put('old', {}, { etag: 'old-etag' }); assert.equal(commands.at(-1).input.IfMatch, 'old-etag');
  assert.equal(await store.put('conflict', {}, { absent: true }), false);
  await assert.rejects(store.put('unsafe', {}), /conditional/);
  assert.equal(await store.get('absent'), null); assert.deepEqual((await store.get('good')).value, { ok: true });
  await assert.rejects(store.get('huge'), /too large/);
  const keys = []; for await (const key of store.keys('prefix/')) keys.push(key); assert.deepEqual(keys, ['a', 'b']);
});
test('a fresh independent Node process returns the original receipt from persisted synthetic storage', async t => {
  const { server, store } = fixture(); const first = await post(server);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rpa64-restart-')); t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const filename = path.join(temp, 'synthetic-store.json');
  await fs.writeFile(filename, JSON.stringify([...store.objects]));
  const child = spawnSync(process.execPath, [path.join(__dirname, 'rpa-64-restart.cjs'), filename], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout); assert.equal(result.status, 200); assert.deepEqual(JSON.parse(result.body), JSON.parse(first.body)); assert.equal(result.writes, 0);
});

test('large valid plans exceed the old pilot body limit, while aggregate complexity and response errors stay bounded', async () => {
  const big = f.request(); big.plan.fields.background = 'Synthetic prose. '.repeat(6000);
  const valid = fixture(); assert.equal((await post(valid.server, big)).status, 201, '1 MiB submission limit is independent of the 64 KiB pilot default');
  const complex = f.request();
  complex.plan.studies = Array.from({ length: 100 }, () => ({ ...f.plan().studies[0], methods: Array(400).fill('x') }));
  const rejected = fixture(); assert.equal((await post(rejected.server, complex)).status, 422); assert.equal(rejected.store.calls.length, 0);
  const incomplete = f.request(); incomplete.plan.lists.researchQuestions = Array(250).fill('Question'); incomplete.plan.lists.outcomes = Array(250).fill('');
  incomplete.plan.studies = Array.from({ length: 250 }, (_, i) => ({ questions: [i + 1], methods: [''], characteristics: [''], userGroups: [''], sampleSize: { v: '', o: '' } }));
  const invalid = fixture(); const result = JSON.parse((await post(invalid.server, incomplete)).body);
  assert.equal(result.errors.length, 200); assert.equal(result.moreErrors, true); assert.equal(invalid.store.calls.length, 0);
});

test('private response-body stalls have an independent storage deadline', async () => {
  const store = createR2Store({ RPA_R2_ACCOUNT_ID: '0'.repeat(32), RPA_R2_BUCKET: 'synthetic-bucket', RPA_R2_ACCESS_KEY_ID: 'synthetic', RPA_R2_SECRET_ACCESS_KEY: 'synthetic' },
    { send: async () => ({ Body: new Readable({ read() {} }), ETag: 'synthetic' }) }, { timeoutMs: 20 });
  await assert.rejects(store.get('stalled'), /timed out/);
});
