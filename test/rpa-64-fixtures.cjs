'use strict';
const contract = require('../submission-contract');
const { sha256 } = require('../submissions-server');
const ID = 'ac089b16-3ec5-44c1-9f5c-194bc05a739d';
const config = { deployment: 'synthetic', cohort: 'test', formSchemaVersion: contract.SCHEMA,
  collectionPolicyVersion: 'test-v1', notice: 'Synthetic test notice only. The test organisers receive this active plan and delete it 28 days after the final session.' };
const env = { RPA_SUBMISSIONS_ENABLED: 'true', RPA_SUBMISSIONS_ACCESS: 'pilot', RPA_SUBMISSIONS_DEPLOYMENT: config.deployment,
  RPA_SUBMISSIONS_COHORT: config.cohort, RPA_SUBMISSIONS_POLICY_VERSION: config.collectionPolicyVersion, RPA_SUBMISSIONS_NOTICE: config.notice };
const prefix = 'deployments/synthetic/cohorts/test/';
function plan() {
  return contract.project({ version: 8, savedAt: '2026-09-14T12:00:00.000Z', createdAt: '2026-09-14', fields: {
    researchTitle: 'Synthetic <plan>', jiraProject: 'TEST', leadResearcher: 'AB', projectRequester: 'CD',
    projectDecision: '2026-12-10', researchReadout: '2026-11-30', lastUpdated: '2026-09-14',
    background: 'Synthetic context.', goal: 'Synthetic goal.', problemStatement: 'Synthetic problem.', objective: 'Synthetic objective.',
    declarationResearcher: 'yes', declarationRequester: 'yes', signOffResearcher: 'AB — 14/09/2026', signOffProjectOwner: 'CD — 14/09/2026',
  }, lists: { researchQuestions: ['What prevents completion?'], outcomes: ['Identify barriers.'] }, methods: [{ question: 'What prevents completion?',
    methods: ['Interviews'], characteristics: ['Recently attempted the task'], userGroups: ['New users'], sampleSize: { v: contract.SAMPLE_SIZES[0], o: '' } }],
  tables: { 'stageTimeline-table': [[{ t: 'select', v: 'Planning', o: '', d: 1 }, { t: 'date', v: '2026-09-14', d: 1 }, { t: 'date', v: '2026-10-10' }, { t: 'text', v: '' }]],
    'previousKnowledge-table': [[{ t: 'text', v: '' }, { t: 'file', v: '', n: 'No file chosen' }, { t: 'text', v: '' }]] }, custom: {}, ui: {} });
}
function request() { return { submissionId: ID, formSchemaVersion: config.formSchemaVersion, collectionPolicyVersion: config.collectionPolicyVersion, plan: plan() }; }
function receipt(body) { return { status: 'stored', submissionId: body.submissionId, submittedAt: '2026-09-14T12:34:56.000Z', contentSha256: sha256(body) }; }
function cohort() { return { recordType: 'research-plan-cohort', recordVersion: 1, ...config, collectionOpen: true, finalSessionAt: null, deleteAfter: null }; }
function memoryStore() {
  const objects = new Map([[prefix + 'cohort.json', { value: cohort(), etag: '1' }]]), calls = [];
  let seq = 1;
  return { objects, calls,
    async get(key) { calls.push(['get', key]); return structuredClone(objects.get(key) || null); },
    async put(key, value, condition) {
      calls.push(['put', key, condition]);
      const existing = objects.get(key);
      if (condition.absent ? !!existing : existing?.etag !== condition.etag) return false;
      objects.set(key, { value: structuredClone(value), etag: String(++seq) }); return true;
    },
    async *keys(start) { for (const key of Array.from(objects.keys()).sort()) if (key.startsWith(start)) yield key; },
  };
}
module.exports = { ID, config, env, prefix, plan, request, receipt, cohort, memoryStore };
