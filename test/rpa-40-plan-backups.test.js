'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, listInputs, waitFor, DRAFT_KEY } = require('./app-harness');
const { realisticBackup, smallBackup } = require('./rpa-40-fixtures.cjs');

const status = app => app.document.getElementById('backup-status').textContent;
const stored = app => JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
const title = app => app.document.querySelector('[data-field="researchTitle"]');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function interceptDownload(app) {
  let download;
  app.window.URL.createObjectURL = blob => { download = { blob }; return 'blob:local-backup'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () {
    download.name = this.download;
    download.href = this.href;
  };
  return async () => {
    app.document.getElementById('download-backup-btn').click();
    assert.ok(download, status(app));
    const text = await new Promise((resolve, reject) => {
      const reader = new app.window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(download.blob);
    });
    return { ...download, text, data: JSON.parse(text) };
  };
}

async function importBackup(app, data, options = {}) {
  const file = new app.window.File([typeof data === 'string' ? data : JSON.stringify(data)], options.name || 'plan.json', { type: 'application/json' });
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled);
  return status(app);
}

function stable(data) {
  const copy = structuredClone(data);
  delete copy.savedAt;
  return copy;
}

test('download includes immediate unsaved edits, metadata and dormant data without saving or evaluating', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  setValue(app.window, title(app), 'Latest edit / café 🧭\nBefore autosave');
  const download = await interceptDownload(app)();
  assert.equal(download.data.fields.researchTitle, title(app).value);
  assert.equal(download.data.fields.project, realisticBackup().fields.project);
  assert.equal(download.data.createdAt, '2026-08-01');
  assert.equal(download.data.fields.lastUpdated, '2026-08-29');
  assert.equal(download.data.lastUpdatedManual, true);
  assert.equal(download.blob.type, 'application/json');
  assert.match(download.name, /^Latest edit café 🧭 Before autosave - backup \d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  assert.equal(app.evaluationRequests.length, 0);
  assert.equal(download.data.evaluations, undefined);
});

test('download has an untitled fallback and works with denied storage, retaining recovered dormant data', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  setValue(app.window, title(app), '');
  Object.defineProperty(app.window, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
  const result = await interceptDownload(app)();
  assert.match(result.name, /^Untitled plan - backup /);
  assert.equal(result.data.fields.researchTitle, '');
  assert.equal(result.data.fields.project, realisticBackup().fields.project);
});

test('download reads buffered complete dates and reports incomplete dates without changing controls', async t => {
  const app = await bootApp(); t.after(() => app.close());
  const date = app.document.querySelector('[data-field="projectDecision"]').closest('.date-control');
  date.querySelector('.date-day').value = '12';
  date.querySelector('.date-month').value = 'Oct';
  date.querySelector('.date-year').value = '2026';
  const download = interceptDownload(app);
  assert.equal((await download()).data.fields.projectDecision, '2026-10-12');
  assert.equal(date.querySelector('input[type=date]').value, '');
  date.querySelector('.date-year').value = '20';
  app.document.getElementById('download-backup-btn').click();
  assert.match(status(app), /Complete or clear the unfinished date/);
  assert.equal(date.querySelector('.date-year').value, '20');
});

test('realistic Unicode plan round-trips all draft structures and reloads, including repeated same-file import', async t => {
  const source = await bootApp({ draft: realisticBackup() }); t.after(() => source.close());
  const exported = await interceptDownload(source)();
  const target = await bootApp(); t.after(() => target.close());
  assert.match(await importBackup(target, exported.text), /^Backup restored and saved/, status(target));
  const restored = await interceptDownload(target)();
  assert.deepEqual(stable(restored.data), stable(exported.data));
  assert.deepEqual(stable(stored(target)), stable(restored.data));
  assert.equal(target.document.querySelectorAll('.custom-field-block').length, 2);
  assert.deepEqual(listInputs(target.document, 'researchQuestions').map(i => i.value), realisticBackup().lists.researchQuestions);
  assert.deepEqual(listInputs(target.document, 'outcomes').map(i => i.value), realisticBackup().lists.outcomes);
  assert.equal(target.document.querySelector('.file-value').value, '/uploads/previous-study.pdf');
  assert.match(await importBackup(target, exported.text), /^Backup restored and saved/);
  assert.deepEqual(stable(stored(target)), stable(restored.data));
  const reloaded = await bootApp({ draft: stored(target) }); t.after(() => reloaded.close());
  assert.deepEqual(stable((await interceptDownload(reloaded)()).data), stable(restored.data));
  assert.deepEqual(target.jsdomErrors, []);
});

