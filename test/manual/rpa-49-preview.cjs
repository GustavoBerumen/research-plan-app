'use strict';
// Loopback-only review helper. No credentials, production server or paid APIs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const assets = new Set(['index.html', 'app.js', 'style.css', 'test-profiles.js', 'score-classification.js', 'textarea-autosize.js', 'research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md']);
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  res.setHeader('X-RPA-Preview', 'RPA-49 4c64 mock');
  res.setHeader('Cache-Control', 'no-store');
  if (name === 'api/config') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ jiraEnabled: false, googleClientId: '', googleApiKey: '' }));
  }
  if (name.startsWith('api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (name === 'api/evaluate') return res.end(JSON.stringify({ metrics: [{ name: 'Mock feedback', score: 2, desc: 'Offline preview only' }], recommendations: [] }));
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Unavailable in RPA-49 mock preview' }));
  }
  if (!assets.has(name)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/plain');
  let content = fs.readFileSync(path.join(root, name), 'utf8');
  if (name === 'index.html') content = content
    .replace(/<script src="https:[^>]*><\/script>/g, '')
    .replace(/<link href="https:[^>]*>/g, '')
    .replace('<title>Research Plan</title>', '<title>RPA-49 MOCK preview</title>')
    .replace('<body>', `<body><div style="padding:10px;background:#fff1b8;color:#222;text-align:center">RPA-49 MOCK PREVIEW — 4c64 — local data and mock evaluation only
      <label>Reset confirmation <select id="mock-confirmation"><option value="native">Native dialog</option><option value="cancel">Mock Cancel</option><option value="confirm">Mock Confirm</option></select></label>
      <output id="mock-confirmation-result" aria-live="polite"></output>
      <details><summary>Reset scroll diagnostics (mock preview only)</summary><pre id="mock-scroll-report" style="white-space:pre-wrap;overflow-wrap:anywhere;text-align:left">Use Clear Form to record before/after offsets.</pre></details>
    </div><script>
      const nativeConfirm = window.confirm.bind(window);
      window.confirm = message => {
        const root = document.getElementById('doc');
        const nodes = [...root.querySelectorAll('input[type="text"], textarea, .tbl-wrap')];
        for (const el of [...nodes]) {
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            if (parent.scrollLeft && !nodes.includes(parent)) nodes.push(parent);
          }
        }
        const snapshot = el => ({
          element: el.id || el.getAttribute('aria-label') || el.className || el.tagName,
          connected: el.isConnected, left: el.scrollLeft,
          width: el.clientWidth, scrollWidth: el.scrollWidth,
          valueLength: typeof el.value === 'string' ? el.value.length : null
        });
        const before = nodes.map(snapshot);
        const values = nodes.map(el => el.value);
        const choice = document.getElementById('mock-confirmation').value;
        const accepted = choice === 'native' ? nativeConfirm(message) : choice === 'confirm';
        document.getElementById('mock-confirmation-result').textContent = message + ' Response: ' + (accepted ? 'confirm' : 'cancel') + ' (' + choice + ')';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.getElementById('mock-scroll-report').textContent = JSON.stringify({
            browser: navigator.userAgent, viewport: [innerWidth, innerHeight],
            confirmation: choice, accepted,
            elements: nodes.map((el, i) => ({ before: before[i], after: snapshot(el), valueUnchanged: values[i] === el.value }))
          }, null, 2);
        }));
        return accepted;
      };
    </script>`);
  res.end(content);
}).listen(8938, '127.0.0.1', () => console.log('RPA-49 mock preview http://127.0.0.1:8938/?test serving ' + root));
