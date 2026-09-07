'use strict';
// Offline UI preview: allowlisted assets only; never loads .env or the backend.
// Run from the repository: node test/manual/rpa-34-preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const assets = new Set(['index.html', 'style.css', 'app.js', 'score-classification.js',
  'textarea-autosize.js', 'test-profiles.js', 'research-plan-template.md',
  'research-plan-rubric.md', 'research-methods.md', 'research-theoretical-frameworks.md']);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (body, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/api/config') return json({ googleClientId: '', googleApiKey: '', jiraEnabled: false });
  if (url.pathname === '/api/evaluate' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100000) return json({ error: 'Preview request too large' }, 413);
    }
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    await new Promise(resolve => setTimeout(resolve, 800));
    if (JSON.stringify(body).includes('[fail]')) return json({ error: 'Simulated request failure. Remove [fail] and retry.' }, 503);
    const criteria = body.rubric || [];
    const metrics = body.entries
      ? body.entries.flatMap(entry => criteria.map((criterion, i) => ({
        name: (body.fieldKey === 'outcomes' ? 'Outcome ' : 'Research Question ') + entry.number + ' — ' + criterion.name,
        score: i === 1 && entry.number === 1 ? 1 : 3,
        desc: 'Mock explanation: ' + criterion.desc,
        scope: 'entry-quality', entryNumber: entry.number,
      })))
      : criteria.map((criterion, i) => ({ name: criterion.name, score: i === 0 ? 2 : 3, desc: 'Mock explanation: ' + criterion.desc }));
    return json({ metrics, recommendations: ['Mock recommendation: clarify the lower-scoring criterion with concrete detail.'] });
  }
  if (url.pathname === '/api/calibration') return json({ ok: true, mock: true });
  const asset = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!assets.has(asset)) { res.writeHead(404); return res.end('Not available in offline preview'); }
  let content = fs.readFileSync(path.join(root, asset), 'utf8');
  if (asset === 'index.html') {
    content = content.replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g, '');
    content = content.replace('<body>', '<body><div class="toolbar" style="padding:12px;background:#fff2cc;color:#111">MOCK FEEDBACK — local UI preview. No AI requests or saved feedback. Add [fail] to a field to simulate a request failure.</div>');
  }
  res.writeHead(200, { 'Content-Type': (types[path.extname(asset)] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(content);
}).listen(8935, '127.0.0.1', () => console.log('MOCK feedback preview: http://127.0.0.1:8935/?test'));
