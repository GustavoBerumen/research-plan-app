'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadServer, ASSETS, PRIVATE, ROOT } = require('./rpa-89-server-harness.cjs');
const { bootApp, waitFor, setValue, DRAFT_KEY } = require('./app-harness');
const { realisticBackup } = require('./rpa-40-fixtures.cjs');
const disabled = { calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false };
const pilotConfig = { pilotMode: true, capabilities: disabled };
const response = data => ({ ok: true, json: async () => data });

for (const pilot of ['true', 'false']) {
  test(`static allowlist and synthetic private files, pilot=${pilot}`, async () => {
    const app = loadServer({ pilot });
    for (const asset of ['/', ...ASSETS.map(name => '/' + name)]) {
      const result = await app.request(asset);
      assert.equal(result.status, 200, asset);
      assert.ok(result.body.length > 0);
      assert.equal(result.headers['Cache-Control'], 'no-store');
    }
    assert.equal((await app.request('/app.js?v=synthetic')).status, 200);
    const before = app.reads.length;
    for (const name of [...PRIVATE, 'research-theoretical-frameworks.md', 'uploads/', '.git/', 'test/app-harness.js', 'constructor', '__proto__']) {
      const result = await app.request('/' + name);
      assert.equal(result.status, 404, name);
      assert.doesNotMatch(result.body, /SYNTHETIC PRIVATE|Users|ENOENT/);
    }
    assert.equal(app.reads.length, before, 'denied paths must not even reach readFile');
    assert.deepEqual(app.writes, [], 'startup creates no directories');
  });
}

test('raw malformed, encoded, double-encoded and Windows traversal variants reject without reads', async () => {
  const app = loadServer();
  const invalid = ['/%', '/%GG', '/%C0%AF', '/%E0%A4%A', '/%00', '/%2eenv', '/%252eenv',
    '/%61pp.js', '/%2561pp.js', '/%2e%2e/app.js', '/%252e%252e/app.js', '/../app.js', '/./app.js',
    '/uploads/../app.js', '/uploads\\..\\app.js', '/..%5capp.js', '/%255c.env', '/\\app.js',
    '//app.js', 'http://localhost/app.js', '*', '', '/app.js#ignored', '/app.js?bad=%', '/app.js\u0000',
    '/api/%63alibration', '/api%2fupload', '/api%255cadd-framework'];
  for (const url of invalid) assert.equal((await app.request(url)).status, 400, JSON.stringify(url));
  for (const url of ['/C:/Windows/win.ini', '/app.js:secret', '/app.js.', '/api/jira/search-more']) {
    assert.equal((await app.request(url)).status, 404, url);
  }
  assert.deepEqual(app.reads, []);
  assert.deepEqual(app.writes, []);
});

test('unsupported methods and exact API matching', async () => {
  const app = loadServer();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']) {
    const result = await app.request('/index.html', method);
    assert.equal(result.status, 405, method);
    assert.equal(result.headers.Allow, 'GET');
  }
  for (const url of ['/api/evaluate', '/api/suggest-methods', '/api/suggest-framework']) {
    assert.equal((await app.request(url)).status, 405);
  }
  assert.equal((await app.request('/api/config', 'POST', '{')).status, 405);
  assert.deepEqual(app.reads, []);
  assert.deepEqual(app.writes, []);
});

test('pilot denies writes/proxy before body listeners with spoofed client state and invalid bodies', async () => {
  const app = loadServer();
  const config = await app.request('/api/config');
  const data = JSON.parse(config.body);
  // The pilot contract is the capability set and the jira flag — nothing
  // enabled may leak through. /api/config also carries a version and build
  // marker for the footer (RPA-92), which is informational and not part of
  // that contract, so it is checked for shape rather than pinned by value.
  const { version, build, ...contract } = data;
  assert.deepEqual(contract, { ...pilotConfig, jiraEnabled: false });
  assert.equal(typeof version, 'string');
  assert.equal(typeof build, 'string');
  assert.equal(config.headers['Cache-Control'], 'no-store');
  for (const url of ['/api/calibration', '/api/upload', '/api/add-framework', '/api/jira/search']) {
    for (const suffix of ['', '?pilotMode=false&uploads=true', '/']) {
      for (const method of ['POST', 'GET', 'PUT', 'HEAD', 'OPTIONS']) {
        const result = await app.request(url + suffix, method, '{"capabilities":{"uploads":true},"pilotMode":false,' + 'x'.repeat(10000));
        assert.notEqual(result.status, 200);
        if (suffix !== '/') assert.equal(result.status, 403);
        assert.deepEqual(result.listeners, [], 'no body parsing: ' + url);
      }
    }
  }
  assert.deepEqual(app.reads, []);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.proxyCalls, []);
  assert.deepEqual(app.providerCalls, []);
  assert.equal(app.files.get(path.join(ROOT, 'uploads/private.pdf')).toString(), 'SYNTHETIC PRIVATE DATA');
});

