'use strict';

// RPA-77, first slice: download the plan as a Word document. An editable
// copy to take away, for a reviewer to comment on or for the person to carry
// on in Word. Made in the browser by plan-document.js, with no library and
// nothing uploaded: a .docx is a zip of a few XML files.
//
// What the ticket asks of it, and what is held here: a real .docx (not HTML
// under another name); headings, lists and tables that are Word's own, so
// they can be edited; the schedule as a table whose stages and dates can be
// changed; the plan as it is now, an edit still waiting for autosave
// included; a filename from the title; one download per press; and making
// the file changes nothing: not the answers, not Last updated, not the page
// the person is on, not the saved draft.
//
// What cannot be held here: that Microsoft Word opens it with no repair
// warning. That is a manual check, in Word itself (test/manual/rpa-77-word-checks.md).
//
// Decisions, Gus, 17 September 2026: Word first, direct PDF later; the
// timeline is the schedule table with an inclusive count of days, and no
// chart; field names and answers, the declarations and a sign-off block, no
// hints or help notes; an empty optional field shows as "Not provided".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { JSDOM } = require('jsdom');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const maker = require('../plan-document.js');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'plan-document.js'));
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// A zip reader for what this writes: stored entries only. It trusts nothing:
// every size, offset and checksum is checked against the bytes.
function unzip(bytes) {
  const b = Buffer.from(bytes);
  const end = b.length - 22;
  assert.equal(b.readUInt32LE(end), 0x06054b50, 'ends with the end-of-directory record');
  const count = b.readUInt16LE(end + 10), dirSize = b.readUInt32LE(end + 12), dirAt = b.readUInt32LE(end + 16);
  assert.equal(dirAt + dirSize, end, 'the directory sits between the files and the end record');
  const files = new Map();
  let at = dirAt;
  for (let i = 0; i < count; i++) {
    assert.equal(b.readUInt32LE(at), 0x02014b50, 'a directory record');
    const method = b.readUInt16LE(at + 10), crc = b.readUInt32LE(at + 16), size = b.readUInt32LE(at + 20), nameLength = b.readUInt16LE(at + 28), local = b.readUInt32LE(at + 42);
    const name = b.toString('utf8', at + 46, at + 46 + nameLength);
    assert.equal(method, 0, name + ' is stored');
    assert.equal(b.readUInt32LE(at + 24), size, name + ': one size, stored');
    assert.equal(b.readUInt32LE(local), 0x04034b50, name + ': its directory entry points at its file');
    assert.equal(b.toString('utf8', local + 30, local + 30 + b.readUInt16LE(local + 26)), name);
    assert.equal(b.readUInt32LE(local + 14), crc, name + ': the two records agree on the checksum');
    const data = b.subarray(local + 30 + nameLength, local + 30 + nameLength + size);
    if (typeof zlib.crc32 === 'function') assert.equal(zlib.crc32(data), crc, name + ': and the checksum is that of the bytes');
    const date = b.readUInt16LE(at + 14);
    assert.ok(((date >> 5) & 15) >= 1 && (date & 31) >= 1, name + ': a real date, which some unzippers insist on');
    files.set(name, data.toString('utf8'));
    at += 46 + nameLength;
  }
  assert.equal(at, end);
  return files;
}
function parseXml(name, source) {
  const parsed = new (new JSDOM('').window.DOMParser)().parseFromString(source, 'application/xml');
  assert.equal(parsed.getElementsByTagName('parsererror').length, 0, name + ' is well-formed XML');
  return parsed;
}
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const all = (node, tag) => Array.from(node.getElementsByTagNameNS(W, tag));
const val = (node) => node && node.getAttributeNS(W, 'val');
const wordsOf = (node) => all(node, 't').map((t) => t.textContent).join('');
const styleOf = (p) => val(all(p, 'pStyle')[0]) || '';

