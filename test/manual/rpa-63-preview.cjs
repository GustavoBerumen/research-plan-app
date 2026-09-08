'use strict';
// Allowlisted offline preview. Never reads .env, starts the backend or saves calibration data.
// $env:PORT='8953'; node test/manual/rpa-63-preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { evaluationFixture } = require('../rpa-63-fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = 'd2ea2037fd9343e3745249eb964d605270aaf989';
const assets = new Set(['index.html', 'style.css', 'app.js', 'score-classification.js', 'textarea-autosize.js',
  'test-profiles.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md', 'research-theoretical-frameworks.md']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };
const baselineAssets = new Map(['app.js', 'style.css'].map(name => [name, execFileSync('git', ['show', baseline + ':' + name], { cwd: root, encoding: 'utf8' })]));
const client = fs.readFileSync(path.join(__dirname, 'rpa-63-preview-client.js'), 'utf8');
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
  const isBaseline = url.pathname.startsWith('/baseline/');
  const relative = isBaseline ? url.pathname.slice('/baseline/'.length) : url.pathname.slice(1);
  const asset = relative || 'index.html';
  if (req.method !== 'GET' || !assets.has(asset)) { res.writeHead(404); return res.end('Not available in offline preview'); }
  let content = isBaseline && baselineAssets.has(asset) ? baselineAssets.get(asset) : fs.readFileSync(path.join(root, asset), 'utf8');
  if (asset === 'index.html') {
    content = content.replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g, '').replace(/<link[^>]+href="https:[^"]+"[^>]*>/g, '');
    content = content.replace('<body>', '<body><aside class="toolbar" id="fixture-toolbar" style="position:static">Offline RPA-63 preview · ' + (isBaseline ? 'Before' : 'After') +
      ' · <a href="/?scenario=guardrail">Guardrail / long content</a> · <a href="/?scenario=ready">Ready / no recommendations</a> · <a href="/?scenario=developing">Developing</a> · <a href="/baseline/?scenario=guardrail">Before</a>' +
      '<div>Next request: <select id="fixture-mode"><option value="guardrail">Normal</option><option value="ready">Ready</option><option value="pending">Slow (15 seconds)</option><option value="failure">Evaluation failure</option><option value="save-failure">Save failure</option></select> · Edit a field to check staleness. Reload to reset sample content. Feedback is simulated.</div></aside>');
    content = content.replace('<script src="test-profiles.js">', '<script>' + client + '</script><script src="test-profiles.js">');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(asset)] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(content);
}).listen(Number(process.env.PORT || 8953), '127.0.0.1', () => console.log('Offline RPA-63 preview: http://127.0.0.1:' + (process.env.PORT || 8953) + '/?scenario=guardrail'));
