'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const { bootApp, waitFor } = require('./app-harness');
const { main } = require('../scripts/submissions.cjs');
const ops = require('../submission-operations');
const f = require('./rpa-64-fixtures.cjs');
const config = { ...f.config, prefix: f.prefix }, PASSPHRASE = 'synthetic-independent-backup-passphrase';
async function populated() {
  const store = f.memoryStore();
  const result = await loadServer({ env: f.env, submissionStore: store }).request('/api/submissions', 'POST', JSON.stringify(f.request()), { 'content-type': 'application/json' });
  assert.equal(result.status, 201); return store;
}
test('cohort policy must be durable, closes at final session plus 28 days, and cannot silently move that deadline', async () => {
  const store = f.memoryStore(); store.objects.clear();
  await ops.initialiseCohort(store, config); await assert.rejects(ops.initialiseCohort(store, config), /already exists/);
  await ops.setCollectionOpen(store, config, false); await ops.setCollectionOpen(store, config, true);
  const closed = await ops.closeCohort(store, config, '2026-09-14T12:00:00.000Z', Date.parse('2026-09-14T13:00:00.000Z'));
  assert.equal(closed.deleteAfter, '2026-10-12T12:00:00.000Z'); assert.equal(closed.collectionOpen, false);
  await assert.rejects(ops.setCollectionOpen(store, config, true), /finished cohort/);
  await assert.rejects(ops.closeCohort(store, config, '2026-09-13T12:00:00.000Z'), /silently changed/);
});
test('interrupted deletion writes the journal first and resumes to a content-free tombstone', async () => {
  const store = await populated(), put = store.put.bind(store);
  let fail = true;
  store.put = async (key, ...args) => { if (fail && key.includes('/submissions/')) { fail = false; throw new Error('Interrupted'); } return put(key, ...args); };
  await assert.rejects(ops.removeSubmission(store, config, f.ID), /Interrupted/);
  assert.ok(store.objects.has(f.prefix + `deletions/${f.ID}.json`));
  await assert.rejects(ops.retrieve(store, config, f.ID), /deleted/);
  await ops.removeSubmission(store, config, f.ID);
  const tombstone = store.objects.get(f.prefix + `submissions/${f.ID}.json`).value;
  assert.equal(tombstone.plan, undefined); assert.equal(tombstone.contentSha256, undefined); assert.equal(ops.tombstoneValid(tombstone, config), true);
});
test('encrypted independent backup recovery replays newer deletions and preserves existing records without overwrites', async () => {
  const source = await populated();
  const backup = await ops.exportBundle(source, config, { now: Date.parse('2026-09-14T12:00:00.000Z') });
  const encrypted = ops.encryptBundle(backup, PASSPHRASE);
  assert.equal(encrypted.includes('Synthetic'), false); assert.deepEqual(ops.decryptBundle(encrypted, PASSPHRASE), backup);
  await ops.removeSubmission(source, config, f.ID);
  const journal = await ops.exportBundle(source, config, { journalOnly: true, now: Date.parse('2026-09-14T13:00:00.000Z') });
  const restored = f.memoryStore(); restored.objects.clear();
  assert.deepEqual(await ops.recover(restored, config, backup, journal), { verified: 0, deletedSkipped: 1 });
  assert.equal(restored.objects.get(f.prefix + `submissions/${f.ID}.json`).value.recordType, 'research-plan-deletion');
  assert.equal(restored.objects.get(f.prefix + 'cohort.json').value.collectionOpen, false);
  const clean = f.memoryStore(); clean.objects.clear();
  const emptyJournal = { ...journal, deletions: [] };
  assert.deepEqual(await ops.recover(clean, config, backup, emptyJournal), { verified: 1, deletedSkipped: 0 });
  assert.deepEqual(await ops.recover(clean, config, backup, emptyJournal), { verified: 1, deletedSkipped: 0 });
  assert.deepEqual(clean.objects.get(f.prefix + `submissions/${f.ID}.json`).value, backup.records[0]);
  const corrupt = structuredClone(backup); corrupt.records[0].plan.fields.background = 'corruption';
  await assert.rejects(ops.recover(clean, config, corrupt, emptyJournal), /Invalid/);
});
test('missing/latest-journal checks, bad encryption, live collection and expired retention prevent unsafe recovery', async () => {
  const source = await populated(); const backup = await ops.exportBundle(source, config);
  const journal = await ops.exportBundle(source, config, { journalOnly: true });
  await assert.rejects(ops.recover(source, config, backup, journal), /closed/);
  await ops.setCollectionOpen(source, config, false);
  await assert.rejects(ops.recover(source, config, backup, { ...journal, exportedAt: '2020-01-01T00:00:00.000Z' }), /recent/);
  const encrypted = ops.encryptBundle(backup, PASSPHRASE);
  assert.throws(() => ops.decryptBundle(encrypted, PASSPHRASE + '-wrong'));
  assert.throws(() => ops.decryptBundle(encrypted.slice(0, -5), PASSPHRASE));
  const c = source.objects.get(f.prefix + 'cohort.json').value; c.finalSessionAt = '2020-01-01T00:00:00.000Z'; c.deleteAfter = '2020-01-29T00:00:00.000Z';
  await assert.rejects(ops.recover(source, config, backup, journal), /Expired/);
  await assert.rejects(ops.exportBundle(source, config), /expired/);
  assert.equal(await ops.purgeExpired(source, config), 1);
  assert.equal(source.objects.get(f.prefix + `submissions/${f.ID}.json`).value.recordType, 'research-plan-deletion');
});
test('operator exports are real verified files; the plan export restores through the existing backup UI', async t => {
  const store = await populated(); const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rpa64-export-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const filename = path.join(temp, 'synthetic-plan.json');
  const result = await main(['export-plan', f.ID, filename], f.env, store);
  const text = await fs.readFile(filename, 'utf8');
  assert.equal(result.sha256, crypto.createHash('sha256').update(text).digest('hex')); assert.equal(result.bytes, Buffer.byteLength(text));
  await assert.rejects(main(['export-plan', f.ID, filename], f.env, store), /EEXIST/);
  const app = await bootApp(); t.after(() => app.close());
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [new app.window.File([text], 'synthetic-plan.json', { type: 'application/json' })] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => app.document.getElementById('backup-status').textContent.startsWith('Backup restored and saved'));
  assert.equal(app.document.querySelector('[data-field="researchTitle"]').value, f.plan().fields.researchTitle);
  assert.equal(app.document.querySelector('[data-field="declarationResearcher"]').checked, true);
  const encryptedFile = path.join(temp, 'synthetic-backup.rpa-encrypted');
  const env = { ...f.env, RPA_SUBMISSIONS_MAINTENANCE: 'true', RPA_BACKUP_PASSPHRASE: PASSPHRASE };
  const saved = await main(['backup', encryptedFile], env, store);
  const bytes = await fs.readFile(encryptedFile); assert.equal(saved.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(ops.decryptBundle(bytes.toString(), PASSPHRASE).records.length, 1);
});
test('operator maintenance and passphrase requirements run before storage changes', async () => {
  const store = f.memoryStore();
  await assert.rejects(main(['delete', f.ID, 'new-journal'], f.env, store), /Disable acceptance/);
  await assert.rejects(main(['delete', f.ID, 'new-journal'], { ...f.env, RPA_SUBMISSIONS_MAINTENANCE: 'true' }, store), /passphrase/);
  assert.equal(store.calls.length, 0);
});