// A schema in the shape parseSchema gives, small enough to read.
const SCHEMA = {
  header: {
    before: [{ label: 'Email address', key: 'emailAddress', type: 'email' }],
    title: { label: 'Research title', key: 'researchTitle', type: 'text' },
    meta: [
      { label: 'Project name', key: 'jiraProject', type: 'text' },
      { label: 'Other researchers', key: 'otherResearchers', type: 'radios', options: ['Yes', 'No'], reveals: 'researcherNames' },
      { label: 'Researcher names', key: 'researcherNames', type: 'list' },
      { label: 'Project decision', key: 'projectDecision', type: 'date', optional: true },
    ],
  },
  sections: [
    { title: 'Context', fields: [{ label: 'Background', key: 'background', type: 'textarea' }, { label: 'Additional information', key: 'additionalContext', type: 'custom-fields', optional: true }] },
    { title: 'Research', fields: [{ label: 'Research Questions', key: 'researchQuestions', type: 'list' }, { label: 'Outcomes', key: 'outcomes', type: 'list' }] },
    { title: 'Studies', fields: [{ label: 'Number of studies', key: 'studyCount', type: 'radios', options: ['One', 'Two', 'Three'] }, { label: 'Study questions', key: 'studyQuestions', type: 'study-questions' }] },
    { title: 'Methodology', fields: [{ label: 'Methods', key: 'methods', type: 'list' }, { label: 'Participant criteria', key: 'characteristics', type: 'list', perQuestion: true },
      { label: 'Sample Size', key: 'sampleSize', type: 'radios', perQuestion: true, options: ['Small (1–5)'] }] },
    { title: 'Execution', fields: [
      { label: 'Planned Schedule', key: 'stageTimeline', type: 'table', columns: [{ label: 'Stage', key: 'stage', type: 'select' }, { label: 'Start Date', key: 'startDate', type: 'date' }, { label: 'Completion Date', key: 'completionDate', type: 'date' }] },
      { label: 'Previous Knowledge', key: 'previousKnowledge', type: 'table', optional: true, columns: [{ label: 'Name', key: 'name', type: 'prose' }, { label: 'File', key: 'file', type: 'file' }] }] },
    { title: 'Review', fields: [
      { label: 'Declaration: Lead researcher', key: 'declarationResearcher', type: 'checkbox', statement: 'I confirm this plan is complete.' }, { label: 'Sign off: Lead researcher', key: 'signOffResearcher', type: 'text' },
      { label: 'Declaration: Project requester', key: 'declarationRequester', type: 'checkbox', statement: 'I approve it.' }, { label: 'Sign off: Project requester', key: 'signOffProjectOwner', type: 'text' }] },
  ],
};
const DRAFT = () => ({
  fields: { emailAddress: 'priya@example.com', researchTitle: 'Usability testing of checkout flow', jiraProject: 'Checkout redesign', projectDecision: '2026-11-20',
    background: 'Checkout was rebuilt in June.\n\nAbandonment rose.', declarationResearcher: 'yes', signOffResearcher: 'PN — 17/09/2026', declarationRequester: '', signOffProjectOwner: 'TR' },
  selects: { otherResearchers: { v: 'Yes', o: '' }, studyCount: { v: 'Two', o: '' } },
  lists: { researcherNames: ['Sam Okoro', ''], researchQuestions: ['Where do people give up?', '', 'What do they expect?'], outcomes: ['A ranked list.', 'A map.'] },
  studies: [
    { questions: [1, 3], methods: ['Moderated usability testing', ''], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } },
    { questions: [], methods: [], characteristics: [], sampleSize: { v: '__other__', o: '40+' } },
  ],
  tables: {
    'stageTimeline-table': [
      [{ t: 'select', v: 'Planning', o: '' }, { t: 'date', v: '2026-09-17' }, { t: 'date', v: '2026-09-25' }],
      [{ t: 'select', v: '', o: '' }, { t: 'date', v: '' }, { t: 'date', v: '' }],
      [{ t: 'select', v: '__other__', o: 'Pilot session' }, { t: 'date', v: '2026-09-28' }, { t: 'date', v: '2026-09-28' }],
      [{ t: 'select', v: 'Analysis', o: '' }, { t: 'date', v: '2026-10-09' }, { t: 'date', v: '2026-10-01' }],
    ],
    'previousKnowledge-table': [[{ t: 'text', v: '' }, { t: 'file', v: '', n: 'No file chosen' }]],
  },
  custom: { additionalContext: [{ label: 'Constraints', body: 'No budget for incentives.' }, { label: '', body: '' }] },
});

