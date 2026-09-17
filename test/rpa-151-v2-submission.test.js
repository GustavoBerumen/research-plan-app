'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const contract = require('../submission-contract');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const { bootApp, waitFor } = require('./app-harness');
const f = require('./rpa-64-fixtures.cjs');

const KEY = 'research-plan-app:submission:v1:synthetic:test';
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const configResponse = () => response({ pilotMode: true, capabilities: { submissions: true, feedback: false, calibration: false,
  uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: f.config });
const post = (server, body) => server.request('/api/submissions', 'POST', JSON.stringify(body), { 'content-type': 'application/json' });

test('v2 projection preserves ordered overlapping studies, assignments, duplicate-looking answers, names and every sample size', () => {
  const draft = f.plan();
  draft.lists.researchQuestions.push('What would help?');
  draft.lists.outcomes.push('Identify improvements.');
  draft.selects.studyCount = { v: 'Two', o: '' };
  draft.studies = [
    { questions: [1, 2], methods: ['Interview', 'Interview'], characteristics: ['Recent customer'], sampleSize: { v: contract.SAMPLE_SIZES[0], o: '' } },
    { questions: [2], methods: ['Interview'], characteristics: ['Recent customer'], sampleSize: { v: '__other__', o: '30+' } },
  ];
  const projected = contract.project(draft);
  assert.deepEqual(contract.validate(projected), []);
  assert.deepEqual(projected.studies, draft.studies);
  assert.deepEqual(projected.lists.researcherNames, ['Sam Okoro']);
  assert.equal(projected.planId, draft.planId);
  const reordered = structuredClone(projected);
  reordered.studies.reverse();
  assert.notEqual(contract.canonical(reordered), contract.canonical(projected), 'array order remains authored data');
});

test('server accepts both new v2 requests and exact frozen v1 retries without converting either request', async () => {
  const store = f.memoryStore();
  const server = loadServer({ env: f.env, submissionStore: store });
  const v2 = f.request();
  const v2Response = await post(server, v2);
  assert.equal(v2Response.status, 201);
  const v2Receipt = JSON.parse(v2Response.body);
  assert.deepEqual([v2Receipt.receiptVersion, v2Receipt.planId, v2Receipt.formSchemaVersion], [2, v2.plan.planId, contract.SCHEMA]);
  assert.equal(store.objects.get(f.prefix + 'submissions/' + v2.submissionId + '.json').value.recordVersion, 2);

  const v1 = f.legacyRequest();
  const v1Response = await post(server, v1);
  assert.equal(v1Response.status, 201);
  const v1Receipt = JSON.parse(v1Response.body);
  assert.deepEqual({ ...v1Receipt, submittedAt: 'checked-separately' }, { ...f.legacyReceipt(v1), submittedAt: 'checked-separately' });
  assert.ok(Number.isFinite(Date.parse(v1Receipt.submittedAt)));
  const stored = store.objects.get(f.prefix + 'submissions/' + v1.submissionId + '.json').value;
  assert.equal(stored.recordVersion, 1);
  assert.deepEqual(require('../submissions-server').requestOf(stored), v1);
});

test('a browser upgrade retries its frozen v1 pending snapshot byte-for-byte before preparing a v2 update', async t => {
  const request = f.legacyRequest();
  const pending = { version: 1, state: 'pending', fingerprint: contract.fingerprint(request.plan), request };
  const sent = [];
  const app = await bootApp({ draft: f.plan(), configResponse, storage: { [KEY]: JSON.stringify(pending) }, submit: async body => {
    sent.push(body); return response(f.legacyReceipt(body));
  } });
  t.after(() => app.close());
  const button = app.document.querySelector('.submission-send');
  assert.equal(button.textContent, 'Retry saved snapshot');
  button.click();
  await waitFor(() => /privately saved/.test(app.document.querySelector('.submission-status').textContent));
  assert.deepEqual(sent, [request]);
  assert.equal(JSON.parse(app.window.localStorage.getItem(KEY)).request.formSchemaVersion, contract.LEGACY_SCHEMA);
  assert.deepEqual(app.jsdomErrors, []);
});
