'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const { referenceBackup } = require('./rpa-41-fixtures.cjs');
const disabled = { uploads: false, googleDrive: false, jira: false, calibration: false, addFramework: false };
const response = data => ({ ok: true, json: async () => data });
const pilot = () => response({ pilotMode: true, capabilities: disabled });
const stored = app => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
const status = app => app.document.getElementById('backup-status').textContent;

async function restore(app, draft) {
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [new app.window.File([JSON.stringify(draft)], 'synthetic.json')] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled);
  assert.match(status(app), /^Backup restored and saved/);
}

async function backup(app) {
  let blob;
  app.window.URL.createObjectURL = value => { blob = value; return 'blob:synthetic'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = () => {};
  app.document.getElementById('download-backup-btn').click();
  assert.ok(blob, status(app));
  return JSON.parse(await new Promise(resolve => {
    const reader = new app.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  }));
}

function assertRestricted(app) {
  assert.doesNotMatch(app.document.querySelector('#previousKnowledge-table').closest('.field').querySelector('.field-hint-text').textContent, /attached for reference/);
  for (const action of app.document.querySelectorAll('.file-add-btn,.file-menu-item,.file-native')) {
    assert.equal(action.disabled, true);
    if (action.type !== 'file') assert.equal(action.hidden, true);
  }
  for (const cell of app.document.querySelectorAll('.file-cell')) {
    assert.equal(cell.querySelector('a'), null);
    assert.match(cell.textContent, /Attachment contents are unavailable through this app/);
    assert.doesNotMatch(cell.querySelector('.file-name').textContent, /^No file chosen$/);
  }
}

for (const [name, configResponse] of [
  ['pilot', pilot], ['pending', () => new Promise(() => {})],
  ['failed', () => { throw new Error('Synthetic offline'); }],
  ['missing', () => response({})], ['malformed', () => response({ pilotMode: false, capabilities: { ...disabled, uploads: 'true' } })],
]) test(`${name}: reference presentation survives restore, edit, backup and reload exactly`, async t => {
  const app = await bootApp({ configResponse }); t.after(() => app.close());
  const source = referenceBackup();
  await restore(app, source);
  assertRestricted(app);
  const name = app.document.querySelector('#previousKnowledge-table textarea');
  setValue(app.window, name, 'Edited adjacent name\nStill independent');
  await waitFor(() => stored(app).tables['previousKnowledge-table'][0][0].v === name.value);
  const downloaded = await backup(app);
  for (const key of ['previousKnowledge-table', 'requirements-table', 'customReferences-table']) {
    assert.deepEqual(downloaded.tables[key].map(row => row[1]), source.tables[key].map(row => row[1]));
  }
  assert.deepEqual(downloaded.lists, source.lists);
  assert.deepEqual(downloaded.methods, source.methods);
  // RPA-101 gave every section a hatch; each is written, empty or not.
  assert.deepEqual(downloaded.custom, { ...source.custom, additionalContext: [], additionalResearch: [], additionalMethodology: [] });
  assert.equal(downloaded.createdAt, source.createdAt);
  assert.equal(downloaded.fields.lastUpdated, source.fields.lastUpdated);
  assert.equal(downloaded.evaluations, undefined);
  const reloaded = await bootApp({ draft: downloaded, configResponse }); t.after(() => reloaded.close());
  assertRestricted(reloaded);
  const again = await backup(reloaded);
  assert.deepEqual(again.tables, downloaded.tables);
  assert.deepEqual(app.jsdomErrors, []);
});

test('restored custom and previously dormant file columns use the same restricted presentation', async t => {
  const source = fs.readFileSync(path.join(__dirname, '../research-plan-template.md'), 'utf8');
  const app = await bootApp({ configResponse: pilot, draft: referenceBackup(), textAssets: { 'research-plan-template.md': source +
    '\nRequirements (table, optional, key=requirements): Name:prose:name | File:file:file\n' +
    '\nCustom References (table, optional, key=customReferences): Name:prose:name | File:file:file\n' } });
  t.after(() => app.close());
  assert.equal(app.document.querySelectorAll('.file-cell').length, 8);
  assertRestricted(app);
  const result = await backup(app);
  for (const key of ['requirements-table', 'customReferences-table']) assert.deepEqual(result.tables[key], referenceBackup().tables[key]);
});

test('row deletion keeps neighbours and Clear Form cancellation retains reference metadata', async t => {
  let accepted = false, confirmations = 0;
  const app = await bootApp({ configResponse: pilot, draft: referenceBackup(), confirm: () => { confirmations++; return accepted; } });
  t.after(() => app.close());
  const before = await backup(app);
  app.document.getElementById('clear-btn').click();
  assert.equal(confirmations, 1);
  assert.deepEqual((await backup(app)).tables, before.tables);
  // Table row removal is immediate in the existing app; do not introduce a new confirmation.
  app.document.querySelectorAll('#previousKnowledge-table .row-remove')[1].click();
  assert.equal(confirmations, 1);
  const after = (await backup(app)).tables['previousKnowledge-table'];
  assert.deepEqual(after, before.tables['previousKnowledge-table'].filter((_, i) => i !== 1));
  accepted = true;
  app.document.getElementById('clear-btn').click();
  assert.equal(confirmations, 2);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), null);
  assertRestricted(app);
  const cleared = await backup(app);
  assert.equal(cleared.tables['previousKnowledge-table'][0][1].v, '');
  assert.equal(cleared.tables['requirements-table'], undefined);
});

