#!/usr/bin/env node
'use strict';

// Operator-only CLI: this file is never a public asset or HTTP route.
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { createR2Store } = require('../r2-submission-store');
const { namespace, UUID } = require('../submissions-server');
const ops = require('../submission-operations');

const HELP = `Private plan submissions (explicit RPA_R2_* and RPA_SUBMISSIONS_* environment required)
  node scripts/submissions.cjs init-cohort
  node scripts/submissions.cjs cohort
  node scripts/submissions.cjs pause-cohort
  node scripts/submissions.cjs resume-cohort
  node scripts/submissions.cjs list
  node scripts/submissions.cjs export-record UUID NEW_FILE.json
  node scripts/submissions.cjs export-plan UUID NEW_FILE.json
  node scripts/submissions.cjs backup NEW_FILE.rpa-encrypted
  node scripts/submissions.cjs journal NEW_FILE.rpa-encrypted
  node scripts/submissions.cjs delete UUID NEW_JOURNAL.rpa-encrypted
  node scripts/submissions.cjs close-cohort FINAL_SESSION_UTC NEW_JOURNAL.rpa-encrypted
  node scripts/submissions.cjs purge-expired NEW_JOURNAL.rpa-encrypted
  node scripts/submissions.cjs recover BACKUP.rpa-encrypted LATEST_JOURNAL.rpa-encrypted
Encrypted exports require RPA_BACKUP_PASSPHRASE (separate, at least 20 characters).
Pause, resume, close, backup, journal, deletion, purge and recovery require RPA_SUBMISSIONS_MAINTENANCE=true:
first disable acceptance, drain in-flight sends for at least 75 seconds and stop other operator writes.
Files are created exclusively, read back and hashed. Existing files are never replaced.
export-plan creates an importable plan backup; export-record includes the operator envelope.
See SUBMISSIONS.md for credential separation, notice, retention and independent-copy procedures.`;

async function writeVerified(filename, text) {
  if (!filename) throw new Error('A new output filename is required.');
  await fs.writeFile(filename, text, { flag: 'wx', mode: 0o600 });
  const saved = await fs.readFile(filename);
  if (!saved.equals(Buffer.from(text))) throw new Error('Saved-file verification failed.');
  return { file: filename, bytes: saved.length, sha256: crypto.createHash('sha256').update(saved).digest('hex') };
}
async function main(args = process.argv.slice(2), env = process.env, suppliedStore) {
  const [command, first, second] = args;
  if (!command || ['help', '--help'].includes(command)) return HELP;
  const arity = { 'init-cohort': 1, cohort: 1, 'pause-cohort': 1, 'resume-cohort': 1, list: 1, 'export-record': 3, 'export-plan': 3, backup: 2, journal: 2, delete: 3, 'close-cohort': 3, 'purge-expired': 2, recover: 3 };
  if (arity[command] !== args.length) throw new Error('Unknown command or wrong arguments. Use --help.');
  const config = { ...namespace(env), collectionPolicyVersion: env.RPA_SUBMISSIONS_POLICY_VERSION, notice: env.RPA_SUBMISSIONS_NOTICE };
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(config.collectionPolicyVersion || '') || typeof config.notice !== 'string' || config.notice.trim().length < 40) throw new Error('Approved collection policy configuration is required.');
  const maintenance = ['pause-cohort', 'resume-cohort', 'close-cohort', 'backup', 'journal', 'delete', 'purge-expired', 'recover'];
  if (maintenance.includes(command) && env.RPA_SUBMISSIONS_MAINTENANCE !== 'true') throw new Error('Disable acceptance and other operator writes, drain in-flight work, then set RPA_SUBMISSIONS_MAINTENANCE=true.');
  const encrypted = ['backup', 'journal', 'delete', 'close-cohort', 'purge-expired', 'recover'].includes(command);
  if (encrypted && (!env.RPA_BACKUP_PASSPHRASE || env.RPA_BACKUP_PASSPHRASE.length < 20)) throw new Error('An independent backup passphrase is required before changing retention or deleting.');
  const store = suppliedStore || createR2Store(env);
  const journal = async filename => writeVerified(filename, ops.encryptBundle(await ops.exportBundle(store, config, { journalOnly: true }), env.RPA_BACKUP_PASSPHRASE));
  switch (command) {
    case 'init-cohort': return ops.initialiseCohort(store, config);
    case 'cohort': return (await ops.readCohort(store, config)).value;
    case 'pause-cohort': return ops.setCollectionOpen(store, config, false);
    case 'resume-cohort': return ops.setCollectionOpen(store, config, true);
    case 'list': {
      const rows = [];
      for await (const key of store.keys(config.prefix + 'submissions/')) {
        const id = key.slice((config.prefix + 'submissions/').length).replace(/\.json$/, '');
        if (!UUID.test(id)) throw new Error('Unexpected submission key.');
        const value = (await store.get(key))?.value;
        if (value?.recordType === 'research-plan-deletion' || await store.get(config.prefix + `deletions/${id}.json`)) continue;
        const record = await ops.retrieve(store, config, id);
        rows.push({ submissionId: id, submittedAt: record.submittedAt, contentSha256: record.contentSha256 });
      }
      return rows;
    }
    case 'export-record': case 'export-plan': {
      const record = await ops.retrieve(store, config, first);
      return writeVerified(second, JSON.stringify(command === 'export-plan' ? record.plan : record, null, 2) + '\n');
    }
    case 'backup': return writeVerified(first, ops.encryptBundle(await ops.exportBundle(store, config), env.RPA_BACKUP_PASSPHRASE));
    case 'journal': return journal(first);
    case 'delete': await ops.removeSubmission(store, config, first); return journal(second);
    case 'close-cohort': await ops.closeCohort(store, config, first); return journal(second);
    case 'purge-expired': { const count = await ops.purgeExpired(store, config); return { count, journal: await journal(first) }; }
    case 'recover': return ops.recover(store, config,
      ops.decryptBundle(await fs.readFile(first, 'utf8'), env.RPA_BACKUP_PASSPHRASE),
      ops.decryptBundle(await fs.readFile(second, 'utf8'), env.RPA_BACKUP_PASSPHRASE));
  }
}
if (require.main === module) main().then(result => console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))).catch(() => {
  // SDK errors and paths may contain secrets or authored text. Keep stdout and logs bounded.
  console.error('The operation was not confirmed. Check configuration and arguments against --help. After a deletion/retention error, repeat the same operation with a new journal filename before resuming acceptance.');
  process.exitCode = 1;
});
module.exports = { main, writeVerified };
