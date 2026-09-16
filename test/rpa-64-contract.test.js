'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const contract = require('../submission-contract');
const { plan } = require('./rpa-64-fixtures.cjs');
test('complete active plan preserves strings, defaults, optional metadata and legacy excess blocks', () => {
  const p = plan();
  p.fields.background = '  Exact authored text.  ';
  p.custom.additionalContext = [{ label: 'One', body: 'First' }, { label: 'Two', body: 'Second' }];
  p.tables['previousKnowledge-table'][0][0].v = 'A name without a file';
  assert.deepEqual(contract.validate(p), []);
  assert.equal(p.fields.background, '  Exact authored text.  ');
  const legacy = plan(); delete legacy.createdAt; legacy.tables['stageTimeline-table'][0][1].v = '2020-01-01';
  assert.deepEqual(contract.validate(legacy), [], 'legacy plans do not acquire an invented start boundary');
});
test('every required scalar, every retained list row, Other and declarations block incomplete plans', () => {
  for (const key of ['researchTitle', 'jiraProject', 'leadResearcher', 'projectRequester', 'background', 'goal', 'problemStatement', 'objective', 'signOffResearcher', 'signOffProjectOwner', 'declarationResearcher', 'declarationRequester']) {
    const p = plan(); p.fields[key] = ' \t'; assert.ok(contract.validate(p).some(e => e.key === key), key);
  }
  for (const key of ['methods', 'characteristics', 'userGroups']) {
    const p = plan(); p.methods[0][key].push(' '); assert.ok(contract.validate(p).some(e => e.key === key && e.question === 0 && e.row === 1));
  }
  const p = plan(); p.methods[0].sampleSize = { v: '__other__', o: ' ' };
  assert.equal(contract.validate(p)[0].code, 'other');
  p.methods[0].sampleSize.o = '5'; assert.deepEqual(contract.validate(p), []);
});

test('Other sample sizes require positive whole counts, ordered ranges or minimums without changing the text', () => {
  for (const value of ['1', '5', '5-8', '5–8', '30+', ' 5 – 8 ', '5-5']) {
    const p = plan(); p.methods[0].sampleSize = { v: '__other__', o: value };
    assert.deepEqual(contract.validate(p), [], value);
    assert.equal(p.methods[0].sampleSize.o, value);
  }
  for (const value of ['asdf', 'Five', '5 people', '0', '-1', '2.5', '1e2', '0-5', '8-5', '5–0', '5–8–9', '9007199254740992']) {
    const p = plan(); p.methods[0].sampleSize = { v: '__other__', o: value };
    const errors = contract.validate(p);
    assert.equal(errors.length, 1, value);
    assert.deepEqual([errors[0].key, errors[0].question, errors[0].code], ['sampleSize', 0, 'other']);
    assert.match(errors[0].message, /valid sample size for research question 1/);
  }
});
test('question/outcome/method pairing never compacts or invents associations', () => {
  const p = plan(); p.lists.researchQuestions.push('Second question');
  let errors = contract.validate(p);
  assert.ok(errors.some(e => e.key === 'outcomes' && e.row === 1)); assert.ok(errors.some(e => e.code === 'pairing'));
  p.lists.outcomes.push('Second outcome', 'Additional outcome'); p.methods.push({ ...structuredClone(p.methods[0]), question: 'Second question' });
  assert.deepEqual(contract.validate(p), []);
  p.lists.outcomes[0] = ''; assert.ok(contract.validate(p).some(e => e.key === 'outcomes' && e.row === 0));
  p.methods.reverse(); assert.equal(contract.validate(p).filter(e => e.code === 'pairing').length, 2);
});

test('completed sign-offs contain initials and a real date while recovery structure permits undated initials', () => {
  for (const key of ['signOffResearcher', 'signOffProjectOwner']) {
    for (const value of ['AB', 'AB — 31/02/2026', ' — 14/09/2026']) {
      const p = plan(); p.fields[key] = value;
      assert.equal(contract.structure(p), true, 'incomplete drafts remain recoverable');
      assert.deepEqual(contract.validate(p).map(e => [e.key, e.code]), [[key, 'signoff_date']], value);
      assert.equal(p.fields[key], value, 'validation never fabricates an approval date');
    }
    const p = plan(); p.fields[key] = 'AB — 29/02/2024';
    assert.deepEqual(contract.validate(p), [], 'valid historical dates are preserved');
  }
});
test('schedule dates are real, complete, ordered and within known bounds; every retained row counts', () => {
  for (const [value, code] of [['', 'date'], ['2026-02-30', 'date'], ['2027-01-01', 'bounds']]) {
    const p = plan(); p.tables['stageTimeline-table'][0][1].v = value;
    assert.ok(contract.validate(p).some(e => e.key === 'stageTimeline' && e.column === 'startDate' && e.code === code));
  }
  const p = plan(); p.tables['stageTimeline-table'][0][1].v = '2026-10-01'; p.tables['stageTimeline-table'][0][2].v = '2026-09-30';
  assert.ok(contract.validate(p).some(e => e.code === 'range'));
  p.tables['stageTimeline-table'] = []; assert.ok(contract.validate(p).some(e => e.key === 'stageTimeline'));
});
test('optional partial blocks and meaningful references require names; dormant fields never cross collection boundary', () => {
  const draft = plan(); draft.fields.hypothesis = 'DORMANT'; draft.tables.requirements = [[{ t: 'text', v: 'DORMANT' }]];
  draft.custom.additionalContext = [{ label: '', body: '' }, { label: '', body: 'Keep me' }];
  const p = contract.project(draft);
  assert.equal(JSON.stringify(p).includes('DORMANT'), false); assert.equal(draft.fields.hypothesis, 'DORMANT');
  assert.equal(p.custom.additionalContext.length, 1); assert.ok(contract.validate(p).some(e => e.key === 'additionalContext' && e.column === 'label'));
  p.tables['previousKnowledge-table'][0][1].n = 'reference.pdf';
  assert.ok(contract.validate(p).some(e => e.key === 'previousKnowledge'));
});
test('structure rejects unknown, prototype, nested, oversized and forged properties', () => {
  const changes = [p => { p.deleteAfter = '2099-01-01'; }, p => { p.fields.unknown = 'x'; }, p => { p.fields.background = {}; },
    p => { p.lists.outcomes = Array(501).fill('x'); }, p => { p.methods[0].complete = true; },
    p => { p.tables['stageTimeline-table'][0].push({ t: 'text', v: '' }); }, p => { p.fields = JSON.parse('{"__proto__":"x"}'); },
    p => { p.savedAt = '2026-02-30T12:00:00.000Z'; }];
  for (const change of changes) { const p = plan(); change(p); assert.equal(contract.validate(p)[0].code, 'structure'); }
});
test('fingerprint ignores capture/navigation/automatic stamps but notices authored edits', () => {
  const p = plan(), first = contract.fingerprint(p);
  p.savedAt = '2026-09-15T00:00:00.000Z'; p.fields.lastUpdated = '2026-09-15'; p.ui.timelineVisible = true;
  p.fields.signOffResearcher = 'AB — 15/09/2026';
  assert.equal(contract.fingerprint(p), first);
  p.fields.background += ' changed'; assert.notEqual(contract.fingerprint(p), first);
});
