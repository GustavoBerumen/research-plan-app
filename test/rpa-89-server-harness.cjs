'use strict';

// Execute the real server with an isolated environment, virtual private files,
// write spies and a mocked provider. Only named public source assets are read.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const ROOT = path.resolve(__dirname, '..');
const ASSETS = ['index.html', 'style.css', 'app.js', 'score-classification.js',
  'textarea-autosize.js', 'test-profiles.js', 'research-plan-template.md',
  'research-plan-rubric.md', 'research-methods.md'];
const PRIVATE = ['.env', '.git/HEAD', 'calibration-data.jsonl', 'uploads/private.pdf',
  'private.md', 'submissions/plan.json', 'server.js', 'package.json', 'README.md'];
const FRAMEWORK = '## 1. Synthetic frameworks\n### Synthetic framework\n* **Core Focus:** Synthetic focus.\n* **UXR Application:** Synthetic use.\n* **Key References:**\n  * Synthetic reference (2026).\n';

function loadServer(options = {}) {
  const files = new Map(ASSETS.map(name => [path.join(ROOT, name), fs.readFileSync(path.join(ROOT, name))]));
  PRIVATE.forEach(name => files.set(path.join(ROOT, name), Buffer.from('SYNTHETIC PRIVATE DATA')));
  files.set(path.join(ROOT, 'research-theoretical-frameworks.md'), Buffer.from(FRAMEWORK));
  const reads = [], writes = [], providerCalls = [], proxyCalls = [];
  for (const [name, value] of Object.entries(options.files || {})) {
    if (value === null) files.delete(path.join(ROOT, name));
    else files.set(path.join(ROOT, name), Buffer.from(value));
  }
  const read = (filename, encoding) => {
    reads.push(filename);
    if (!files.has(filename)) throw new Error('ENOENT synthetic private path ' + filename);
    const data = files.get(filename);
    return encoding ? data.toString(encoding) : data;
  };
  const write = name => async (...args) => { writes.push({ name, args }); };
  const fakeFs = {
    readFile(filename, callback) { try { callback(null, read(filename)); } catch (err) { callback(err); } },
    mkdirSync(...args) { writes.push({ name: 'mkdirSync', args }); },
    promises: { readFile: async (filename, encoding) => read(filename, encoding),
      writeFile: write('writeFile'), appendFile: write('appendFile'), mkdir: write('mkdir') },
  };
  let handler, server;
  class MockAnthropic {
    constructor() { this.messages = { create: async request => {
      providerCalls.push(request);
      if (options.provider) return options.provider(request);
      return { content: [{ type: 'tool_use', input: { matched: true, name: 'Synthetic framework', rationale: 'Synthetic suggestion.' } }] };
    } }; }
  }
  // The production retry classifier checks these SDK error classes.
  for (const name of ['APIUserAbortError', 'APIConnectionTimeoutError', 'APIConnectionError']) {
    MockAnthropic[name] = class extends Error {};
  }
  const env = { ANTHROPIC_API_KEY: 'synthetic-unused-key', RPA_PILOT_MODE: options.pilot ?? 'true',
    JIRA_BASE_URL: 'https://jira.invalid', JIRA_EMAIL: 'synthetic@example.invalid', JIRA_API_TOKEN: 'synthetic-token',
    GOOGLE_CLIENT_ID: 'synthetic-client', GOOGLE_API_KEY: 'synthetic-google-key' };
  if (options.pilot === null) delete env.RPA_PILOT_MODE;
  const sandbox = {
    require(name) {
      if (name === 'fs') return fakeFs;
      if (name === 'http') return { createServer(callback) { handler = callback; server = http.createServer(callback); return server; } };
      if (name === '@anthropic-ai/sdk') return MockAnthropic;
      return require(name);
    },
    module: { exports: {} }, __dirname: ROOT, process: { env, exit() { throw new Error('Unexpected exit'); } },
    console: { log() {}, info() {}, error() {} }, Buffer, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { proxyCalls.push(args); throw new Error('Proxy calls are mocked'); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), sandbox, { filename: 'server.js' });
  function request(url, method = 'GET', body = '') {
    return new Promise((resolve, reject) => {
      const req = new EventEmitter();
      Object.assign(req, { url, method, headers: {}, socket: {}, complete: true, destroy: reject });
      const listeners = [];
      const on = req.on;
      req.on = function (name, callback) { listeners.push(name); return on.call(this, name, callback); };
      const res = new EventEmitter();
      Object.assign(res, { writeHead(status, headers) { this.status = status; this.headers = headers || {}; },
        end(data) { resolve({ status: this.status, headers: this.headers, body: Buffer.isBuffer(data) ? data.toString() : data || '', listeners }); } });
      try {
        handler(req, res);
        if (req.listenerCount('data')) req.emit('data', Buffer.from(body));
        req.emit('end');
      } catch (err) { reject(err); }
    });
  }
  return { server, request, reads, writes, providerCalls, proxyCalls, files };
}

module.exports = { loadServer, ASSETS, PRIVATE, ROOT };