test('the plan as an outline: the form\'s order, names and answers, and nothing that was not asked', () => {
  const view = maker.view(SCHEMA, DRAFT(), { today: '2026-09-17' });
  assert.equal(view.title, 'Usability testing of checkout flow');
  const blocks = view.blocks;
  assert.deepEqual(blocks[0], { type: 'title', text: 'Usability testing of checkout flow' });
  assert.deepEqual(blocks[1], { type: 'pairs', rows: [['Project name', ['Checkout redesign']], ['Other researchers', ['Yes']], ['Researcher names', ['Sam Okoro']], ['Project decision', ['20 November 2026']]] },
    'Plan details beside their names; a date in words; blank rows dropped; the email address is not part of the plan (RPA-99)');
  assert.deepEqual(blocks.filter((b) => b.type === 'heading' && b.level === 1).map((b) => b.text), ['Context', 'Research', 'Studies and methodology', 'Execution', 'Sign-off'],
    'one heading per section; the studies are said with their methodology, not twice');

  const after = (heading) => blocks[blocks.findIndex((b) => b.type === 'heading' && b.text === heading) + 1];
  assert.deepEqual(after('Background'), { type: 'paragraphs', lines: ['Checkout was rebuilt in June.', 'Abandonment rose.'] }, 'a paragraph per line, blank lines aside');
  assert.deepEqual(after('Research Questions'), { type: 'list', ordered: true, items: ['Where do people give up?', 'What do they expect?'] });
  assert.deepEqual(after('Constraints'), { type: 'paragraphs', lines: ['No budget for incentives.'] }, 'a block of additional information under its own name');
  assert.deepEqual(after('Previous Knowledge'), { type: 'empty', text: 'Not provided' }, 'an optional field left empty says so, as Review does');

  // The document numbers the questions that were written, and a study is said to answer them by those numbers.
  const study1 = blocks.findIndex((b) => b.type === 'heading' && b.text === 'Study 1');
  assert.deepEqual(blocks[study1 + 1], { type: 'paragraphs', lines: ['Answers research questions 1 and 2.'] }, 'the form\'s third question is the document\'s second: the blank row between has no number');
  assert.deepEqual(blocks[study1 + 2], { type: 'pairs', rows: [['Methods', ['Moderated usability testing']], ['Participant criteria', ['Abandoned a basket', 'New customers']], ['Sample Size', ['Small (1–5)']]] },
    'read through the model: a plan saved with user groups has them among its participant criteria (RPA-119)');
  const study2 = blocks.findIndex((b) => b.type === 'heading' && b.text === 'Study 2');
  assert.deepEqual(blocks[study2 + 1].lines, ['Not linked to a research question yet.']);
  assert.deepEqual(blocks[study2 + 2].rows, [['Methods', []], ['Participant criteria', []], ['Sample Size', ['40+']]], 'an "Other" sample size is the number typed');
  assert.equal(blocks.some((b) => b.type === 'heading' && /Number of studies|Study questions/.test(b.text)), false);

  assert.deepEqual(after('Planned Schedule'), { type: 'table', header: ['Stage', 'Start Date', 'Completion Date', 'Days'], rows: [
    ['Planning', '17 September 2026', '25 September 2026', '9'], ['Pilot session', '28 September 2026', '28 September 2026', '1'], ['Analysis', '9 October 2026', '1 October 2026', ''],
  ] }, 'both days count, one day is one day, an end before its start has no count, and an empty row is not a row');

  assert.deepEqual(blocks[blocks.findIndex((b) => b.text === 'Sign-off') + 1].rows, [
    ['Lead researcher', 'I confirm this plan is complete.', 'PN — 17/09/2026'], ['Project requester', 'I approve it.', 'Not signed']],
    'initials typed without the declaration ticked are not a signature (RPA-115)');
  assert.match(blocks[blocks.length - 1].text, /^Made with Research Plan on 17 September 2026\. Changes made in this document are not brought back into the form\.$/);

  const no = DRAFT(); no.selects.otherResearchers = { v: 'No', o: '' };
  assert.deepEqual(maker.view(SCHEMA, no).blocks[1].rows.map((r) => r[0]), ['Project name', 'Other researchers', 'Project decision'], 'names that were not asked for are not in the document, though the draft keeps them (RPA-141)');
  assert.deepEqual(maker.view(SCHEMA, {}).blocks[0], { type: 'title', text: 'Untitled research plan' });
  assert.deepEqual(maker.view(SCHEMA, {}).blocks[1].rows[0], ['Project name', []], 'an empty plan is a document of questions');
});