async function recoveryHistory() {
  const source = f.memoryStore();
  const response = await loadServer({ env: f.env, submissionStore: source }).request('/api/submissions', 'POST', JSON.stringify(f.request()), { 'content-type': 'application/json' });
  assert.equal(response.status, 201);
  const backup = await ops.exportBundle(source, config, { now: Date.parse('2026-09-14T12:00:00.000Z') });
  await ops.closeCohort(source, config, '2026-09-15T12:00:00.000Z', Date.parse('2026-09-15T13:00:00.000Z'));
  const journal = await ops.exportBundle(source, config, { journalOnly: true, now: Date.parse('2026-09-15T13:00:00.000Z') });
  const target = f.memoryStore();
  await ops.setCollectionOpen(target, config, false);
  target.calls.length = 0;
  return { backup, journal, target };
}
test('recovery refuses expired independent close-out even when live target metadata is older', async () => {
  const { backup, journal, target } = await recoveryHistory();
  await assert.rejects(ops.recover(target, config, backup, journal, Date.parse('2026-10-14T12:00:00.000Z')), /Expired/);
  assert.equal(target.calls.filter(call => call[0] === 'put').length, 0);
  assert.equal(target.objects.has(f.prefix + `submissions/${f.ID}.json`), false);
});
test('recovery preserves independent close-out in a paused target and cannot resume the finished cohort', async () => {
  const { backup, journal, target } = await recoveryHistory();
  assert.deepEqual(await ops.recover(target, config, backup, journal, Date.parse('2026-09-16T12:00:00.000Z')), { verified: 1, deletedSkipped: 0 });
  const actual = (await ops.readCohort(target, config)).value;
  assert.equal(actual.finalSessionAt, journal.cohortMetadata.finalSessionAt);
  assert.equal(actual.deleteAfter, journal.cohortMetadata.deleteAfter);
  assert.equal(actual.collectionOpen, false);
  await assert.rejects(ops.setCollectionOpen(target, config, true), /finished cohort/);
});
test('recovery refuses conflicting close-out dates across backup, independent journal and live metadata', async () => {
  for (const location of ['backup', 'live']) {
    const { backup, journal, target } = await recoveryHistory();
    const earlier = { finalSessionAt: '2026-09-14T12:00:00.000Z', deleteAfter: '2026-10-12T12:00:00.000Z', collectionOpen: false };
    Object.assign(location === 'backup' ? backup.cohortMetadata : target.objects.get(f.prefix + 'cohort.json').value, earlier);
    await assert.rejects(ops.recover(target, config, backup, journal, Date.parse('2026-09-16T12:00:00.000Z')), /Conflicting/);
    assert.equal(target.calls.filter(call => call[0] === 'put').length, 0);
  }
});
