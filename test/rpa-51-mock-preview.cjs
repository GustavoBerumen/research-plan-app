'use strict';
// Local review helper: allowlisted static assets and deterministic mock APIs only.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = new Set(['index.html', 'app.js', 'style.css', 'test-profiles.js', 'score-classification.js', 'textarea-autosize.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']);
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  res.setHeader('X-RPA-Preview', 'RPA-51 b560 mock');
  if (name === 'api/config') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({jiraEnabled: false, googleClientId: '', googleApiKey: ''})); }
  if (name.startsWith('api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (name === 'api/evaluate') return res.end(JSON.stringify({metrics:[{name:'Mock feedback',score:2,desc:'Offline preview only'}],recommendations:[]}));
    res.statusCode = 503; return res.end(JSON.stringify({error:'Unavailable in RPA-51 mock preview'}));
  }
  if (!assets.has(name)) { res.statusCode=404; return res.end(); }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/plain');
  let content = fs.readFileSync(path.join(root, name), 'utf8');
  if (name === 'index.html') content = content.replace(/<script src="https:[^>]*><\/script>/g, '').replace(/<link href="https:[^>]*>/g, '').replace('<title>Research Plan</title>', '<title>RPA-51 MOCK preview</title>').replace('<body>', '<body><div style="padding:10px;background:#fff1b8;color:#222;text-align:center">RPA-51 MOCK PREVIEW — b560 — local data and mock evaluation only</div>');
  res.end(content);
}).listen(8937, '127.0.0.1', () => console.log('RPA-51 mock preview http://127.0.0.1:8937/?test serving ' + root));
