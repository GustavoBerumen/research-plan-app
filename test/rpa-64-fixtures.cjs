'use strict';
const contract = require('../submission-contract');
const { sha256 } = require('../submissions-server');
const ID = 'ac089b16-3ec5-44c1-9f5c-194bc05a739d';
const PLAN_ID = 'b0b8d9d0-9e02-4af6-8d70-8d1966ac77a4';
const config = { deployment: 'synthetic', cohort: 'test', formSchemaVersion: contract.SCHEMA,
  collectionPolicyVersion: 'test-v1', notice: 'Synthetic test notice only. The test organisers receive this active plan and delete it 28 days after the final session.' };
const env = { RPA_SUBMISSIONS_ENABLED: 'true', RPA_SUBMISSIONS_ACCESS: 'pilot', RPA_SUBMISSIONS_DEPLOYMENT: config.deployment,
  RPA_SUBMISSIONS_COHORT: config.cohort, RPA_SUBMISSIONS_POLICY_VERSION: config.collectionPolicyVersion, RPA_SUBMISSIONS_NOTICE: config.notice };
const prefix = 'deployments/synthetic/cohorts/test/';
function plan() {
  return contract.project({ version: 11, planId: PLAN_ID, savedAt: '2026-09-14T12:00:00.000Z', createdAt: '2026-09-14', fields: {
    researchTitle: 'Synthetic <plan>', jiraProject: 'TEST', leadResearcher: 'AB', projectRequester: 'CD',
    projectDecision: '2026-12-10', researchReadout: '2026-11-30', lastUpdated: '2026-09-14',
    background: 'Synthetic context.', goal: 'Synthetic goal.', problemStatement: 'Synthetic problem.', objective: 'Synthetic objective.',
    declarationResearcher: 'yes', declarationRequester: 'yes', signOffResearcher: 'AB — 14/09/2026', signOffProjectOwner: 'CD — 14/09/2026',
  }, selects: { otherResearchers: { v: 'Yes', o: '' }, studyCount: { v: 'One', o: '' } }, lists: { researchQuestions: ['What prevents completion?'], outcomes: ['Identify barriers.'], researcherNames: ['Sam Okoro'] },
  studies: [{ questions: [1], methods: ['Interviews'], characteristics: ['Recently attempted the task'], sampleSize: { v: contract.SAMPLE_SIZES[0], o: '' } }],
  tables: { 'stageTimeline-table': [[{ t: 'select', v: 'Planning', o: '', d: 1 }, { t: 'date', v: '2026-09-14', d: 1 }, { t: 'date', v: '2026-10-10' }, { t: 'text', v: '' }]],
    'previousKnowledge-table': [[{ t: 'text', v: '' }, { t: 'file', v: '', n: 'No file chosen' }, { t: 'text', v: '' }]] }, custom: {}, ui: {} });
}
function request() { return { submissionId: ID, formSchemaVersion: config.formSchemaVersion, collectionPolicyVersion: config.collectionPolicyVersion, supersedesSubmissionId: null, plan: plan() }; }
function receipt(body) { return { receiptVersion: 2, status: 'stored', submissionId: body.submissionId, planId: body.plan.planId,
  formSchemaVersion: body.formSchemaVersion, submittedAt: '2026-09-14T12:34:56.000Z', contentSha256: sha256(body), deployment: config.deployment, cohort: config.cohort }; }
function legacyPlan() {
  const active = plan();
  return contract.projectLegacy({ version: 8, savedAt: active.savedAt, createdAt: active.createdAt, fields: active.fields,
    lists: { researchQuestions: active.lists.researchQuestions, outcomes: active.lists.outcomes },
    methods: active.studies.map(study => ({ question: active.lists.researchQuestions[study.questions[0] - 1], methods: study.methods,
      characteristics: study.characteristics, userGroups: study.userGroups || [], sampleSize: study.sampleSize })),
    tables: active.tables, custom: active.custom, lastUpdatedManual: active.lastUpdatedManual, ui: active.ui });
}
function legacyRequest() { return { submissionId: '934fdc58-95e1-4df7-aeda-fe161cc90c2a', formSchemaVersion: contract.LEGACY_SCHEMA,
  collectionPolicyVersion: config.collectionPolicyVersion, plan: legacyPlan() }; }
function legacyReceipt(body) { return { status: 'stored', submissionId: body.submissionId, submittedAt: '2026-09-14T12:34:56.000Z', contentSha256: sha256(body) }; }
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
module.exports = { ID, PLAN_ID, config, env, prefix, plan, request, receipt, legacyPlan, legacyRequest, legacyReceipt, cohort, memoryStore };
