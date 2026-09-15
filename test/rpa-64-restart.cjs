'use strict';
const fs = require('node:fs');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const f = require('./rpa-64-fixtures.cjs');
const store = f.memoryStore(); store.objects.clear();
for (const [key, value] of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) store.objects.set(key, value);
loadServer({ env: f.env, submissionStore: store }).request('/api/submissions', 'POST', JSON.stringify(f.request()), { 'content-type': 'application/json' }).then(result => {
  console.log(JSON.stringify({ status: result.status, body: result.body, writes: store.calls.filter(c => c[0] === 'put').length }));
});