test('a real .docx: a sound zip of well-formed parts that name each other correctly', () => {
  const bytes = maker.docx(maker.view(SCHEMA, DRAFT(), { today: '2026-09-17' }), { when: new Date(2026, 8, 17, 15, 4, 8) });
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(Array.from(bytes.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04], 'a zip from its first byte');
  const files = unzip(bytes);
  assert.deepEqual(Array.from(files.keys()), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']);
  const parsed = new Map(Array.from(files, ([name, source]) => [name, parseXml(name, source)]));

  const overrides = Array.from(parsed.get('[Content_Types].xml').getElementsByTagName('Override')).map((o) => o.getAttribute('PartName'));
  assert.deepEqual(overrides.sort(), ['/word/document.xml', '/word/numbering.xml', '/word/styles.xml'], 'every part is declared');
  overrides.forEach((part) => assert.ok(files.has(part.slice(1)), part + ' exists'));
  assert.match(files.get('[Content_Types].xml'), /wordprocessingml\.document\.main\+xml/, 'declared as a Word document, not as HTML or a template');
  assert.equal(parsed.get('_rels/.rels').getElementsByTagName('Relationship')[0].getAttribute('Target'), 'word/document.xml');
  assert.deepEqual(Array.from(parsed.get('word/_rels/document.xml.rels').getElementsByTagName('Relationship')).map((r) => r.getAttribute('Target')).sort(), ['numbering.xml', 'styles.xml']);
  assert.doesNotMatch(files.get('word/document.xml'), /<html|altChunk|<w:pict|<w:drawing/i, 'no HTML in disguise and no picture standing in for content');
});

test('the content is Word\'s own: styled headings, real lists that each start at 1, tables with header rows', () => {
  const files = unzip(maker.docx(maker.view(SCHEMA, DRAFT(), { today: '2026-09-17' })));
  const doc = parseXml('document', files.get('word/document.xml'));
  const styles = parseXml('styles', files.get('word/styles.xml'));
  const numbering = parseXml('numbering', files.get('word/numbering.xml'));

  const paragraphs = all(doc, 'p');
  assert.equal(styleOf(paragraphs[0]), 'Title');
  assert.deepEqual(paragraphs.filter((p) => styleOf(p) === 'Heading1').map(wordsOf), ['Context', 'Research', 'Studies and methodology', 'Execution', 'Sign-off']);
  assert.ok(paragraphs.some((p) => styleOf(p) === 'Heading2' && wordsOf(p) === 'Background'));
  assert.ok(paragraphs.some((p) => styleOf(p) === 'Heading3' && wordsOf(p) === 'Constraints'));
  // The names Word gives its built-in styles, so the navigation pane and a table of contents work.
  const named = Object.fromEntries(all(styles, 'style').map((s) => [s.getAttributeNS(W, 'styleId'), val(all(s, 'name')[0])]));
  assert.deepEqual([named.Title, named.Heading1, named.Heading2, named.Heading3, named.ListParagraph, named.TableGrid], ['Title', 'heading 1', 'heading 2', 'heading 3', 'List Paragraph', 'Table Grid']);
  ['Heading1', 'Heading2', 'Heading3'].forEach((id, level) => assert.equal(val(all(all(styles, 'style').find((s) => s.getAttributeNS(W, 'styleId') === id), 'outlineLvl')[0]), String(level)));
  assert.equal(val(all(styles, 'lang')[0]), 'en-GB', 'spelling is checked in British English (RPA-78)');

  // Two numbered lists, each its own numbering over its own definition; no bullets here but the definition is there.
  const listIds = paragraphs.filter((p) => all(p, 'numId').length).map((p) => val(all(p, 'numId')[0]));
  assert.deepEqual(listIds, ['2', '2', '3', '3'], 'questions, then outcomes');
  const nums = Object.fromEntries(all(numbering, 'num').map((n) => [n.getAttributeNS(W, 'numId'), val(all(n, 'abstractNumId')[0])]));
  assert.notEqual(nums['2'], nums['3'], 'a definition each, so each starts at 1 in every editor');
  const formats = Object.fromEntries(all(numbering, 'abstractNum').map((a) => [a.getAttributeNS(W, 'abstractNumId'), val(all(a, 'numFmt')[0])]));
  assert.equal(formats[nums['1']], 'bullet');
  assert.equal(formats[nums['2']], 'decimal');
  const order = Array.from(numbering.documentElement.children).map((c) => c.localName);
  assert.ok(order.lastIndexOf('abstractNum') < order.indexOf('num'), 'definitions before the numberings that use them, as the schema orders them');

  const tables = all(doc, 'tbl');
  assert.equal(tables.length, 5, 'plan details, two studies, the schedule, the sign-off');
  tables.forEach((tbl) => {
    const grid = all(tbl, 'gridCol').map((g) => Number(g.getAttributeNS(W, 'w')));
    assert.equal(grid.reduce((a, b) => a + b, 0), 9026, 'the columns add up to the page');
    all(tbl, 'tr').forEach((tr) => assert.equal(all(tr, 'tc').length, grid.length, 'every row has every cell'));
    all(tbl, 'tc').forEach((tc) => assert.ok(tc.lastElementChild.localName === 'p', 'a cell ends with a paragraph, or Word repairs the file'));
    const next = tbl.nextElementSibling;
    assert.ok(next.localName === 'p' && wordsOf(next) === '', 'and an empty paragraph of its own follows every table: two tables never touch, which Word would join, and none ends the document');
  });
  const schedule = tables.find((tbl) => wordsOf(all(tbl, 'tr')[0]) === 'StageStart DateCompletion DateDays');
  assert.equal(all(all(schedule, 'tr')[0], 'tblHeader').length, 1, 'its first row is a header row: repeated on a new page, and read out as headers');
  assert.equal(all(schedule, 'tr').length, 4);
  assert.equal(doc.documentElement.firstElementChild.lastElementChild.localName, 'sectPr', 'the page setup closes the body');
});

test('whatever was typed arrives whole, and nothing typed can break the file', () => {
  const draft = DRAFT();
  // The control characters are made here, not typed: a source file must not hold them either.
  draft.fields.background = 'Ünïcödé: 日本語 😀 & <b>tags</b> "quoted"\tTabbed' + String.fromCharCode(0, 8, 11, 31) + ' end ' + String.fromCharCode(0xD83D) + ' alone';
  draft.lists.outcomes = ['One line\nand another'];
  const files = unzip(maker.docx(maker.view(SCHEMA, draft)));
  const doc = parseXml('document', files.get('word/document.xml'));
  const para = all(doc, 'p').find((p) => /Ünïcödé/.test(wordsOf(p)));
  assert.equal(wordsOf(para), 'Ünïcödé: 日本語 😀 & <b>tags</b> "quoted"Tabbed end  alone', 'letters, an emoji and markup as text; control characters and half a surrogate pair gone');
  assert.equal(all(para, 'tab').length, 1, 'a tab is Word\'s tab');
  assert.ok(all(para, 't').every((t) => t.getAttribute('xml:space') === 'preserve'), 'spaces at the edges of a run are kept');
  const item = all(doc, 'p').find((p) => /One line/.test(wordsOf(p)));
  assert.equal(all(item, 'br').length, 1, 'a line break inside a list item stays in the item');
  assert.equal(SOURCE.some((byte) => byte < 9 || byte === 11 || byte === 12 || (byte > 13 && byte < 32)), false, 'and the module itself is plain text: its character classes are written as escapes');
});

test('the filename: the title first, what a computer refuses dropped, and a name when there is no title', () => {
  assert.equal(maker.filename('Usability testing of checkout flow', '2026-09-17'), 'Usability testing of checkout flow - research plan - 2026-09-17.docx');
  assert.equal(maker.filename('  Q3: "Checkout" <v2> / pricing?* | a\\b.  ', '2026-09-17'), 'Q3 Checkout v2 pricing a b - research plan - 2026-09-17.docx');
  assert.equal(maker.filename('', '2026-09-17'), 'Research plan - 2026-09-17.docx');
  assert.equal(maker.filename('...', '2026-09-17'), 'Research plan - 2026-09-17.docx');
  assert.ok(maker.filename('x'.repeat(300), '2026-09-17').length <= 80 + ' - research plan - 2026-09-17.docx'.length);
});

// ---------- in the form ----------

function catchDownloads(app) {
  const got = [];
  app.window.URL.createObjectURL = (blob) => { got.push({ blob }); return 'blob:word'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () { if (got.length) got[got.length - 1].name = this.download; };
  const bytesOf = (blob) => new Promise((resolve) => { const r = new app.window.FileReader(); r.onload = () => resolve(new Uint8Array(r.result)); r.readAsArrayBuffer(blob); });
  return { got, bytesOf };
}

test('the Menu groups what makes a file and says what each file is for', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const groups = Array.from(d.querySelectorAll('#options-menu .menu-group'));
  assert.deepEqual(groups.map((g) => text(g.querySelector('.menu-group-title'))), ['Your plan as a document', 'Backup of this form', '']);
  assert.deepEqual(groups.map((g) => Array.from(g.querySelectorAll('button')).map(text)), [['Download as Word (.docx)', 'Print or save as PDF'], ['Download backup', 'Restore backup'], ['Clear Form']]);
  const word = d.getElementById('download-word-btn');
  assert.equal(text(d.getElementById(word.getAttribute('aria-describedby'))), 'To edit, or for others to comment on, outside this form.');
  assert.equal(text(d.getElementById(d.getElementById('print-btn').getAttribute('aria-describedby'))), 'To read or share as it is.');
  assert.ok(word.classList.contains('btn-dark') && !d.getElementById('print-btn').classList.contains('btn-dark'), 'Word is the main way to take the plan away');
  assert.equal(word.disabled, false);
  assert.equal(groups[0].getAttribute('role'), 'group');
  assert.equal(text(d.getElementById(groups[0].getAttribute('aria-labelledby'))), 'Your plan as a document');
});

test('pressing it downloads the plan as it is now, the edit autosave has not caught up with included, and changes nothing', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const { got, bytesOf } = catchDownloads(app);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'First title');
  await waitFor(() => (JSON.parse(window.localStorage.getItem(DRAFT_KEY) || '{}').fields || {}).researchTitle === 'First title');
  window.location.hash = '#context';
  await settle(300);
  const savedBefore = window.localStorage.getItem(DRAFT_KEY);
  const lastUpdated = d.querySelector('[data-field="lastUpdated"]').value;

  // Typed this instant: the saved draft still says "First title".
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Usability testing: checkout/flow');
  setValue(window, d.querySelector('[data-field="background"]'), 'Typed a moment ago.');
  const word = d.getElementById('download-word-btn');
  word.click();
  assert.equal(word.disabled, true, 'off while the file is made');
  assert.equal(text(word), 'Preparing Word document…');
  assert.equal(word.getAttribute('aria-busy'), 'true');
  assert.equal(text(d.getElementById('word-status')), 'Preparing your Word document.');
  word.click();   // a second press, and a third by script
  word.dispatchEvent(new window.Event('click', { bubbles: true }));
  await waitFor(() => !word.disabled);

  assert.equal(got.length, 1, 'one download, however many presses');
  assert.equal(got[0].name, 'Usability testing checkout flow - research plan - ' + new Date().toLocaleDateString('en-CA') + '.docx');
  assert.equal(got[0].blob.type, maker.DOCX_TYPE);
  assert.equal(text(word), 'Download as Word (.docx)');
  assert.equal(word.hasAttribute('aria-busy'), false);
  assert.equal(text(d.getElementById('word-status')), 'Download started: ' + got[0].name);
  assert.equal(d.getElementById('word-status').getAttribute('role'), 'status');

  const files = unzip(await bytesOf(got[0].blob));
  const doc = parseXml('document', files.get('word/document.xml'));
  const said = all(doc, 'p').map(wordsOf);
  assert.equal(said[0], 'Usability testing: checkout/flow', 'the title as typed, not as saved');
  assert.ok(said.includes('Typed a moment ago.'));

  assert.equal(window.location.hash, '#context', 'the person is where they were');
  assert.equal(d.querySelector('[data-field="lastUpdated"]').value, lastUpdated);
  await settle(900);   // autosave catches up with the typing, in its own time and its own shape
  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.fields.researchTitle, 'Usability testing: checkout/flow');
  assert.equal(saved.version, JSON.parse(savedBefore).version);
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(JSON.parse(savedBefore)).sort(), 'making the file adds nothing to the draft');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the real form\'s document: every section, the studies by name, the schedule as a table, and none of the hints', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const { got, bytesOf } = catchDownloads(app);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout');
  setValue(window, d.querySelector('.list-rows[data-list-key="researchQuestions"] .list-input'), 'Where do people give up?');
  d.querySelector('.select-cell[data-field-key="studyCount"] input[value="One"]').click();
  await settle(300);
  d.querySelector('.study-group input[type=checkbox]').click();
  setValue(window, d.querySelector('.methods-group .list-rows[data-list-key="methods"] .list-input'), 'Interviews');
  assert.equal(d.querySelector('.timeline-chart').hidden, true, 'the timeline starts hidden on screen; the document has the schedule regardless');
  d.getElementById('download-word-btn').click();
  await waitFor(() => got.length === 1 && got[0].name);
  const doc = parseXml('document', unzip(await bytesOf(got[0].blob)).get('word/document.xml'));
  const paragraphs = all(doc, 'p');
  assert.deepEqual(paragraphs.filter((p) => styleOf(p) === 'Heading1').map(wordsOf), ['Context', 'Research', 'Studies and methodology', 'Execution', 'Sign-off']);
  const said = paragraphs.map(wordsOf);
  ['Study 1', 'Answers research question 1.', 'Interviews', 'Planning', 'Reporting', 'Not provided', 'Not signed'].forEach((words) => assert.ok(said.includes(words), words));
  const everything = said.join('\n');
  assert.doesNotMatch(everything, /Give essential context|Why we ask|How to write|Help with this section|name@example\.com/, 'no hints, no help notes, and not the email address');
  assert.doesNotMatch(everything, /What is the goal of this project\?/, 'a field is called by its name, not by its question');
  assert.match(everything, /I confirm this plan is complete and current/);
  assert.deepEqual(app.jsdomErrors, []);
});

