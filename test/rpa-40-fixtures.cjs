'use strict';

function realisticBackup() {
  const draft = structuredClone(require('./fixtures/rpa-78-pre-change.json').draft);
  draft.fields.researchTitle = 'Hábitos de compra — 東京 🧭\nSecond line';
  draft.fields.background = 'First line\nSecond paragraph: colour, café and behaviour.';
  draft.fields.researchReadout = '2026-10-30';
  draft.fields.lastUpdated = '2026-08-29';
  draft.lastUpdatedManual = true;
  draft.createdAt = '2026-08-01';
  draft.lists.researchQuestions = ['Which delivery details matter?', '', 'How do people compare options?'];
  draft.lists.outcomes = ['Prioritised delivery details.\nWith evidence.', '', 'Comparison map.'];
  draft.methods = [
    { question: draft.lists.researchQuestions[0], methods: ['Interviews', 'Usability testing'] },
    { question: '', methods: ['Unassigned notes'] },
    { question: draft.lists.researchQuestions[2], methods: ['Diary study', 'Observation'] },
  ];
  draft.selects.sampleSize = { v: '__other__', o: 'Two cohorts of eight — ocho' };
  draft.tables['stageTimeline-table'][1][0] = { t: 'select', v: '__other__', o: 'Recruitment follow-up' };
  draft.tables['actionPoints-table'] = [
    [{ t: 'text', v: 'Review findings\nAgree next steps' }, { t: 'text', v: 'Ana' }, { t: 'text', v: '' }],
    [{ t: 'text', v: 'Share a summary' }, { t: 'text', v: 'Max' }, { t: 'text', v: '' }],
  ];
  draft.tables['previousKnowledge-table'][0] = [
    { t: 'text', v: 'Previous study\nReference only' },
    { t: 'file', v: '/uploads/previous-study.pdf', n: 'Previous study.pdf' },
    { t: 'text', v: '' },
  ];
  draft.custom.additionalResources = [{ label: 'Accessibilité', body: 'Screen readers\nKeyboard use' }, { label: 'Notes', body: 'Preserve this too.' }];
  draft.fields.project = 'Dormant project — never discard';
  draft.selects.dormantChoice = { v: '__other__', o: 'Archived choice' };
  draft.lists.dormantList = ['First', '', 'Third'];
  draft.tables['requirements-table'] = [[{ t: 'text', v: 'Two phones' }, { t: 'file', v: '/uploads/spec.pdf', n: 'Spec.pdf' }]];
  draft.custom.dormantSections = [{ label: 'Archived', body: 'Dormant details' }];
  return draft;
}

function smallBackup() {
  return { version: 7, createdAt: '2026-08-15', fields: { researchTitle: 'A smaller plan', background: 'New context', lastUpdated: '2026-09-01' },
    lists: { researchQuestions: ['One question?'], outcomes: ['One outcome.'] },
    methods: [{ question: 'One question?', methods: ['Interviews'] }],
    selects: {}, tables: {}, custom: {}, ui: { timelineVisible: false }, lastUpdatedManual: false };
}

module.exports = { realisticBackup, smallBackup };