test('explicit nonpilot mode retains writes; malformed flag prevents startup', async () => {
  for (const pilot of ['TRUE', '', '1', 'yes', ' true ']) assert.throws(() => loadServer({ pilot }), /must be true or false/);
  for (const pilot of ['false', null]) {
    const app = loadServer({ pilot });
    const config = JSON.parse((await app.request('/api/config')).body);
    assert.equal(config.pilotMode, false);
    assert.equal(config.capabilities.uploads, true);
    assert.equal(config.capabilities.googleDrive, true);
    assert.equal(config.capabilities.jira, true);
    assert.equal((await app.request('/api/upload', 'POST', JSON.stringify({ filename: 'synthetic.txt', dataBase64: 'eA==' }))).status, 200);
    assert.deepEqual(app.writes.map(w => w.name), ['mkdir', 'writeFile']);
    assert.equal((await app.request('/api/calibration', 'POST', JSON.stringify({ field: 'Synthetic field', text: 'Synthetic plan' }))).status, 200);
    assert.equal((await app.request('/api/add-framework', 'POST', JSON.stringify({ category: '## 1. Synthetic frameworks', name: 'New synthetic framework', coreFocus: 'Focus', uxrApplication: 'Use', references: ['Synthetic ref'] }))).status, 200);
    assert.deepEqual(app.writes.map(w => w.name), ['mkdir', 'writeFile', 'appendFile', 'writeFile']);
  }
});

test('framework library stays server-side and suggestions still use it; filesystem failures are generic', async () => {
  const app = loadServer();
  const result = await app.request('/api/suggest-framework', 'POST', JSON.stringify({ fields: { background: 'Synthetic plan' } }));
  assert.equal(result.status, 200, result.body);
  assert.equal(JSON.parse(result.body).name, 'Synthetic framework');
  assert.equal(app.providerCalls.length, 1);
  assert.match(app.providerCalls[0].messages[0].content, /Synthetic focus/);
  assert.deepEqual(app.writes, []);
  const missing = loadServer({ files: { 'research-theoretical-frameworks.md': null, 'app.js': null } });
  const failure = await missing.request('/api/suggest-framework', 'POST', JSON.stringify({ fields: { background: 'Synthetic plan' } }));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(failure.body, /ENOENT|Users|synthetic private path/);
  assert.equal((await missing.request('/app.js')).body, 'Not found');
});

test('pilot keeps the actual evaluation route and retry formatter operational with a mocked provider', async () => {
  const app = loadServer({ provider: async request => ({ content: [{ type: 'tool_use', name: request.tools[0].name,
    input: { metrics: [{ name: 'Clarity', score: 2, desc: 'Synthetic result.' }], recommendations: [{ criterionName: 'Clarity', text: 'Clarify synthetic participants.' }] } }] }) });
  const result = await app.request('/api/evaluate', 'POST', JSON.stringify({ field: 'Background', fieldKey: 'background', text: 'Synthetic plan', rubric: [{ name: 'Clarity', desc: 'Names participants.' }] }));
  assert.equal(result.status, 200, result.body);
  assert.deepEqual(JSON.parse(result.body).recommendations, ['Clarity: Clarify synthetic participants.']);
  assert.equal(app.providerCalls.length, 1);
  assert.deepEqual(app.writes, []);
});

test('allowed assets boot the complete form through real HTTP routing', async t => {
  const app = loadServer();
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => { app.server.closeAllConnections(); app.server.close(); });
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const errors = [], requests = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(await (await fetch(origin)).text(), { url: origin, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      window.fetch = (url, init) => { requests.push(url); return fetch(new URL(url, origin), init); };
      window.HTMLElement.prototype.scrollIntoView = () => {};
    } });
  t.after(() => dom.window.close());
  // Fetch every script via the real allowlist; no direct source loading here.
  for (const script of dom.window.document.querySelectorAll('script[src]')) {
    const source = await fetch(new URL(script.getAttribute('src'), origin));
    assert.equal(source.status, 200);
    dom.window.eval(await source.text());
  }
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await waitFor(() => dom.window.document.querySelector('.title-inp'));
  const reference = await bootApp({ configResponse: async () => response(pilotConfig) });
  t.after(() => reference.close());
  const fields = doc => [...doc.querySelectorAll('[data-field]')].map(e => e.dataset.field);
  assert.deepEqual(fields(dom.window.document), fields(reference.document));
  assert.equal(dom.window.document.querySelectorAll('.acc').length, reference.document.querySelectorAll('.acc').length);
  assert.equal(dom.window.document.querySelector('#download-backup-btn').disabled, false);
  for (const asset of ['research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']) assert.ok(requests.includes(asset));
  assert.deepEqual(errors, []);
  assert.deepEqual(app.writes, []);
});