test('Review offers a copy under the summary and above the sign-off, with a status of its own', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const { got } = catchDownloads(app);
  const review = d.querySelector('.review-step');
  const panel = review.querySelector('.keep-copy');
  assert.ok(panel, 'the panel is there');
  assert.equal(text(panel.querySelector('h3')), 'Keep a copy of this plan');
  assert.ok(review.querySelector('.review-list').compareDocumentPosition(panel) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'under the summary');
  assert.ok(panel.compareDocumentPosition(review.querySelector('.sign-off')) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'above the sign-off: offered before signing, not as a reward for it');
  assert.deepEqual(Array.from(panel.querySelectorAll('button')).map(text), ['Download as Word (.docx)', 'Print or save as PDF']);
  assert.match(text(panel.querySelector('.keep-copy-inset')), /^Changes made in Word stay in Word\./);

  let printed = 0;
  window.print = () => { printed++; };
  panel.querySelectorAll('button')[1].click();
  assert.equal(printed, 1, 'printing is a separate action and still prints');

  const [reviewWord, menuWord] = [panel.querySelector('.download-word'), d.getElementById('download-word-btn')];
  reviewWord.click();
  assert.equal(menuWord.disabled, true, 'while one is making the file the other is off too');
  await waitFor(() => !reviewWord.disabled);
  assert.equal(got.length, 1);
  assert.match(text(panel.querySelector('.word-status')), /^Download started: /, 'said where it was pressed');
  assert.equal(text(d.getElementById('word-status')), '', 'and not in the Menu\'s place');
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.match(css, /@media print\{\.keep-copy,\.word-status\{display:none!important\}\}/, 'the offer of a copy is not part of the printed plan');
  assert.deepEqual(app.jsdomErrors, []);
});

