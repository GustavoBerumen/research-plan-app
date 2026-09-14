'use strict';

// RPA-98, the server side. POST /api/feedback appends one record per
// submission to feedback-data.jsonl, in every mode: feedback on the tool is
// the one record a pilot exists to collect. Answers are trimmed and capped,
// the score must be 1 to 5, an empty submission is refused, and nothing from
// the plan is stored beyond its name, the section and the build.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadServer } = require('./rpa-89-server-harness.cjs');

const body = (extra = {}) => JSON.stringify(Object.assign({ tryingTo: '  Plan a study.  ', inTheWay: '', changeFirst: 'Fewer pages.', usefulness: 4, plan: 'Checkout study', section: 'review', build: 'abc1234' }, extra));

test('pilot and non-pilot modes both accept feedback and append one line per submission', async () => {
  for (const pilot of ['true', 'false']) {
    const app = loadServer({ pilot });
    const config = JSON.parse((await app.request('/api/config')).body);
    assert.equal(config.capabilities.feedback, true, 'advertised in pilot mode ' + pilot);
    const result = await app.request('/api/feedback', 'POST', body());
    assert.equal(result.status, 200, result.body);
    assert.deepEqual(app.writes.map((w) => w.name), ['appendFile']);
    const [file, line] = app.writes[0].args;
    assert.match(String(file), /feedback-data\.jsonl$/);
    assert.ok(line.endsWith('\n'), 'one line per submission');
    const record = JSON.parse(line);
    assert.deepEqual(record, { tryingTo: 'Plan a study.', inTheWay: '', changeFirst: 'Fewer pages.', usefulness: 4, plan: 'Checkout study', section: 'review', build: 'abc1234', savedAt: record.savedAt });
    assert.match(record.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test('an empty submission, an answer over the cap, a score off the scale and a bad body are refused without writing', async () => {
  const app = loadServer({ pilot: 'true' });
  assert.equal((await app.request('/api/feedback', 'POST', JSON.stringify({ tryingTo: '', usefulness: null }))).status, 400, 'nothing to send');
  assert.equal((await app.request('/api/feedback', 'POST', body({ inTheWay: 'x'.repeat(2001) }))).status, 400, 'over the cap');
  const offScale = await app.request('/api/feedback', 'POST', JSON.stringify({ usefulness: 6 }));
  assert.equal(offScale.status, 400, 'a score off the scale counts as no score, and nothing else was answered');
  assert.equal((await app.request('/api/feedback', 'POST', '{bad')).status, 400, 'bad JSON');
  assert.deepEqual(app.writes, [], 'nothing written');
  const fine = await app.request('/api/feedback', 'POST', JSON.stringify({ usefulness: 5 }));
  assert.equal(fine.status, 200, 'a score alone is an answer');
  assert.equal(JSON.parse(app.writes[0].args[1]).usefulness, 5);
});

test('the record keeps only what a reader needs: no plan content, names capped', async () => {
  const app = loadServer({ pilot: 'true' });
  const result = await app.request('/api/feedback', 'POST', body({ background: 'Plan content that must not be stored', plan: 'p'.repeat(300), extra: 'ignored' }));
  assert.equal(result.status, 200);
  const record = JSON.parse(app.writes[0].args[1]);
  assert.equal('background' in record, false);
  assert.equal('extra' in record, false);
  assert.equal(record.plan.length, 200);
});
