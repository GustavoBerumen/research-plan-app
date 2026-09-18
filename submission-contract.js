/* Shared active-plan contract. Recovery backups deliberately use their own validator. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPA_SUBMISSION = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'rpa-active-2026-09-17-v2';
  const LEGACY_SCHEMA = 'rpa-active-2026-09-14-v1';
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const MAX_BYTES = 1024 * 1024;
  const MAX_ENTRIES = 500;
  const SAMPLE_SIZES = ['Small (1–5)', 'Medium (6–12)', 'Large (13–29)', 'Very Large (30+)'];
  const STAGES = ['Planning', 'Recruitment', 'Data Collection', 'Analysis', 'Reporting'];
  const FIELDS = ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'projectDecision', 'researchReadout', 'lastUpdated', 'background', 'goal', 'problemStatement', 'objective', 'comments', 'declarationResearcher', 'signOffResearcher', 'declarationRequester', 'signOffProjectOwner'];
  // Plan details has a hatch too since RPA-145. It comes first, as its section does.
  const CUSTOM = ['additionalPlanDetails', 'additionalContext', 'additionalResearch', 'additionalMethodology', 'additionalResources'];
  // The v1 schema is history and stays exactly as it was: it never had that hatch.
  const LEGACY_CUSTOM = CUSTOM.filter(k => k !== 'additionalPlanDetails');
  const SECTION = { additionalPlanDetails: 'plan-details', researchTitle: 'plan-details', jiraProject: 'plan-details', leadResearcher: 'plan-details', projectRequester: 'plan-details', projectDecision: 'plan-details', researchReadout: 'plan-details', lastUpdated: 'plan-details', background: 'context', goal: 'context', problemStatement: 'context', objective: 'research', researchQuestions: 'research', outcomes: 'research', methods: 'methodology', characteristics: 'methodology', userGroups: 'methodology', sampleSize: 'methodology', stageTimeline: 'execution', previousKnowledge: 'execution', additionalContext: 'context', additionalResearch: 'research', additionalMethodology: 'methodology', additionalResources: 'execution', comments: 'review', declarationResearcher: 'review', signOffResearcher: 'review', declarationRequester: 'review', signOffProjectOwner: 'review' };
  const LABEL = { researchTitle: 'research title', jiraProject: 'project name', leadResearcher: 'lead researcher', projectRequester: 'project requester', projectDecision: 'project decision date', researchReadout: 'research readout date', background: 'background', goal: 'goal', problemStatement: 'problem statement', objective: 'objective', researchQuestions: 'research question', outcomes: 'outcome', methods: 'method', characteristics: 'participant criteria', userGroups: 'user group', sampleSize: 'sample size', stageTimeline: 'planned schedule', declarationResearcher: 'lead researcher declaration', declarationRequester: 'project requester declaration', signOffResearcher: 'lead researcher sign-off', signOffProjectOwner: 'project requester sign-off' };
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
  // Up to ten characters of initials before the date the form adds (RPA-153).
  const INITIALS_MAX = 10;
  function initialsTooLong(value) { return String(value).replace(/ — \d{2}\/\d{2}\/\d{4}$/, '').trim().length > INITIALS_MAX; }
  function datedSignOff(value) {
    const match = typeof value === 'string' && /^(.+?) — (\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    return !!match && nonblank(match[1]) && isoDate(match[4] + '-' + match[3] + '-' + match[2]);
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function projectLegacy(draft) {
    const plan = { version: 8, savedAt: draft.savedAt, createdAt: draft.createdAt, fields: {}, selects: {}, lists: {}, methods: clone(draft.methods || []), tables: {}, custom: {}, lastUpdatedManual: !!draft.lastUpdatedManual, ui: { timelineVisible: !!draft.ui?.timelineVisible } };
    FIELDS.forEach(k => { plan.fields[k] = draft.fields?.[k] || ''; });
    ['researchQuestions', 'outcomes'].forEach(k => { plan.lists[k] = clone(draft.lists?.[k] || []); });
    // Preserve the known table IDs and decorative final cell used by backups.
    ['stageTimeline', 'previousKnowledge'].forEach(k => { plan.tables[k + '-table'] = clone(draft.tables?.[k + '-table'] || []); });
    LEGACY_CUSTOM.forEach(k => { plan.custom[k] = clone(draft.custom?.[k] || []).filter(b => nonblank(b.label) || nonblank(b.body)); });
    if (!draft.createdAt) delete plan.createdAt; // Legacy backups have no known start boundary.
    return plan;
  }
  function project(draft) {
    const otherResearchers = clone(draft.selects?.otherResearchers || { v: '', o: '' });
    const studyCount = clone(draft.selects?.studyCount || (draft.studies?.length === 1 ? { v: 'One', o: '' } :
      draft.studies?.length === 2 ? { v: 'Two', o: '' } : draft.studies?.length === 3 ? { v: 'Three', o: '' } :
      draft.studies?.length > 3 ? { v: '__other__', o: String(draft.studies.length) } : { v: '', o: '' }));
    const plan = { version: 11, planId: draft.planId, savedAt: draft.savedAt, createdAt: draft.createdAt,
      fields: {}, selects: { otherResearchers, studyCount }, lists: {}, studies: clone(draft.studies || []),
      tables: {}, custom: {}, lastUpdatedManual: !!draft.lastUpdatedManual, ui: { timelineVisible: !!draft.ui?.timelineVisible } };
    FIELDS.forEach(k => { plan.fields[k] = draft.fields?.[k] || ''; });
    ['researchQuestions', 'outcomes'].forEach(k => { plan.lists[k] = clone(draft.lists?.[k] || []); });
    // Names are part of the approved v2 completed-plan record only when the
    // plan says other researchers are involved. Drafts still retain a dormant
    // list when the answer changes to No.
    plan.lists.researcherNames = otherResearchers.v === 'Yes' ? clone(draft.lists?.researcherNames || []) : [];
    ['stageTimeline', 'previousKnowledge'].forEach(k => { plan.tables[k + '-table'] = clone(draft.tables?.[k + '-table'] || []); });
    CUSTOM.forEach(k => { plan.custom[k] = clone(draft.custom?.[k] || []).filter(b => nonblank(b.label) || nonblank(b.body)); });
    if (!draft.createdAt) delete plan.createdAt;
    return plan;
  }
  function fingerprint(plan) {
    const p = clone(plan);
    delete p.savedAt; delete p.ui;
    // Who takes part is one list since RPA-119; it was two. A receipt taken
    // while it was two must still recognise the same plan read as one, so
    // the fingerprint sees a group's participants the way the form now reads
    // them: its characteristics, then its user groups, blanks aside.
    (p.methods || []).forEach(g => {
      const groups = (g.userGroups || []).filter(nonblank);
      if (groups.length) g.characteristics = (g.characteristics || []).filter(nonblank).concat(groups);
      g.userGroups = [];
    });
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
    // RPA-142 added a Studies section to the active form. The wire shape is
    // unchanged: the app derives the per-question methods groups from the
    // studies before projecting (see collectCurrentPlan), so a receipt reads
    // as it always did. Only the schema check needs to know the two fields.
    Object.assign(types, { studyCount: 'radios', studyQuestions: 'study-questions' });
    // RPA-141 added two Plan details questions: whether other researchers are
    // involved, and their names. The projection does not carry them, so the
    // wire shape is unchanged; only the schema check needs to know them.
    Object.assign(types, { otherResearchers: 'radios', researcherNames: 'list' });
    Object.assign(types, { researchQuestions: 'list', outcomes: 'list', methods: 'list', characteristics: 'list', userGroups: 'list', sampleSize: 'radios', stageTimeline: 'table', previousKnowledge: 'table' });
    CUSTOM.forEach(k => { types[k] = 'custom-fields'; });
    // RPA-98 made optional plan comments dormant. The wire shape remains v1;
    // current projections carry an empty comments slot, old receipts retain theirs.
    if (!fields.some(f => f.key === 'comments')) delete types.comments;
    // RPA-119 made user groups and characteristics one question again. The
    // wire shape keeps its userGroups slot, which new projections leave
    // empty, exactly as the comments slot above.
    if (!fields.some(f => f.key === 'userGroups')) delete types.userGroups;
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
  function structureLegacy(plan) {
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
    record(plan.custom, LEGACY_CUSTOM); Object.values(plan.custom).forEach(v => array(v, b => { record(b, ['label', 'body']); str(b.label); str(b.body); }));
    if (typeof plan.lastUpdatedManual !== 'boolean') bad();
    record(plan.ui, ['timelineVisible']); if (typeof plan.ui.timelineVisible !== 'boolean') bad();
    return true;
  }
  function validateLegacy(plan, { structural = true } = {}) {
    if (structural) { try { structureLegacy(plan); } catch (_) { return [{ section: 'review', key: null, code: 'structure', message: 'This plan has an unsupported structure. Keep a backup and contact the organiser.' }]; } }
    const errors = [];
    function add(key, code, loc = {}, message) { errors.push({ section: SECTION[key] || 'review', key, code, ...loc, message: message || 'Enter the ' + (LABEL[key] || key) + (loc.question !== undefined ? ' for research question ' + (loc.question + 1) : '') + (loc.row !== undefined ? ', row ' + (loc.row + 1) : '') + '.' }); }
    const f = plan.fields || {};
    ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'background', 'goal', 'problemStatement', 'objective', 'signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (!nonblank(f[k])) add(k, 'required'); });
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => {
      if (nonblank(f[k]) && !datedSignOff(f[k])) add(k, 'signoff_date', {}, 'Enter initials again for the ' + LABEL[k] + '.');
    });
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (nonblank(f[k]) && initialsTooLong(f[k])) add(k, 'signoff_length', {}, 'Enter ' + INITIALS_MAX + ' characters or fewer for the ' + LABEL[k] + '.'); });
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
      // userGroups is a dormant slot since RPA-119: allowed, never required.
      ['methods', 'characteristics'].forEach(k => list(k, g[k], { question }));
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
        // A document can be written after research began. Creation is advisory,
        // while the readout and each stage's own start are real schedule bounds.
        else if (isoDate(f.researchReadout) && date > f.researchReadout) add('stageTimeline', 'bounds', { row, column }, 'Keep schedule row ' + (row + 1) + ' on or before the research readout date.');
      });
      if (isoDate(r[1]?.v) && isoDate(r[2]?.v) && r[2].v < r[1].v) add('stageTimeline', 'range', { row, column: 'completionDate' }, 'Complete schedule row ' + (row + 1) + ' on or after its start date.');
    });
    (plan.tables?.['previousKnowledge-table'] || []).forEach((r, row) => {
      const file = nonblank(r[1]?.v) || (nonblank(r[1]?.n) && r[1].n !== 'No file chosen');
      if (file && !nonblank(r[0]?.v)) add('previousKnowledge', 'required', { row, column: 'name' }, 'Name the reference in row ' + (row + 1) + '.');
    });
    LEGACY_CUSTOM.forEach(k => (plan.custom?.[k] || []).forEach((b, row) => {
      if (nonblank(b.label) || nonblank(b.body)) {
        if (!nonblank(b.label)) add(k, 'required', { row, column: 'label' }, 'Name additional information block ' + (row + 1) + '.');
        if (!nonblank(b.body)) add(k, 'required', { row, column: 'body' }, 'Complete additional information block ' + (row + 1) + '.');
      }
    }));
    return errors;
  }
  function structureV2(plan) {
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
    record(plan, ['version', 'planId', 'savedAt', 'createdAt', 'fields', 'selects', 'lists', 'studies', 'tables', 'custom', 'lastUpdatedManual', 'ui']);
    if (plan.version !== 11 || !UUID.test(plan.planId || '') || ('createdAt' in plan && !isoDate(plan.createdAt)) ||
        typeof plan.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(plan.savedAt) || !isoDate(plan.savedAt.slice(0, 10)) || !Number.isFinite(Date.parse(plan.savedAt))) bad();
    record(plan.fields, FIELDS); Object.values(plan.fields).forEach(str);
    record(plan.selects, ['otherResearchers', 'studyCount']); choice(plan.selects.otherResearchers); choice(plan.selects.studyCount);
    record(plan.lists, ['researchQuestions', 'outcomes', 'researcherNames']); Object.values(plan.lists).forEach(v => array(v, str));
    array(plan.studies, study => {
      record(study, ['questions', 'methods', 'characteristics', 'userGroups', 'sampleSize']);
      array(study.questions, n => { if (!Number.isInteger(n) || n < 1 || n > MAX_ENTRIES) bad(); });
      ['methods', 'characteristics'].forEach(k => array(study[k], str));
      if ('userGroups' in study) array(study.userGroups, str);
      choice(study.sampleSize);
    });
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
  function structure(plan) {
    return plan?.version === 8 ? structureLegacy(plan) : structureV2(plan);
  }
  function validateV2(plan, { structural = true } = {}) {
    if (structural) { try { structureV2(plan); } catch (_) { return [{ section: 'review', key: null, code: 'structure', message: 'This plan has an unsupported structure. Keep a backup and contact the organiser.' }]; } }
    const errors = [];
    function add(key, code, loc = {}, message) { errors.push({ section: SECTION[key] || (key === 'studyQuestions' ? 'studies' : 'review'), key, code, ...loc, message: message || 'Enter the ' + (LABEL[key] || key) + (loc.study !== undefined ? ' for Study ' + (loc.study + 1) : '') + (loc.row !== undefined ? ', row ' + (loc.row + 1) : '') + '.' }); }
    const f = plan.fields || {};
    ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'background', 'goal', 'problemStatement', 'objective', 'signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (!nonblank(f[k])) add(k, 'required'); });
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (nonblank(f[k]) && !datedSignOff(f[k])) add(k, 'signoff_date', {}, 'Enter initials again for the ' + LABEL[k] + '.'); });
    ['signOffResearcher', 'signOffProjectOwner'].forEach(k => { if (nonblank(f[k]) && initialsTooLong(f[k])) add(k, 'signoff_length', {}, 'Enter ' + INITIALS_MAX + ' characters or fewer for the ' + LABEL[k] + '.'); });
    ['projectDecision', 'researchReadout'].forEach(k => { if (!isoDate(f[k])) add(k, 'date', {}, 'Enter a complete, valid ' + LABEL[k] + '.'); });
    ['declarationResearcher', 'declarationRequester'].forEach(k => { if (f[k] !== 'yes') add(k, 'declaration', {}, 'Confirm the ' + LABEL[k] + '.'); });
    function list(key, values, loc = {}) {
      if (!values?.length) add(key, 'required', { ...loc, row: 0 });
      else values.forEach((v, row) => { if (!nonblank(v)) add(key, 'required', { ...loc, row }); });
    }
    const questions = plan.lists?.researchQuestions || [], outcomes = plan.lists?.outcomes || [];
    list('researchQuestions', questions); list('outcomes', outcomes);
    for (let row = outcomes.length; row < questions.length; row++) add('outcomes', 'required', { row });
    const other = plan.selects?.otherResearchers?.v;
    if (!['Yes', 'No'].includes(other)) add('otherResearchers', 'choice', {}, 'Select whether other researchers are involved.');
    if (other === 'Yes') list('researcherNames', plan.lists?.researcherNames || []);
    else if ((plan.lists?.researcherNames || []).length) add('researcherNames', 'policy', {}, 'Remove researcher names when no other researchers are involved.');
    const covered = new Set();
    if (!plan.studies?.length) add('studyQuestions', 'required', { study: 0 }, 'Add at least one study.');
    const count = plan.selects?.studyCount;
    const expectedCount = count?.v === 'One' ? 1 : count?.v === 'Two' ? 2 : count?.v === 'Three' ? 3 :
      count?.v === '__other__' && /^\d+$/.test(count.o || '') ? Number(count.o) : 0;
    if (!expectedCount || expectedCount !== (plan.studies || []).length) add('studyQuestions', 'pairing', {}, 'Check the number of studies and their saved study groups.');
    (plan.studies || []).forEach((study, index) => {
      const seen = new Set();
      if (!study.questions.length) add('studyQuestions', 'required', { study: index }, 'Select at least one research question for Study ' + (index + 1) + '.');
      study.questions.forEach(question => {
        if (question > questions.length || seen.has(question)) add('studyQuestions', 'pairing', { study: index }, 'Check the research questions linked to Study ' + (index + 1) + '.');
        seen.add(question); covered.add(question);
      });
      ['methods', 'characteristics'].forEach(k => list(k, study[k], { study: index }));
      const c = study.sampleSize;
      if (!c || (!SAMPLE_SIZES.includes(c.v) && c.v !== '__other__')) add('sampleSize', 'choice', { study: index }, 'Select a sample size for Study ' + (index + 1) + '.');
      else if (c.v === '__other__' && !nonblank(c.o)) add('sampleSize', 'other', { study: index }, 'Enter the other sample size for Study ' + (index + 1) + '.');
      else if (c.v === '__other__' && !sampleSize(c.o)) add('sampleSize', 'other', { study: index }, 'Enter a valid sample size for Study ' + (index + 1) + '.');
    });
    questions.forEach((_, i) => { if (!covered.has(i + 1)) add('studyQuestions', 'pairing', { question: i }, 'Assign research question ' + (i + 1) + ' to at least one study.'); });
    const schedule = plan.tables?.['stageTimeline-table'] || [];
    if (!schedule.length) add('stageTimeline', 'required', { row: 0, column: 'stage' }, 'Add at least one complete schedule stage.');
    schedule.forEach((r, row) => {
      if (!STAGES.includes(r[0]?.v) && r[0]?.v !== '__other__') add('stageTimeline', 'choice', { row, column: 'stage' }, 'Choose the stage in schedule row ' + (row + 1) + '.');
      else if (r[0]?.v === '__other__' && !nonblank(r[0]?.o)) add('stageTimeline', 'other', { row, column: 'stage' }, 'Name the other stage in schedule row ' + (row + 1) + '.');
      ['startDate', 'completionDate'].forEach((column, i) => {
        const date = r[i + 1]?.v;
        if (!isoDate(date)) add('stageTimeline', 'date', { row, column }, 'Enter a complete, valid ' + (i ? 'completion' : 'start') + ' date in schedule row ' + (row + 1) + '.');
        else if (isoDate(f.researchReadout) && date > f.researchReadout) add('stageTimeline', 'bounds', { row, column }, 'Keep schedule row ' + (row + 1) + ' on or before the research readout date.');
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
  function validate(plan, options) { return plan?.version === 8 ? validateLegacy(plan, options) : validateV2(plan, options); }
  function validateForSchema(schema, plan, options) {
    if (schema === LEGACY_SCHEMA) return validateLegacy(plan, options);
    if (schema === SCHEMA) return validateV2(plan, options);
    return [{ section: 'review', key: null, code: 'structure', message: 'This plan has an unsupported structure. Keep a backup and contact the organiser.' }];
  }
  function structureForSchema(schema, plan) {
    if (schema === LEGACY_SCHEMA) return structureLegacy(plan);
    if (schema === SCHEMA) return structureV2(plan);
    throw new Error('Unsupported submission schema');
  }
  return Object.freeze({ SCHEMA, LEGACY_SCHEMA, MAX_BYTES, MAX_ENTRIES, FIELDS, CUSTOM, LEGACY_CUSTOM, SECTION, SAMPLE_SIZES, STAGES,
    project, projectLegacy, fingerprint, canonical, matchesSchema, structure, structureForSchema, validate, validateForSchema,
    isoDate, validSampleSize: sampleSize, UUID });
});
