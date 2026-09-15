'use strict';

const crypto = require('node:crypto');
const contract = require('./submission-contract');
const { createR2Store } = require('./r2-submission-store');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const sha256 = value => crypto.createHash('sha256').update(contract.canonical(value)).digest('hex');
const requestOf = record => ({ submissionId: record.submissionId, formSchemaVersion: record.formSchemaVersion,
  collectionPolicyVersion: record.collectionPolicyVersion, plan: record.plan });
const receiptOf = record => ({ status: 'stored', submissionId: record.submissionId, submittedAt: record.submittedAt, contentSha256: record.contentSha256 });

function namespace(env) {
  const deployment = env.RPA_SUBMISSIONS_DEPLOYMENT, cohort = env.RPA_SUBMISSIONS_COHORT;
  if (!SLUG.test(deployment || '') || !SLUG.test(cohort || '')) throw new Error('Submission deployment and cohort must be explicit identifiers.');
  return { deployment, cohort, prefix: `deployments/${deployment}/cohorts/${cohort}/` };
}
function retentionDeadline(finalSessionAt) {
  if (typeof finalSessionAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(finalSessionAt) ||
      !Number.isFinite(Date.parse(finalSessionAt)) || new Date(finalSessionAt).toISOString() !== finalSessionAt) throw new Error('Use an exact UTC final-session timestamp.');
  return new Date(Date.parse(finalSessionAt) + 28 * 86400000).toISOString();
}
function validCohort(value, config) {
  if (!value || value.recordType !== 'research-plan-cohort' || value.recordVersion !== 1 ||
      value.deployment !== config.deployment || value.cohort !== config.cohort ||
      value.collectionPolicyVersion !== config.collectionPolicyVersion || value.notice !== config.notice ||
      typeof value.collectionOpen !== 'boolean') return false;
  try { return value.finalSessionAt === null ? value.deleteAfter === null : value.deleteAfter === retentionDeadline(value.finalSessionAt); }
  catch (_) { return false; }
}
function verifyRecord(record, config) {
  return !!record && record.recordType === 'research-plan-submission' && record.recordVersion === 1 && typeof record.submissionId === 'string' && UUID.test(record.submissionId) &&
    record.formSchemaVersion === contract.SCHEMA && record.retention?.deployment === config.deployment && record.retention?.cohort === config.cohort &&
    typeof record.submittedAt === 'string' && Number.isFinite(Date.parse(record.submittedAt)) &&
    contract.validate(record.plan).length === 0 && record.contentSha256 === sha256(requestOf(record));
}
function readBody(req, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], settled = false;
    const finish = (error, body) => {
      if (settled) return;
      settled = true; clearTimeout(timer); chunks = [];
      req.removeListener('data', data); req.removeListener('end', end);
      req.removeListener('error', aborted); req.removeListener('aborted', aborted);
      if (error) { req.resume?.(); reject(error); } else resolve(body);
    };
    const fail = (status, code) => finish(Object.assign(new Error(code), { status, code }));
    const data = chunk => { size += Buffer.byteLength(chunk); if (size > contract.MAX_BYTES) fail(413, 'too_large'); else chunks.push(Buffer.from(chunk)); };
    const end = () => { let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return fail(400, 'invalid_json'); } finish(null, body); };
    const aborted = () => fail(400, 'interrupted_body');
    const timer = setTimeout(() => fail(408, 'body_timeout'), timeoutMs);
    timer.unref?.();
    req.on('data', data); req.on('end', end); req.on('error', aborted); req.on('aborted', aborted);
  });
}
function createSubmissions({ env, pilot, build, store, now = () => Date.now(), bodyTimeoutMs }) {
  const setting = env.RPA_SUBMISSIONS_ENABLED;
  if (setting !== undefined && !['true', 'false'].includes(setting)) throw new Error('RPA_SUBMISSIONS_ENABLED must be true or false.');
  if (setting !== 'true') return { enabled: false, publicConfig: null };
  // First slice deliberately has no public or unprotected access mode.
  if (!pilot || env.RPA_SUBMISSIONS_ACCESS !== 'pilot') throw new Error('Submissions require protected pilot access.');
  const config = { ...namespace(env), collectionPolicyVersion: env.RPA_SUBMISSIONS_POLICY_VERSION, notice: env.RPA_SUBMISSIONS_NOTICE };
  if (!SLUG.test(config.collectionPolicyVersion || '') || typeof config.notice !== 'string' || config.notice.trim().length < 40 || config.notice.length > 8000) {
    throw new Error('An approved collection notice and policy version are required.');
  }
  store ||= createR2Store(env);
  const recent = [], active = new Set();
  const publicConfig = { deployment: config.deployment, cohort: config.cohort, collectionPolicyVersion: config.collectionPolicyVersion,
    notice: config.notice, formSchemaVersion: contract.SCHEMA };
  function reply(res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  }
  async function handle(req, res) {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return reply(res, 415, { code: 'json_required' });
    while (recent.length && recent[0] <= now() - 60000) recent.shift();
    if (recent.length >= 5) return reply(res, 429, { code: 'submission_limit' }, { 'Retry-After': '60' });
    recent.push(now());
    let id, acquired = false;
    try {
      const body = await readBody(req, bodyTimeoutMs);
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length !== 4 ||
          Object.keys(body).some(k => !['submissionId', 'formSchemaVersion', 'collectionPolicyVersion', 'plan'].includes(k)) || typeof body.submissionId !== 'string' || !UUID.test(body.submissionId)) {
        return reply(res, 400, { code: 'invalid_envelope' });
      }
      if (body.formSchemaVersion !== contract.SCHEMA || body.collectionPolicyVersion !== config.collectionPolicyVersion) return reply(res, 409, { code: 'version_conflict' });
      const errors = contract.validate(body.plan);
      if (errors.length) return reply(res, 422, { code: 'incomplete_plan', errors: errors.slice(0, 200), moreErrors: errors.length > 200 });
      id = body.submissionId;
      if (active.has(id)) return reply(res, 429, { code: 'submission_busy' }, { 'Retry-After': '2' });
      active.add(id);
      acquired = true;
      const key = config.prefix + `submissions/${id}.json`, journalKey = config.prefix + `deletions/${id}.json`;
      const digest = sha256(body);
      let saved = await store.get(key);
      if (await store.get(journalKey) || saved?.value.recordType === 'research-plan-deletion') return reply(res, 410, { code: 'submission_deleted' });
      let created = false;
      if (!saved) {
        const cohort = (await store.get(config.prefix + 'cohort.json'))?.value;
        if (!validCohort(cohort, config)) return reply(res, 503, { code: 'collection_unavailable' });
        if (!cohort.collectionOpen || (cohort.deleteAfter && now() >= Date.parse(cohort.deleteAfter))) return reply(res, 403, { code: 'collection_closed' });
        const record = { recordType: 'research-plan-submission', recordVersion: 1, ...body, submittedAt: new Date(now()).toISOString(),
          applicationBuild: build, contentSha256: digest, retention: { deployment: config.deployment, cohort: config.cohort, policyRef: config.prefix + 'cohort.json' } };
        created = await store.put(key, record, { absent: true });
        saved = await store.get(key); // A possible write is never itself an acknowledgement.
      }
      if (await store.get(journalKey) || saved?.value.recordType === 'research-plan-deletion') return reply(res, 410, { code: 'submission_deleted' });
      if (!saved || !verifyRecord(saved.value, config)) return reply(res, 503, { code: 'receipt_unconfirmed' });
      if (saved.value.submissionId !== id || saved.value.contentSha256 !== digest) return reply(res, 409, { code: 'submission_conflict' });
      return reply(res, created ? 201 : 200, receiptOf(saved.value));
    } catch (e) {
      const bodyError = ['too_large', 'invalid_json', 'interrupted_body', 'body_timeout'].includes(e.code);
      return reply(res, bodyError ? e.status : 503, { code: bodyError ? e.code : 'receipt_unconfirmed' });
    } finally { if (acquired) active.delete(id); }
  }
  return { enabled: true, publicConfig, handle };
}
module.exports = { createSubmissions, namespace, retentionDeadline, validCohort, verifyRecord, sha256, requestOf, receiptOf, readBody, UUID };