test('when the file cannot be made it says so, the plan is as it was, and the button works again', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const { got } = catchDownloads(app);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Kept');
  const real = window.RPA_PLAN_DOCUMENT.docx;
  window.RPA_PLAN_DOCUMENT.docx = () => { throw new Error('no'); };
  const word = d.getElementById('download-word-btn');
  word.click();
  await waitFor(() => !word.disabled);
  const status = d.getElementById('word-status');
  assert.equal(text(status), 'The Word document could not be made. Your plan has not changed. Try again, or use Print or save as PDF.');
  assert.equal(status.dataset.error, 'true');
  assert.equal(got.length, 0);
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, 'Kept');
  window.RPA_PLAN_DOCUMENT.docx = real;
  word.click();
  await waitFor(() => got.length === 1);
  assert.equal(status.dataset.error, 'false', 'the next press succeeds and says so');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a plan this build must not open cannot be downloaded as Word either', async (t) => {
  const newer = JSON.stringify({ version: 99, fields: { researchTitle: 'From the future' }, selects: {}, lists: {}, studies: [], tables: {}, custom: {} });
  const app = await bootApp({ storage: { [DRAFT_KEY]: newer } });
  t.after(() => app.close());
  const { got } = catchDownloads(app);
  const word = app.document.getElementById('download-word-btn');
  assert.equal(word.disabled, true, 'it would be a document of an empty form (RPA-143)');
  word.dispatchEvent(new app.window.Event('click', { bubbles: true }));
  await settle(200);
  assert.equal(got.length, 0);
});
