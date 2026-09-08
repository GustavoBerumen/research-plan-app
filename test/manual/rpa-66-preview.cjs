'use strict';
// Loopback-only reproduction. No production server, .env, credentials or live APIs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { draftFor, examples: longExamples } = require('../rpa-65-fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = 'c3e5a49ecea9ddff5b7951f009d4a77077794604';
const port = Number(process.argv[2] || 8940);
const assets = new Set(['index.html', 'app.js', 'style.css', 'test-profiles.js', 'score-classification.js', 'textarea-autosize.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']);
const baselineAssets = Object.fromEntries([...assets].map(name => [name,
  execFileSync('git', ['show', baseline + ':' + name], { cwd: root, encoding: 'utf8', maxBuffer: 2e6 })]));
const examples = {
  original: [['Planning', '2026-09-07', '2026-09-14'], ['Recruitment', '2026-09-09', '2026-09-23']],
  'one-day': [['Planning', '2026-09-07', '2026-09-07']],
  overlap: [['Planning', '2026-09-07', '2026-09-14'], ['Recruitment', '2026-09-09', '2026-09-23'], ['One day', '2026-09-14', '2026-09-14']],
  ...longExamples,
};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let name = url.pathname.slice(1) || 'index.html';
  res.setHeader('X-RPA-Preview', 'RPA-66 cef3 mock');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  if (name === 'api/config') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ jiraEnabled: false, googleClientId: '', googleApiKey: '' }));
  }
  if (name.startsWith('api/')) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Unavailable in RPA-66 offline mock preview' }));
  }
  const before = name.startsWith('baseline/');
  if (before) name = name.slice('baseline/'.length) || 'index.html';
  if (!assets.has(name)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/plain');
  let content = before ? baselineAssets[name] : fs.readFileSync(path.join(root, name), 'utf8');
  if (name === 'index.html') {
    const example = url.searchParams.get('example');
    const draft = Object.hasOwn(examples, example) ? draftFor(examples[example], !url.searchParams.has('hidden')) : null;
    if (draft) draft.fields.researchTitle = 'RPA-66 timeline review';
    content = content.replace(/<script src="https:[^>]*><\/script>/g, '').replace(/<link href="https:[^>]*>/g, '')
      .replace('<title>Research Plan</title>', '<title>RPA-66 MOCK preview</title>');
    content = content.replace('<body>', `<body><style>@media print{.rpa66-controls{display:none!important}}</style>
      <div class="rpa66-controls" style="padding:10px;background:#fff1b8;color:#222;text-align:center;font:14px sans-serif">
      <strong>RPA-66 MOCK PREVIEW - cef3 - ${before ? 'BASELINE c3e5a49' : 'LOCAL'}</strong><br>
      Synthetic data; external access blocked. Example links replace this preview's disposable draft.<br>
      ${Object.keys(examples).map(key => `<a href="?example=${key}">${key}</a>`).join(' | ')}<br>
      <a href="/baseline/?example=original">Baseline original</a> | <a href="/?example=original">Local original</a> |
      <a href="?example=original&hidden=1">Original, hidden</a> | <a href="#stageTimeline-table">Stage Timeline</a><br>
      <output id="rpa66-status">Waiting for app</output>
      </div><script>
      ${draft ? `localStorage.setItem('research-plan-app:draft', ${JSON.stringify(JSON.stringify(draft))}); history.replaceState(null, '', '${before ? '/baseline/' : '/'}');` : ''}
      const initialDraft = JSON.parse(localStorage.getItem('research-plan-app:draft') || '{}');
      let printEvents = [];
      const updateStatus = () => {
        const saved = JSON.parse(localStorage.getItem('research-plan-app:draft') || '{}');
        const dates = Array.from(document.querySelectorAll('#stageTimeline-table input[type=date]'), x => x.value);
        const stageValues = draft => (draft.tables?.['stageTimeline-table'] || []).map(row => row.slice(0, 3));
        const unchanged = JSON.stringify(stageValues(saved)) === JSON.stringify(stageValues(initialDraft)) && saved.fields?.lastUpdated === initialDraft.fields?.lastUpdated;
        const chart = document.querySelector('.timeline-chart');
        document.getElementById('rpa66-status').textContent = 'Chart: ' + (chart?.hidden ? 'hidden' : 'visible') + ' | Saved visibility: ' + saved.ui?.timelineVisible + ' | Saved stages / Last updated: ' + (unchanged ? 'unchanged' : 'changed') + ' | Events: ' + printEvents.join(', ') + ' | Dates: ' + dates.join(', ');
      };
      for (const event of ['beforeprint', 'afterprint']) window.addEventListener(event, () => { printEvents.push(event); setTimeout(updateStatus, 0); });
      setInterval(updateStatus, 500);
      </script>`);
  }
  res.end(content);
}).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ticket: 'RPA-66', pid: process.pid, host: '127.0.0.1', port, root, baseline, url: 'http://127.0.0.1:' + port + '/?example=original' })));
