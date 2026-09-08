'use strict';
// Allowlisted local preview. No backend, .env, provider calls or calibration writes.
// $env:PORT='8954'; node test/manual/rpa-78-preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { evaluationFixture } = require('../rpa-63-fixtures.cjs');
const { draft } = require('../fixtures/rpa-78-pre-change.json');
const root = path.resolve(__dirname, '../..');
const assets = new Set(['index.html', 'style.css', 'app.js', 'score-classification.js', 'textarea-autosize.js',
  'test-profiles.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md', 'research-theoretical-frameworks.md']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };
const client = fs.readFileSync(path.join(__dirname, 'rpa-63-preview-client.js'), 'utf8');
const port = Number(process.env.PORT || 8954);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/api/config') return json({ jiraEnabled: false, googleClientId: '', googleApiKey: '' });
  if (req.method === 'POST' && ['/api/evaluate', '/api/calibration'].includes(url.pathname)) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 100000) return json({ error: 'Preview request too large' }, 413); }
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const scenario = url.searchParams.get('scenario') || 'guardrail';
    await new Promise(resolve => setTimeout(resolve, scenario === 'pending' ? 15000 : 450));
    if (scenario === 'failure' || scenario === 'save-failure') return json({ error: 'Deterministic preview failure.' }, 503);
    return json(url.pathname === '/api/calibration' ? { ok: true, mock: true } : evaluationFixture(body, scenario));
  }
  const asset = url.pathname.slice(1) || 'index.html';
  if (req.method !== 'GET' || !assets.has(asset)) { res.writeHead(404); return res.end('Not available in offline preview'); }
  let content = fs.readFileSync(path.join(root, asset), 'utf8');
  if (asset === 'index.html') {
    content = content.replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g, '').replace(/<link[^>]+href="https:[^"]+"[^>]*>/g, '');
    content = content.replace('<body>', '<body><aside class="toolbar" id="fixture-toolbar" style="position:static">Offline RPA-78 preview · ' +
      '<a href="/?scenario=guardrail">Guardrail / long feedback</a> · <a href="/?scenario=ready">Ready / no recommendations</a> · <a href="/?scenario=restore">Restore pre-change draft</a>' +
      '<div>Next request: <select id="fixture-mode"><option value="guardrail">Normal</option><option value="ready">Ready</option><option value="pending">Slow (15 seconds)</option><option value="failure">Evaluation failure</option><option value="save-failure">Save failure</option></select> · Reload resets this preview origin to sample content. Feedback is simulated.</div></aside>');
    const setup = url.searchParams.get('scenario') === 'restore'
      ? 'localStorage.setItem("research-plan-app:draft", ' + JSON.stringify(JSON.stringify(draft)) + ');'
      : client;
    content = content.replace('<script src="test-profiles.js">', '<script>' + setup + '</script><script src="test-profiles.js">');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(asset)] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(content);
}).listen(port, '127.0.0.1', () => console.log('Offline RPA-78 preview: http://127.0.0.1:' + port + '/?scenario=guardrail'));