test('confirmed nonpilot retains upload menu and original empty-file wording', async t => {
  const app = await bootApp(); t.after(() => app.close());
  const cell = app.document.querySelector('.file-cell');
  assert.equal(cell.querySelector('.file-name').textContent, 'No file chosen');
  assert.equal(cell.querySelector('.file-add-btn').disabled, false);
  cell.querySelector('.file-add-btn').click();
  assert.equal(app.document.querySelector('.file-menu').hidden, false);
});

test('print preparation and restoration leave reference metadata and neighbouring content unchanged', async t => {
  const app = await bootApp({ draft: referenceBackup(), configResponse: pilot }); t.after(() => app.close());
  const before = await backup(app);
  const saved = app.window.localStorage.getItem(DRAFT_KEY);
  for (const event of ['beforeprint', 'afterprint', 'beforeprint', 'afterprint']) {
    app.window.dispatchEvent(new app.window.Event(event));
    assertRestricted(app);
    assert.deepEqual((await backup(app)).tables, before.tables);
    assert.equal(app.window.localStorage.getItem(DRAFT_KEY), saved);
  }
});

test('nonpilot upload completion updates filename metadata without saving transient status copy', async t => {
  const app = await bootApp({ draft: referenceBackup() }); t.after(() => app.close());
  const originalFetch = app.window.fetch;
  let completeUpload;
  app.window.fetch = (url, init) => url === '/api/upload'
    ? new Promise(resolve => { completeUpload = () => resolve(response({ url: '/uploads/synthetic-new.pdf', filename: 'Synthetic new.pdf' })); })
    : originalFetch(url, init);
  const picker = app.document.querySelector('.file-native');
  Object.defineProperty(picker, 'files', { value: [new app.window.File(['synthetic bytes'], 'Synthetic new.pdf')] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => completeUpload);
  assert.deepEqual((await backup(app)).tables['previousKnowledge-table'][0][1], referenceBackup().tables['previousKnowledge-table'][0][1]);
  completeUpload();
  await waitFor(() => app.document.querySelector('.file-name').textContent === 'Synthetic new.pdf');
  const data = await backup(app);
  assert.deepEqual(data.tables['previousKnowledge-table'][0][1], { t: 'file', v: '/uploads/synthetic-new.pdf', n: 'Synthetic new.pdf' });
});