test('a smaller imported plan fully replaces a larger plan and pending autosave cannot resurrect old data', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  setValue(app.window, title(app), 'Unsaved old title');
  assert.match(await importBackup(app, smallBackup()), /^Backup restored and saved/);
  assert.equal(title(app).value, 'A smaller plan');
  assert.equal(listInputs(app.document, 'researchQuestions').length, 1);
  assert.equal(listInputs(app.document, 'outcomes').length, 1);
  assert.equal(app.document.querySelectorAll('.methods-group').length, 1);
  assert.equal(app.document.querySelectorAll('.custom-field-block').length, 0);
  assert.equal(app.document.querySelector('.file-value').value, '');
  await pause(550);
  assert.equal(stored(app).fields.project, undefined);
  assert.equal(stored(app).custom.dormantSections, undefined);
  assert.equal(stored(app).tables['requirements-table'], undefined);
  assert.equal(stored(app).fields.researchTitle, 'A smaller plan');
  assert.equal(stored(app).fields.lastUpdated, '2026-09-01');
  assert.equal(app.document.querySelector('.timeline-chart').hidden, true);
  setValue(app.window, title(app), 'New edit');
  await waitFor(() => stored(app).fields.researchTitle === 'New edit');
  assert.equal(stored(app).fields.project, undefined);
});

test('generated defaults alone do not request replacement confirmation', async t => {
  let confirms = 0;
  const app = await bootApp({ confirm() { confirms++; return false; } }); t.after(() => app.close());
  assert.match(await importBackup(app, smallBackup()), /^Backup restored and saved/);
  assert.equal(confirms, 0);
});

test('confirmation protects unsaved writing and cancellation preserves exact controls, values, focus and storage', async t => {
  let confirms = 0;
  const app = await bootApp({ confirm() { confirms++; return false; } }); t.after(() => app.close());
  setValue(app.window, title(app), 'Unsaved writing'); title(app).focus();
  const root = app.document.getElementById('doc');
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  assert.match(await importBackup(app, smallBackup()), /^Restore cancelled/);
  assert.equal(confirms, 1);
  assert.equal(app.document.getElementById('doc'), root);
  assert.equal(app.document.activeElement, title(app));
  assert.equal(title(app).value, 'Unsaved writing');
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  await waitFor(() => stored(app)?.fields.researchTitle === 'Unsaved writing');
});

test('dormant data alone requests confirmation, and unfinished date writing is protected', async t => {
  const app = await bootApp({ draft: { version: 7, fields: { project: 'Hidden writing' } }, confirm: () => false }); t.after(() => app.close());
  assert.match(await importBackup(app, smallBackup()), /^Restore cancelled/);
  const dates = await bootApp({ confirm: () => false }); t.after(() => dates.close());
  const input = dates.document.querySelector('[data-field="projectDecision"]').closest('.date-control').querySelector('.date-day');
  input.value = '2';
  assert.match(await importBackup(dates, smallBackup()), /^Restore cancelled/);
  assert.equal(input.value, '2');
});

for (const version of [1, 2, 3, 4, 5, 6]) {
  test('supported draft version ' + version + ' uses the existing migrations', async t => {
    const app = await bootApp(); t.after(() => app.close());
    const draft = { version, fields: { [version < 5 ? 'title' : 'researchTitle']: 'Legacy plan',
      [version < 3 ? 'problem' : 'problemStatement']: 'Legacy problem',
      [version < 4 ? 'researcher' : 'leadResearcher']: 'Ana' }, lists: {}, methods: [] };
    if (version === 1) { draft.lists.methods = ['Interviews']; delete draft.methods; }
    assert.match(await importBackup(app, draft), /^Backup restored and saved/);
    assert.equal(title(app).value, 'Legacy plan');
    assert.equal(stored(app).fields.problemStatement, 'Legacy problem');
    assert.equal(stored(app).fields.leadResearcher, 'Ana');
    assert.equal(stored(app).fields.title, undefined);
    assert.equal(stored(app).version, 7);
    assert.equal(stored(app).ui.timelineVisible, false);
    if (version === 1) assert.deepEqual(stored(app).methods[0].methods, ['Interviews']);
  });
}

