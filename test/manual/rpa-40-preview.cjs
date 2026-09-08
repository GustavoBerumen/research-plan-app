'use strict';
// Local, allowlisted preview: no .env, production backend or provider calls.
// $env:PORT='8955'; node test/manual/rpa-40-preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { realisticBackup, smallBackup } = require('../rpa-40-fixtures.cjs');
const { evaluationFixture } = require('../rpa-63-fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const assets = new Set(['index.html', 'style.css', 'app.js', 'score-classification.js', 'textarea-autosize.js',
  'test-profiles.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md', 'research-theoretical-frameworks.md']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };
const port = Number(process.env.PORT || 8955);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/config') return json({ jiraEnabled: false, googleClientId: '', googleApiKey: '' });
  if (url.pathname === '/fixtures/realistic.json') return json(realisticBackup());
  if (url.pathname === '/fixtures/small.json') return json(smallBackup());
  if (url.pathname === '/api/evaluate' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 100000) return json({ error: 'Too large' }, 413); }
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    await new Promise(resolve => setTimeout(resolve, 1500));
    return json(evaluationFixture(body, 'ready'));
  }
  const asset = url.pathname.slice(1) || 'index.html';
  if (req.method !== 'GET' || !assets.has(asset)) { res.writeHead(404); return res.end('Not available in offline preview'); }
  let content = fs.readFileSync(path.join(root, asset), 'utf8');
  if (asset === 'index.html') {
    content = content.replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g, '').replace(/<link[^>]+href="https:[^"]+"[^>]*>/g, '');
    content = content.replace('<body>', '<body><aside style="padding:8px 24px;background:#fff3cd" class="backup-help">Offline RPA-40 preview · evaluation responses are simulated. Reload preserves your browser draft. Sample files: <a href="/fixtures/realistic.json" download="realistic-plan.json">realistic plan</a> · <a href="/fixtures/small.json" download="small-plan.json">smaller plan</a>.</aside>');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(asset)] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(content);
}).listen(port, '127.0.0.1', () => console.log('Offline RPA-40 preview: http://127.0.0.1:' + port + '/'));
