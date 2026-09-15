/* Shared active-plan contract. Recovery backups deliberately use their own validator. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPA_SUBMISSION = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'rpa-active-2026-09-14-v1';
  const MAX_BYTES = 1024 * 1024;
  const MAX_ENTRIES = 500;
  const SAMPLE_SIZES = ['Small (1–5)', 'Medium (6–12)', 'Large (13–29)', 'Very Large (30+)'];
  const STAGES = ['Planning', 'Recruitment', 'Data Collection', 'Analysis', 'Reporting'];
  const FIELDS = ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'projectDecision', 'researchReadout', 'lastUpdated', 'background', 'goal', 'problemStatement', 'objective', 'comments', 'declarationResearcher', 'signOffResearcher', 'declarationRequester', 'signOffProjectOwner'];
  const CUSTOM = ['additionalContext', 'additionalResearch', 'additionalMethodology', 'additionalResources'];
  const SECTION = { researchTitle: 'plan-details', jiraProject: 'plan-details', leadResearcher: 'plan-details', projectRequester: 'plan-details', projectDecision: 'plan-details', researchReadout: 'plan-details', lastUpdated: 'plan-details', background: 'context', goal: 'context', problemStatement: 'context', objective: 'research', researchQuestions: 'research', outcomes: 'research', methods: 'methodology', characteristics: 'methodology', userGroups: 'methodology', sampleSize: 'methodology', stageTimeline: 'execution', previousKnowledge: 'execution', additionalContext: 'context', additionalResearch: 'research', additionalMethodology: 'methodology', additionalResources: 'execution', comments: 'review', declarationResearcher: 'review', signOffResearcher: 'review', declarationRequester: 'review', signOffProjectOwner: 'review' };
  const LABEL = { researchTitle: 'research title', jiraProject: 'Jira project', leadResearcher: 'lead researcher', projectRequester: 'project requester', projectDecision: 'project decision date', researchReadout: 'research readout date', background: 'background', goal: 'goal', problemStatement: 'problem statement', objective: 'objective', researchQuestions: 'research question', outcomes: 'outcome', methods: 'method', characteristics: 'characteristic', userGroups: 'user group', sampleSize: 'sample size', stageTimeline: 'planned schedule', declarationResearcher: 'lead researcher declaration', declarationRequester: 'project requester declaration', signOffResearcher: 'lead researcher sign-off', signOffProjectOwner: 'project requester sign-off' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const nonblank = v => typeof v === 'string' && v.trim().length > 0;
  function sampleSize(value) {
    const match = typeof value === 'string' && /^(\d+)(?:\s*[-–]\s*(\d+)|\s*\+)?$/.exec(value.trim());
    if (!match) return false;
    const first = Number(match[1]), last = match[2] === undefined ? first : Number(match[2]);
    return Number.isSafeInteger(first) && first > 0 && Number.isSafeInteger(last) && last >= first;
  }
  function isoDate(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-01-01') return false;
    const d = new Date(v + 'T00:00:00.000Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }
  function datedSignOff(value) {
    const match = typeof value === 'string' && /^(.+?) — (\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    return !!match && nonblank(match[1]) && isoDate(match[4] + '-' + match[3] + '-' + match[2]);
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function project(draft) {
    const plan = { version: 8, savedAt: draft.savedAt, createdAt: draft.createdAt, fields: {}, selects: {}, lists: {}, methods: clone(draft.methods || []), tables: {}, custom: {}, lastUpdatedManual: !!draft.lastUpdatedManual, ui: { timelineVisible: !!draft.ui?.timelineVisible } };
    FIELDS.forEach(k => { plan.fields[k] = draft.fields?.[k] || ''; });
    ['researchQuestions', 'outcomes'].forEach(k => { plan.lists[k] = clone(draft.lists?.[k] || []); });
    // Preserve the known table IDs and decorative final cell used by backups.
    ['stageTimeline', 'previousKnowledge'].forEach(k => { plan.tables[k + '-table'] = clone(draft.tables?.[k + '-table'] || []); });
    CUSTOM.forEach(k => { plan.custom[k] = clone(draft.custom?.[k] || []).filter(b => nonblank(b.label) || nonblank(b.body)); });
    if (!draft.createdAt) delete plan.createdAt; // Legacy backups have no known start boundary.
    return plan;
  }
  function fingerprint(plan) {
    const p = clone(plan);
    delete p.savedAt; delete p.ui;
    if (!p.lastUpdatedManual) delete p.fields.lastUpdated;
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => { p.fields[k] = p.fields[k]?.replace(/ — \d{2}\/\d{2}\/\d{4}$/, ''); });
    return canonical(p);
  }
  function matchesSchema(fields, before = []) {
    // The RPA-99 address belongs to browser identity, not this collection policy.
    // Check the entry-page schema explicitly without adding it to the payload.
    if (before.length && (before.length !== 1 || before[0].key !== 'emailAddress' ||
        before[0].type !== 'email' || before[0].optional || before[0].perQuestion)) return false;
    const types = Object.fromEntries(FIELDS.map(k => [k, ['projectDecision', 'researchReadout', 'lastUpdated'].includes(k) ? 'date' :
      k.startsWith('declaration') ? 'checkbox' : ['background', 'goal', 'problemStatement', 'objective', 'comments'].includes(k) ? 'textarea' : 'text']));
    Object.assign(types, { researchQuestions: 'list', outcomes: 'list', methods: 'list', characteristics: 'list', userGroups: 'list', sampleSize: 'radios', stageTimeline: 'table', previousKnowledge: 'table' });
    CUSTOM.forEach(k => { types[k] = 'custom-fields'; });
    // RPA-98 made optional plan comments dormant. The wire shape remains v1;
    // current projections carry an empty comments slot, old receipts retain theirs.
    if (!fields.some(f => f.key === 'comments')) delete types.comments;
    if (fields.length !== Object.keys(types).length || new Set(fields.map(f => f.key)).size !== fields.length) return false;
    return fields.every(f => {
      if (types[f.key] !== f.type || !!f.optional !== ['comments', 'previousKnowledge'].includes(f.key) ||
          !!f.perQuestion !== ['characteristics', 'userGroups', 'sampleSize'].includes(f.key)) return false;
      if (f.key === 'sampleSize') return canonical(f.options) === canonical(SAMPLE_SIZES);
      if (f.key === 'stageTimeline') return canonical(f.columns.map(c => [c.key, c.type])) === canonical([['stage', 'select'], ['startDate', 'date'], ['completionDate', 'date']]) && canonical(f.columns[0].options) === canonical(STAGES);
      if (f.key === 'previousKnowledge') return canonical(f.columns.map(c => [c.key, c.type])) === canonical([['name', 'prose'], ['file', 'file']]);
      return true;
    });
  }
  function structure(plan) {
    const bad = () => { throw new Error('Invalid submission structure'); };
    let nodes = 0;
    function record(v, keys) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) bad();
      for (const k of Object.keys(v)) if (!keys.includes(k) || ['__proto__', 'constructor', 'prototype'].includes(k)) bad();
      if ((nodes += Object.keys(v).length) > 30000) bad();
    }
    function str(v) { if (typeof v !== 'string' || v.length > MAX_BYTES) bad(); }
    function array(v, check) { if (!Array.isArray(v) || v.length > MAX_ENTRIES || (nodes += v.length) > 30000) bad(); v.forEach(check); }
    function choice(v) { record(v, ['v', 'o']); str(v.v); if ('o' in v) str(v.o); }
    record(plan, ['version', 'savedAt', 'createdAt', 'fields', 'selects', 'lists', 'methods', 'tables', 'custom', 'lastUpdatedManual', 'ui']);
    if (plan.version !== 8 || ('createdAt' in plan && !isoDate(plan.createdAt)) || typeof plan.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(plan.savedAt) || !isoDate(plan.savedAt.slice(0, 10)) || !Number.isFinite(Date.parse(plan.savedAt))) bad();
    record(plan.fields, FIELDS); Object.values(plan.fields).forEach(str);
    record(plan.selects, []); record(plan.lists, ['researchQuestions', 'outcomes']);
    Object.values(plan.lists).forEach(v => array(v, str));
    array(plan.methods, g => { record(g, ['question', 'methods', 'characteristics', 'userGroups', 'sampleSize']); str(g.question); ['methods', 'characteristics', 'userGroups'].forEach(k => array(g[k], str)); choice(g.sampleSize); });
    record(plan.tables, ['stageTimeline-table', 'previousKnowledge-table']);
    Object.entries(plan.tables).forEach(([key, rows]) => array(rows, row => {
      const types = key === 'stageTimeline-table' ? ['select', 'date', 'date', 'text'] : ['text', 'file', 'text'];
      if (!Array.isArray(row) || row.length !== types.length) bad();
      row.forEach((c, i) => {
        record(c, ['t', 'v', 'o', 'n', 'd']); if (c.t !== types[i]) bad(); str(c.v);
        if ('d' in c && c.d !== 1) bad();
        if ('o' in c) { if (c.t !== 'select') bad(); str(c.o); }
        if ('n' in c) { if (c.t !== 'file') bad(); str(c.n); }
        if (c.t === 'file' && !('n' in c)) bad();
        if (i === types.length - 1 && (c.v !== '' || Object.keys(c).some(k => !['t', 'v'].includes(k)))) bad();
      });
    }));
    record(plan.custom, CUSTOM); Object.values(plan.custom).forEach(v => array(v, b => { record(b, ['label', 'body']); str(b.label); str(b.body); }));
    if (typeof plan.lastUpdatedManual !== 'boolean') bad();
    record(plan.ui, ['timelineVisible']); if (typeof plan.ui.timelineVisible !== 'boolean') bad();
    return true;
  }
  function validate(plan, { structural = true } = {}) {
    if (structural) { try { structure(plan); } catch (_) { return [{ section: 'review', key: null, code: 'structure', message: 'This plan has an unsupported structure. Keep a backup and contact the organiser.' }]; } }
    const errors = [];
    function add(key, code, loc = {}, message) { errors.push({ section: SECTION[key] || 'review', key, code, ...loc, message: message || 'Enter the ' + (LABEL[key] || key) + (loc.question !== undefined ? ' for research question ' + (loc.question + 1) : '') + (loc.row !== undefined ? ', row ' + (loc.row + 1) : '') + '.' }); }
    const f = plan.fields || {};
    ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'background', 'goal', 'problemStatement', 'objective', 'signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (!nonblank(f[k])) add(k, 'required'); });
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => {
      if (nonblank(f[k]) && !datedSignOff(f[k])) add(k, 'signoff_date', {}, 'Enter initials again for the ' + LABEL[k] + '.');
    });
    ['projectDecision', 'researchReadout'].forEach(k => { if (!isoDate(f[k])) add(k, 'date', {}, 'Enter a complete, valid ' + LABEL[k] + '.'); });
    ['declarationResearcher', 'declarationRequester'].forEach(k => { if (f[k] !== 'yes') add(k, 'declaration', {}, 'Confirm the ' + LABEL[k] + '.'); });
    function list(key, values, loc = {}) {
      if (!values?.length) add(key, 'required', { ...loc, row: 0 });
      else values.forEach((v, row) => { if (!nonblank(v)) add(key, 'required', { ...loc, row }); });
    }
    const questions = plan.lists?.researchQuestions || [], outcomes = plan.lists?.outcomes || [];
    list('researchQuestions', questions); list('outcomes', outcomes);
    for (let row = outcomes.length; row < questions.length; row++) add('outcomes', 'required', { row });
    const methods = plan.methods || [];
    if (methods.length !== questions.length) add('methods', 'pairing', {}, 'Restore the methods group for each research question.');
    methods.forEach((g, question) => {
      if (g.question !== (questions[question] || '').trim()) add('methods', 'pairing', { question }, 'Check the methods linked to research question ' + (question + 1) + '.');
      ['methods', 'characteristics', 'userGroups'].forEach(k => list(k, g[k], { question }));
      const c = g.sampleSize;
      if (!c || (!SAMPLE_SIZES.includes(c.v) && c.v !== '__other__')) add('sampleSize', 'choice', { question }, 'Select a sample size for research question ' + (question + 1) + '.');
      else if (c.v === '__other__' && !nonblank(c.o)) add('sampleSize', 'other', { question }, 'Enter the other sample size for research question ' + (question + 1) + '.');
      else if (c.v === '__other__' && !sampleSize(c.o)) add('sampleSize', 'other', { question }, 'Enter a valid sample size for research question ' + (question + 1) + '.');
    });
    const schedule = plan.tables?.['stageTimeline-table'] || [];
    if (!schedule.length) add('stageTimeline', 'required', { row: 0, column: 'stage' }, 'Add at least one complete schedule stage.');
    schedule.forEach((r, row) => {
      if (!STAGES.includes(r[0]?.v) && r[0]?.v !== '__other__') add('stageTimeline', 'choice', { row, column: 'stage' }, 'Choose the stage in schedule row ' + (row + 1) + '.');
      else if (r[0]?.v === '__other__' && !nonblank(r[0]?.o)) add('stageTimeline', 'other', { row, column: 'stage' }, 'Name the other stage in schedule row ' + (row + 1) + '.');
      ['startDate', 'completionDate'].forEach((column, i) => {
        const date = r[i + 1]?.v;
        if (!isoDate(date)) add('stageTimeline', 'date', { row, column }, 'Enter a complete, valid ' + (i ? 'completion' : 'start') + ' date in schedule row ' + (row + 1) + '.');
        else if ((isoDate(plan.createdAt) && date < plan.createdAt) || (isoDate(f.researchReadout) && date > f.researchReadout)) add('stageTimeline', 'bounds', { row, column }, 'Keep schedule row ' + (row + 1) + ' between the plan start and research readout dates.');
      });
      if (isoDate(r[1]?.v) && isoDate(r[2]?.v) && r[2].v < r[1].v) add('stageTimeline', 'range', { row, column: 'completionDate' }, 'Complete schedule row ' + (row + 1) + ' on or after its start date.');
    });
    (plan.tables?.['previousKnowledge-table'] || []).forEach((r, row) => {
      const file = nonblank(r[1]?.v) || (nonblank(r[1]?.n) && r[1].n !== 'No file chosen');
      if (file && !nonblank(r[0]?.v)) add('previousKnowledge', 'required', { row, column: 'name' }, 'Name the reference in row ' + (row + 1) + '.');
    });
    CUSTOM.forEach(k => (plan.custom?.[k] || []).forEach((b, row) => {
      if (nonblank(b.label) || nonblank(b.body)) {
        if (!nonblank(b.label)) add(k, 'required', { row, column: 'label' }, 'Name additional information block ' + (row + 1) + '.');
        if (!nonblank(b.body)) add(k, 'required', { row, column: 'body' }, 'Complete additional information block ' + (row + 1) + '.');
      }
    }));
    return errors;
  }
  return Object.freeze({ SCHEMA, MAX_BYTES, MAX_ENTRIES, FIELDS, CUSTOM, SECTION, SAMPLE_SIZES, STAGES, project, fingerprint, canonical, matchesSchema, structure, validate, isoDate });
});