const invalidCases = {
  'corrupt JSON': '{bad', 'non-object': '[]', 'missing fields': {}, 'future version': { version: 8, fields: {} },
  'string version': { version: '7', fields: {} }, 'zero version': { version: 0, fields: {} },
  'field nested object': { version: 7, fields: { project: {} } },
  'list wrong nested type': { version: 7, fields: {}, lists: { researchQuestions: ['Valid', null] } },
  'dormant table wrong type': { version: 7, fields: {}, tables: { old: [[{ t: 'text', v: false }]] } },
  'custom wrong body': { version: 7, fields: {}, custom: { additionalResources: [{ label: 'Label', body: [] }] } },
  'methods wrong type': { version: 7, fields: {}, methods: [{ question: '', methods: 'Interviews' }] },
  'bad Other': { version: 7, fields: {}, selects: { sampleSize: { v: '__other__', o: 4 } } },
  'invalid calendar date': { version: 7, fields: {}, tables: { old: [[{ t: 'date', v: '2026-02-30' }]] } },
  'bad metadata': { version: 7, fields: {}, lastUpdatedManual: 'false' },
  'bad UI': { version: 7, fields: {}, ui: { timelineVisible: 'true' } },
  'extra unknown payload': { version: 7, fields: {}, evaluations: {} },
  'conflicting migration aliases': { version: 1, fields: { title: 'Old', researchTitle: 'Different' } },
  'selector injection': '{"version":7,"fields":{},"lists":{"bad\\\"key":["text"]}}',
  'prototype key': '{"version":7,"fields":{"__proto__":"text"}}',
  'over growth limit': { version: 7, fields: {}, lists: { researchQuestions: Array(501).fill('q') } },
};
for (const [name, invalid] of Object.entries(invalidCases)) {
  test(name + ' is rejected before confirmation or replacement', async t => {
    let confirms = 0;
    const app = await bootApp({ draft: smallBackup(), confirm() { confirms++; return true; } }); t.after(() => app.close());
    const root = app.document.getElementById('doc');
    const before = app.window.localStorage.getItem(DRAFT_KEY);
    assert.match(await importBackup(app, invalid), /^Could not restore/);
    assert.equal(confirms, 0);
    assert.equal(app.document.getElementById('doc'), root);
    assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
    assert.equal(title(app).value, 'A smaller plan');
  });
}

test('unrepresentable options, columns, orphaned methods and scalar dates roll back without losing the original', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  const root = app.document.getElementById('doc');
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  for (const change of [
    d => { d.selects.sampleSize = { v: 'Unknown option', o: '' }; },
    d => { d.tables['previousKnowledge-table'] = [[{ t: 'text', v: 'Extra column' }]]; },
    d => { d.methods.push({ question: 'Missing question', methods: ['Orphaned method'] }); },
    d => { d.fields.researchReadout = '2026-02-30'; },
    d => { d.fields.leadResearcher = 'Cannot preserve\nA newline in a single-line control'; },
  ]) {
    const draft = smallBackup(); change(draft);
    assert.match(await importBackup(app, draft), /cannot be restored faithfully/);
    assert.equal(app.document.getElementById('doc'), root);
    assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  }
  assert.deepEqual(app.jsdomErrors, []);
});

test('file read errors and storage failures explicitly keep the old plan and draft', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  const root = app.document.getElementById('doc');
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  const Reader = app.window.FileReader;
  app.window.FileReader = class { readAsText() { this.onerror(); } };
  assert.match(await importBackup(app, smallBackup()), /file could not be read/);
  app.window.FileReader = Reader;
  const store = app.window.localStorage;
  const setItem = app.window.Storage.prototype.setItem;
  app.window.Storage.prototype.setItem = () => { throw new Error('Storage quota exceeded'); };
  assert.match(await importBackup(app, smallBackup()), /Storage quota exceeded/);
  assert.equal(app.document.getElementById('doc'), root);
  assert.equal(store.getItem(DRAFT_KEY), before);
  app.window.Storage.prototype.setItem = setItem;
  Object.defineProperty(app.window, 'localStorage', { configurable: true, get() { throw new Error('Denied'); } });
  assert.match(await importBackup(app, smallBackup()), /Browser storage is unavailable/);
  assert.equal(app.document.getElementById('doc'), root);
  assert.equal(store.getItem(DRAFT_KEY), before);
});

test('unexpected rendering failure rolls back and original controls still autosave', async t => {
  const app = await bootApp({ draft: realisticBackup() }); t.after(() => app.close());
  const root = app.document.getElementById('doc');
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  const create = app.document.createElement.bind(app.document);
  app.document.createElement = () => { throw new Error('Injected rendering failure'); };
  assert.match(await importBackup(app, smallBackup()), /Injected rendering failure/);
  app.document.createElement = create;
  assert.equal(app.document.getElementById('doc'), root);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  setValue(app.window, title(app), 'Still editable');
  await waitFor(() => stored(app).fields.researchTitle === 'Still editable');
  assert.equal(stored(app).fields.project, realisticBackup().fields.project);
});

