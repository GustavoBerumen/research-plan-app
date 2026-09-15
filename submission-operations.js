'use strict';

const crypto = require('node:crypto');
const { UUID, verifyRecord, retentionDeadline, validCohort } = require('./submissions-server');
const contract = require('./submission-contract');
const clone = value => JSON.parse(JSON.stringify(value));
const requireId = id => { if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Use a submission UUID.'); };
const submissionKey = (config, id) => config.prefix + `submissions/${id}.json`;
const deletionKey = (config, id) => config.prefix + `deletions/${id}.json`;
const tombstoneValid = (value, config) => value && value.recordType === 'research-plan-deletion' && value.recordVersion === 1 &&
  UUID.test(value.submissionId) && value.deployment === config.deployment && value.cohort === config.cohort &&
  typeof value.deletedAt === 'string' && Number.isFinite(Date.parse(value.deletedAt)) &&
  Object.keys(value).every(k => ['recordType', 'recordVersion', 'submissionId', 'deployment', 'cohort', 'deletedAt'].includes(k));

async function readCohort(store, config) {
  const entry = await store.get(config.prefix + 'cohort.json');
  if (!entry || !validCohort(entry.value, config)) throw new Error('The cohort metadata is missing or incompatible.');
  return entry;
}
async function initialiseCohort(store, config) {
  const value = { recordType: 'research-plan-cohort', recordVersion: 1, deployment: config.deployment, cohort: config.cohort,
    collectionPolicyVersion: config.collectionPolicyVersion, notice: config.notice, collectionOpen: true, finalSessionAt: null, deleteAfter: null };
  if (!await store.put(config.prefix + 'cohort.json', value, { absent: true })) throw new Error('The cohort already exists; it was not changed.');
  const saved = await readCohort(store, config);
  if (contract.canonical(saved.value) !== contract.canonical(value)) throw new Error('Cohort creation is unconfirmed.');
  return value;
}
async function closeCohort(store, config, finalSessionAt, now = Date.now()) {
  const deleteAfter = retentionDeadline(finalSessionAt);
  if (Date.parse(finalSessionAt) > now) throw new Error('The final session must have finished before recording its time.');
  const entry = await readCohort(store, config);
  if (entry.value.finalSessionAt && entry.value.finalSessionAt !== finalSessionAt) throw new Error('The recorded final session cannot be silently changed.');
  const value = { ...entry.value, collectionOpen: false, finalSessionAt, deleteAfter };
  if (!await store.put(config.prefix + 'cohort.json', value, { etag: entry.etag })) throw new Error('Cohort changed; read it again before closing.');
  if (contract.canonical((await readCohort(store, config)).value) !== contract.canonical(value)) throw new Error('Cohort close is unconfirmed.');
  return value;
}
async function setCollectionOpen(store, config, open) {
  const entry = await readCohort(store, config);
  if (open && entry.value.finalSessionAt !== null) throw new Error('A finished cohort cannot resume collection.');
  const value = { ...entry.value, collectionOpen: open };
  if (!await store.put(config.prefix + 'cohort.json', value, { etag: entry.etag })) throw new Error('Cohort changed. Repeat after checking metadata.');
  if (contract.canonical((await readCohort(store, config)).value) !== contract.canonical(value)) throw new Error('Collection change is unconfirmed.');
  return value;
}
async function retrieve(store, config, id) {
  requireId(id);
  if (await store.get(deletionKey(config, id))) throw new Error('This submission was deleted.');
  const entry = await store.get(submissionKey(config, id));
  if (!entry || !verifyRecord(entry.value, config) || entry.value.submissionId !== id) throw new Error('Submission missing, deleted or invalid.');
  const cohort = await readCohort(store, config);
  if (cohort.value.deleteAfter && Date.now() >= Date.parse(cohort.value.deleteAfter)) throw new Error('Retention has expired. Run deletion before further export.');
  return entry.value;
}
async function applyDeletion(store, config, tombstone) {
  if (!tombstoneValid(tombstone, config)) throw new Error('Invalid deletion journal entry.');
  const id = tombstone.submissionId, journalKey = deletionKey(config, id), key = submissionKey(config, id);
  // Journal first. A failed tombstone replacement can be resumed without losing intent.
  await store.put(journalKey, tombstone, { absent: true });
  const journal = await store.get(journalKey);
  if (!journal || !tombstoneValid(journal.value, config) || journal.value.submissionId !== id) throw new Error('Deletion journal is unconfirmed.');
  for (let attempts = 0; attempts < 8; attempts++) {
    const current = await store.get(key);
    if (current && contract.canonical(current.value) === contract.canonical(journal.value)) return journal.value;
    if (await store.put(key, journal.value, current ? { etag: current.etag } : { absent: true })) {
      const saved = await store.get(key);
      if (saved && contract.canonical(saved.value) === contract.canonical(journal.value)) return journal.value;
      throw new Error('Deletion read-back is unconfirmed. Repeat deletion with the same reference.');
    }
  }
  throw new Error('Submission changed during deletion. Repeat deletion with the same reference.');
}
async function removeSubmission(store, config, id, now = Date.now()) {
  requireId(id);
  return applyDeletion(store, config, { recordType: 'research-plan-deletion', recordVersion: 1, submissionId: id,
    deployment: config.deployment, cohort: config.cohort, deletedAt: new Date(now).toISOString() });
}
async function purgeExpired(store, config, now = Date.now()) {
  const cohort = (await readCohort(store, config)).value;
  if (cohort.collectionOpen || !cohort.deleteAfter || now < Date.parse(cohort.deleteAfter)) throw new Error('Close the cohort and wait for its retention deadline before purging.');
  let count = 0;
  for await (const key of store.keys(config.prefix + 'submissions/')) {
    const id = key.slice((config.prefix + 'submissions/').length).replace(/\.json$/, '');
    requireId(id); await removeSubmission(store, config, id, now); count++;
  }
  return count;
}
async function exportBundle(store, config, { journalOnly = false, now = Date.now() } = {}) {
  const cohort = clone((await readCohort(store, config)).value), records = [], deletions = [];
  if (!journalOnly && cohort.deleteAfter && now >= Date.parse(cohort.deleteAfter)) throw new Error('Retention has expired; export the deletion journal only.');
  for await (const key of store.keys(config.prefix + 'deletions/')) {
    const entry = await store.get(key);
    if (!entry || !tombstoneValid(entry.value, config) || key !== deletionKey(config, entry.value.submissionId)) throw new Error('Invalid deletion journal.');
    deletions.push(entry.value);
  }
  const deleted = new Set(deletions.map(d => d.submissionId));
  if (!journalOnly) for await (const key of store.keys(config.prefix + 'submissions/')) {
    const entry = await store.get(key);
    if (!entry) throw new Error('Incomplete storage listing. Repeat export.');
    if (deleted.has(entry.value.submissionId) || tombstoneValid(entry.value, config)) continue;
    if (!verifyRecord(entry.value, config) || key !== submissionKey(config, entry.value.submissionId)) throw new Error('Invalid stored submission.');
    records.push(entry.value);
  }
  return { recordType: 'research-plan-export', recordVersion: 1, deployment: config.deployment, cohort: config.cohort,
    exportedAt: new Date(now).toISOString(), journalOnly, cohortMetadata: cohort, records, deletions };
}
function validateBundle(bundle, config, journalOnly) {
  if (!bundle || bundle.recordType !== 'research-plan-export' || bundle.recordVersion !== 1 || bundle.deployment !== config.deployment ||
      bundle.cohort !== config.cohort || bundle.journalOnly !== journalOnly || !validCohort(bundle.cohortMetadata, config) ||
      !Array.isArray(bundle.records) || !Array.isArray(bundle.deletions) || (journalOnly && bundle.records.length) ||
      typeof bundle.exportedAt !== 'string' || !Number.isFinite(Date.parse(bundle.exportedAt))) throw new Error('Incompatible recovery export.');
  const ids = new Set();
  for (const record of bundle.records) {
    if (!verifyRecord(record, config) || ids.has(record.submissionId)) throw new Error('Invalid or duplicate recovery record.');
    ids.add(record.submissionId);
  }
  ids.clear();
  for (const tombstone of bundle.deletions) {
    if (!tombstoneValid(tombstone, config) || ids.has(tombstone.submissionId)) throw new Error('Invalid or duplicate deletion entry.');
    ids.add(tombstone.submissionId);
  }
}
async function recover(store, config, backup, latestJournal, now = Date.now()) {
  validateBundle(backup, config, false); validateBundle(latestJournal, config, true);
  if (Date.parse(latestJournal.exportedAt) < Date.parse(backup.exportedAt)) throw new Error('Recovery needs a deletion journal at least as recent as the backup.');
  const live = await store.get(config.prefix + 'cohort.json');
  if (live && (!validCohort(live.value, config) || live.value.collectionOpen)) throw new Error('Acceptance must be closed before recovery.');
  // A paused target may predate an independently recorded close-out. Reconcile
  // every known deadline before any write; recovery must never erase finality.
  const histories = [backup.cohortMetadata, latestJournal.cohortMetadata, live?.value].filter(Boolean);
  const finished = histories.filter(value => value.finalSessionAt !== null);
  if (new Set(finished.map(value => value.finalSessionAt)).size > 1) throw new Error('Conflicting cohort close-out dates. Reconcile them before recovery.');
  const cohort = { ...(live?.value || latestJournal.cohortMetadata), collectionOpen: false };
  if (finished.length) {
    cohort.finalSessionAt = finished[0].finalSessionAt;
    cohort.deleteAfter = finished[0].deleteAfter;
  }
  if (cohort.deleteAfter && now >= Date.parse(cohort.deleteAfter)) throw new Error('Expired plans cannot be recovered.');
  if (!live || contract.canonical(live.value) !== contract.canonical(cohort)) {
    if (!await store.put(config.prefix + 'cohort.json', cohort, live ? { etag: live.etag } : { absent: true })) throw new Error('Cohort changed during recovery. Start again.');
    if (contract.canonical((await readCohort(store, config)).value) !== contract.canonical(cohort)) throw new Error('Recovery cohort read-back is unconfirmed.');
  }
  const journal = new Map([...backup.deletions, ...latestJournal.deletions].map(d => [d.submissionId, d]));
  for await (const key of store.keys(config.prefix + 'deletions/')) {
    const entry = await store.get(key);
    if (!entry || !tombstoneValid(entry.value, config) || key !== deletionKey(config, entry.value.submissionId)) throw new Error('Invalid live deletion journal.');
    journal.set(entry.value.submissionId, entry.value);
  }
  for (const value of journal.values()) await applyDeletion(store, config, value);
  let restored = 0, skipped = 0;
  for (const record of backup.records) {
    if (journal.has(record.submissionId)) { skipped++; continue; }
    const key = submissionKey(config, record.submissionId);
    await store.put(key, record, { absent: true });
    const actual = await store.get(key);
    if (!actual || !verifyRecord(actual.value, config) || contract.canonical(actual.value) !== contract.canonical(record)) throw new Error('Recovery conflict or unconfirmed write. No existing record was overwritten.');
    restored++;
  }
  return { verified: restored, deletedSkipped: skipped };
}
function encryptionKey(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 20) throw new Error('Use a separate backup passphrase of at least 20 characters.');
  return crypto.scryptSync(passphrase, salt, 32);
}
function encryptBundle(bundle, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()]);
  return JSON.stringify({ format: 'rpa-encrypted-export-v1', salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }) + '\n';
}
function decryptBundle(text, passphrase) {
  if (Buffer.byteLength(text) > 96 * 1024 * 1024) throw new Error('Recovery export exceeds the pilot utility limit.');
  const value = JSON.parse(text);
  if (value.format !== 'rpa-encrypted-export-v1' || !['salt', 'iv', 'tag', 'ciphertext'].every(k => typeof value[k] === 'string')) throw new Error('Invalid encrypted export.');
  const salt = Buffer.from(value.salt, 'base64'), iv = Buffer.from(value.iv, 'base64'), tag = Buffer.from(value.tag, 'base64');
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid encryption header.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
module.exports = { initialiseCohort, closeCohort, setCollectionOpen, readCohort, retrieve, removeSubmission, purgeExpired, exportBundle, recover, encryptBundle, decryptBundle, validateBundle, tombstoneValid };
