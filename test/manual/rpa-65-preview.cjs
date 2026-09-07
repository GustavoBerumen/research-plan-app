'use strict';
// Explicitly local test data; no .env, production server, or external APIs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { draftFor, examples } = require('../rpa-65-fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = '0df697ff54a82224860ccc0b980ab576069e7630';
const port = Number(process.argv[2] || 8939);
const assets = new Set(['index.html', 'app.js', 'style.css', 'test-profiles.js', 'score-classification.js', 'textarea-autosize.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']);
const baselineAssets = Object.fromEntries(['app.js', 'style.css'].map(name => [name,
  execFileSync('git', ['show', baseline + ':' + name], { cwd: root, encoding: 'utf8', maxBuffer: 2e6 })]));
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let name = url.pathname.slice(1) || 'index.html';
  res.setHeader('X-RPA-Preview', 'RPA-65 e786 mock');
  res.setHeader('Cache-Control', 'no-store');
  if (name === 'api/config') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ jiraEnabled: false, googleClientId: '', googleApiKey: '' }));
  }
  if (name.startsWith('api/')) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Unavailable in RPA-65 offline mock preview' }));
  }
  const isBaselineAsset = name.startsWith('baseline/');
  if (isBaselineAsset) name = name.slice('baseline/'.length);
  if (!assets.has(name) || (isBaselineAsset && !Object.hasOwn(baselineAssets, name))) {
    res.statusCode = 404; return res.end();
  }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/plain');
  let content = isBaselineAsset ? baselineAssets[name] : fs.readFileSync(path.join(root, name), 'utf8');
  if (name === 'index.html') {
    const before = url.searchParams.has('baseline');
    const example = url.searchParams.get('example');
    content = content.replace(/<script src="https:[^>]*><\/script>/g, '').replace(/<link href="https:[^>]*>/g, '')
      .replace('<title>Research Plan</title>', '<title>RPA-65 MOCK preview</title>');
    if (before) content = content.replace('src="app.js"', 'src="/baseline/app.js"').replace('href="style.css"', 'href="/baseline/style.css"');
    content = content.replace('<body>', `<body><style>@media print{.rpa65-preview-controls{display:none!important}}</style>
      <div class="rpa65-preview-controls" style="padding:10px;background:#fff1b8;color:#222;text-align:center">
      <strong>RPA-65 MOCK PREVIEW — e786 — ${before ? 'BEFORE (main 0df697f)' : 'AFTER (local changes)'}</strong><br>
      Local test data; APIs disabled. Example links replace this preview's disposable draft.<br>
      ${Object.keys(examples).map(key => `<a href="/?example=${key}${before ? '&baseline=1' : ''}">${key}</a>`).join(' | ')}
      <br><a href="/?example=monthly&baseline=1">Before monthly example</a> | <a href="/?example=monthly">After monthly example</a> |
      <a href="#stageTimeline-table">Stage Timeline</a>
      <label>Reset confirmation <select id="mock-confirmation"><option value="native">Native dialog</option><option value="cancel">Mock Cancel</option><option value="confirm">Mock Confirm</option></select></label>
      <button type="button" id="mock-print-start">Simulate beforeprint</button><button type="button" id="mock-print-end">Simulate afterprint</button>
      <output id="mock-event-result" aria-live="polite"></output>
      </div><script>
      ${Object.hasOwn(examples, example) ? `localStorage.setItem('research-plan-app:draft', ${JSON.stringify(JSON.stringify(draftFor(examples[example])))}); history.replaceState(null, '', '/${before ? '?baseline=1' : ''}');` : ''}
      const nativeConfirm = window.confirm.bind(window);
      window.confirm = message => {
        const choice = document.getElementById('mock-confirmation').value;
        return choice === 'native' ? nativeConfirm(message) : choice === 'confirm';
      };
      for (const [id, event] of [['mock-print-start', 'beforeprint'], ['mock-print-end', 'afterprint']]) {
        document.getElementById(id).onclick = () => {
          window.dispatchEvent(new Event(event));
          document.getElementById('mock-event-result').textContent = 'Simulated ' + event + ' (not native print preview)';
        };
      }
      </script>`);
  }
  res.end(content);
}).listen(port, '127.0.0.1', () => console.log('RPA-65 mock preview http://127.0.0.1:' + port + '/?example=monthly serving ' + root));
