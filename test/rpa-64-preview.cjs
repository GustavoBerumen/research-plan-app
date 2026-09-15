'use strict';
// Local synthetic browser fixture. No real credentials, AI or durable provider.
const http = require('node:http');
const path = require('node:path');
const { loadServer, AUTHORIZATION, ROOT } = require('./rpa-89-server-harness.cjs');
const f = require('./rpa-64-fixtures.cjs');
const store = f.memoryStore();
const put = store.put.bind(store);
store.put = async (...args) => { await new Promise(resolve => setTimeout(resolve, 2000)); return put(...args); };
const app = loadServer({ env: { ...f.env, RPA_AI_ENABLED: 'false' }, submissionStore: store });
const draft = f.plan(); draft.ui.section = 'review';
draft.lists.researchQuestions.push('How does the experience differ?'); draft.lists.outcomes.push('');
draft.methods.push({ ...structuredClone(draft.methods[0]), question: 'How does the experience differ?', sampleSize: { v: '__other__', o: '' } });
const seed = JSON.stringify(draft).replace(/</g, '\\u003c');
const html = app.files.get(path.join(ROOT, 'index.html')).toString().replace('<body>', '<body><p style="padding:12px;background:#fff2b3;color:#111">RPA-64 synthetic preview: mocked storage, no live AI, no real plan collection.</p>')
  .replace('<script src="test-profiles.js">', `<script>if (!localStorage.getItem('research-plan-app:draft')) localStorage.setItem('research-plan-app:draft', JSON.stringify(${seed}));</script><script src="test-profiles.js">`);
app.files.set(path.join(ROOT, 'index.html'), Buffer.from(html));
const server = http.createServer((req, res) => {
  // This loopback-only fixture exercises authenticated paths without a login dialog.
  req.headers.authorization = AUTHORIZATION;
  app.server.emit('request', req, res);
});
server.listen(Number(process.env.RPA_TEST_PORT || 9044), '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, url: 'http://127.0.0.1:' + server.address().port, storage: 'synthetic-memory', ai: 'off' })));