for (const [name, configResponse] of [
  ['pilot', async () => response(pilotConfig)],
  ['missing', async () => response({ jiraEnabled: true })],
  ['null', async () => response(null)],
  ['malformed booleans', async () => response({ pilotMode: false, capabilities: { ...disabled, uploads: 'true' } })],
  ['contradictory pilot', async () => response({ pilotMode: true, capabilities: { ...disabled, calibration: true } })],
  ['HTTP failure', async () => ({ ok: false, json: async () => ({ ...pilotConfig, pilotMode: false }) })],
  ['bad JSON', async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })],
  ['network failure', async () => { throw new Error('offline'); }],
  ['pending configuration', () => new Promise(() => {})],
]) test(`${name}: restricted actions cannot be enabled by DOM/client state; results and references survive`, async t => {
  const draft = realisticBackup();
  const app = await bootApp({ draft, configResponse,
    evaluate: async () => ({ label: 'Actionable', tone: 'good', metrics: [{ name: 'Clarity', score: 3, desc: 'Synthetic result' }], recommendations: ['Synthetic recommendation.'] }),
    suggestFramework: async () => ({ matched: false, draft: { name: 'Synthetic draft', category: 'Synthetic category', coreFocus: 'Synthetic focus', uxrApplication: 'Synthetic use', references: ['Synthetic ref'], rationale: 'Synthetic reason' } }),
  });
  t.after(() => app.close());
  const calls = [];
  const originalFetch = app.window.fetch;
  app.window.fetch = (url, init) => { calls.push(url); return originalFetch(url, init); };
  for (const button of app.document.querySelectorAll('.file-add-btn,.eval-fb-btn,.file-menu-item')) {
    assert.equal(button.hidden, true);
    assert.equal(button.disabled, true);
  }
  assert.equal(app.document.querySelector('[data-field="jiraProject"]').getAttribute('role'), null);
  assert.equal(app.document.querySelector('script[src*="accounts.google"]'), null);
  const field = app.document.querySelector('[data-field="background"]').closest('.field');
  field.querySelector('.eval-btn').click();
  await waitFor(() => !field.querySelector('.eval-result-btn').hidden);
  field.querySelector('.eval-result-btn').click();
  assert.match(field.querySelector('.eval-panel').textContent, /Synthetic result/);
  assert.match(field.querySelector('.eval-recs').textContent, /Synthetic recommendation/);
  const theory = app.document.querySelector('[data-field="theory"]').closest('.field');
  [...theory.querySelectorAll('button')].find(b => b.textContent.includes('Suggest a framework')).click();
  await waitFor(() => theory.querySelector('.fw-add-btn'));
  for (const button of app.document.querySelectorAll('.file-add-btn,.eval-fb-btn,.file-menu-item,.fw-add-btn')) {
    assert.equal(button.hidden, true);
    assert.equal(button.disabled, true);
    button.hidden = false;
    button.disabled = false;
    button.click();
  }
  const fileInput = app.document.querySelector('.file-native');
  Object.defineProperty(fileInput, 'files', { value: [new app.window.File(['synthetic'], 'test.txt')] });
  fileInput.disabled = false;
  fileInput.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  setValue(app.window, app.document.querySelector('[data-field="jiraProject"]'), 'RPA-89 synthetic');
  await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY).includes('RPA-89 synthetic'));
  assert.ok(calls.every(url => !/calibration|\/upload|add-framework|jira\/search|google/.test(url)));
  const saved = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
  assert.deepEqual(saved.tables['previousKnowledge-table'][0][1], draft.tables['previousKnowledge-table'][0][1]);
  assert.deepEqual(saved.tables['requirements-table'], draft.tables['requirements-table']);
  assert.deepEqual(saved.lists.researchQuestions, draft.lists.researchQuestions);
  assert.deepEqual(saved.methods, draft.methods);
  assert.equal(saved.createdAt, draft.createdAt);
  assert.equal(saved.fields.project, draft.fields.project);
  assert.equal(saved.evaluations, undefined);
  assert.deepEqual(app.jsdomErrors, []);
});