test('replacement aborts old evaluation work and late responses never attach to the imported plan', async t => {
  let release;
  const app = await bootApp({ draft: smallBackup(), evaluate: () => new Promise(resolve => { release = resolve; }) }); t.after(() => app.close());
  app.document.querySelector('[data-evaluate-section="context"]').click();
  await waitFor(() => release);
  assert.match(await importBackup(app, realisticBackup()), /^Backup restored and saved/);
  assert.equal(app.evaluationRequests[0].signal.aborted, true);
  release({ metrics: [{ name: 'Old feedback', score: 3, desc: 'Must not appear' }], recommendations: [] });
  await pause(100);
  assert.equal(app.document.querySelectorAll('.eval-panel:not([hidden])').length, 0);
  assert.doesNotMatch(app.document.getElementById('doc').textContent, /Must not appear/);
  assert.deepEqual(app.jsdomErrors, []);
});

test('failed persistence keeps in-flight evaluations attached to the original plan', async t => {
  let release;
  const app = await bootApp({ draft: smallBackup(), evaluate: () => new Promise(resolve => { release = resolve; }) }); t.after(() => app.close());
  const root = app.document.getElementById('doc');
  app.document.querySelector('[data-evaluate-section="context"]').click();
  await waitFor(() => release);
  app.window.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  assert.match(await importBackup(app, realisticBackup()), /could not be saved in browser storage/);
  assert.equal(app.document.getElementById('doc'), root);
  assert.equal(app.evaluationRequests[0].signal.aborted, false);
  release({ metrics: [{ name: 'Original feedback', score: 3, desc: 'Still belongs to the original plan' }], recommendations: [] });
  await waitFor(() => root.textContent.includes('Still belongs to the original plan'));
  assert.equal(title(app).value, 'A smaller plan');
  assert.deepEqual(app.jsdomErrors, []);
});

test('edits while the file is being read are confirmed against the latest plan', async t => {
  let release, confirms = 0;
  const app = await bootApp({ confirm() { confirms++; return false; } }); t.after(() => app.close());
  app.window.FileReader = class { readAsText() { release = () => { this.result = JSON.stringify(smallBackup()); this.onload(); }; } };
  const reading = importBackup(app, smallBackup());
  await waitFor(() => release);
  setValue(app.window, title(app), 'Writing entered during file read');
  release();
  assert.match(await reading, /^Restore cancelled/);
  assert.equal(confirms, 1);
  assert.equal(title(app).value, 'Writing entered during file read');
});

test('file-picker cancellation and aborted reads leave the plan and stored draft intact', async t => {
  const app = await bootApp({ draft: smallBackup() }); t.after(() => app.close());
  const before = app.window.localStorage.getItem(DRAFT_KEY);
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  assert.equal(app.document.getElementById('restore-backup-btn').disabled, false);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
  app.window.FileReader = class { readAsText() { this.onabort(); } };
  assert.match(await importBackup(app, realisticBackup()), /Reading the selected file was cancelled/);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), before);
});

test('an imported plan retains inactive Other text and custom property order is immaterial', async t => {
  const app = await bootApp(); t.after(() => app.close());
  const draft = realisticBackup();
  draft.selects.sampleSize = { o: 'Retained Other text', v: '' };
  draft.tables['stageTimeline-table'][0][0].o = 'Retained stage text';
  draft.custom.additionalResources = [{ body: 'Body first in JSON', label: 'Label second' }];
  assert.match(await importBackup(app, draft), /^Backup restored and saved/);
  const result = (await interceptDownload(app)()).data;
  assert.equal(result.selects.sampleSize.o, 'Retained Other text');
  assert.equal(result.tables['stageTimeline-table'][0][0].o, 'Retained stage text');
  assert.deepEqual(result.custom.additionalResources, draft.custom.additionalResources);
});

test('timeline-only changes after replacement preserve Last updated; clearing then editing cannot revive imported dormant data', async t => {
  const app = await bootApp(); t.after(() => app.close());
  const draft = realisticBackup(); draft.lastUpdatedManual = false;
  assert.match(await importBackup(app, draft), /^Backup restored and saved/);
  app.document.querySelector('.timeline-viz-btn').click();
  await pause(550);
  assert.equal(stored(app).fields.lastUpdated, draft.fields.lastUpdated);
  app.document.getElementById('clear-btn').click();
  setValue(app.window, title(app), 'After imported plan was cleared');
  await waitFor(() => stored(app)?.fields.researchTitle === 'After imported plan was cleared');
  assert.equal(stored(app).fields.project, undefined);
  assert.equal(stored(app).tables['requirements-table'], undefined);
});

test('download works without any recoverable browser draft when storage becomes unavailable', async t => {
  const app = await bootApp(); t.after(() => app.close());
  Object.defineProperty(app.window, 'localStorage', { get() { throw new Error('Denied'); } });
  setValue(app.window, title(app), 'Only in memory');
  assert.equal((await interceptDownload(app)()).data.fields.researchTitle, 'Only in memory');
});
