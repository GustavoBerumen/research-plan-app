(function exposePlanDocument(root, factory) {
  const planModel = typeof module === 'object' && module.exports ? require('./plan-model.js') : root.RPA_PLAN_MODEL;
  const api = factory(planModel);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.RPA_PLAN_DOCUMENT = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, (PLAN) => {
  'use strict';

  // RPA-77. The plan as a document someone can take away and edit: a Word
  // file, written here, in the browser, with no library and nothing uploaded.
  //
  // Two halves, and neither knows about the page.
  //
  //   view(schema, draft)  the plan as an outline: a title, headings,
  //                        paragraphs, lists and tables, in the order of the
  //                        form. It reads the same two things the form is
  //                        made of, the template's schema and the draft, so a
  //                        field added to the template appears in the
  //                        document without a change here. The print
  //                        redesign (RPA-46, RPA-47) can read the same view.
  //
  //   docx(view)           that outline as the bytes of a .docx. A .docx is a
  //                        zip of a few XML files (ECMA-376). The zip is
  //                        written "stored", uncompressed: a plan is tens of
  //                        kilobytes, and a stored zip needs a CRC-32 and
  //                        three kinds of record, not a compressor.
  //
  // What the document is for decides what is in it (Gus, 17 September 2026):
  // field names and answers, the declarations and a sign-off block; no hints
  // and no help notes; an optional field left empty shows as "Not provided",
  // as Review shows it, so a reviewer sees the question and can answer it in
  // Word; the schedule is an editable table with an inclusive count of days,
  // and there is no chart, since a chart could only be a picture and a
  // picture cannot be edited. Changes made in Word are not brought back.

  const NOT_PROVIDED = 'Not provided';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const text = (v) => (v == null ? '' : String(v)).trim();
  const record = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const list = (v) => (Array.isArray(v) ? v : []);
  // An answer as lines: a textarea's line breaks are kept, blank lines are not.
  const linesOf = (v) => String(v == null ? '' : v).split(/\r\n?|\n/).map((l) => l.trim()).filter(Boolean);

  function isoParts(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(iso));
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return { y, mo, d, time: date.getTime() };
  }
  // "17 September 2026": the way Review and the check pages say a date.
  function dateWords(iso) {
    const p = isoParts(iso);
    return p ? p.d + ' ' + MONTHS[p.mo - 1] + ' ' + p.y : text(iso);
  }
  // Both days count, as the timeline counts them: a stage that starts and ends on one day is one day.
  function inclusiveDays(startIso, endIso) {
    const a = isoParts(startIso), b = isoParts(endIso);
    if (!a || !b || b.time < a.time) return '';
    return String(Math.round((b.time - a.time) / 86400000) + 1);
  }
  // A choice is saved as { v, o }: the option, or "__other__" and what was typed.
  function choiceWords(choice) {
    const c = record(choice);
    return text(c.v === '__other__' ? c.o : c.v);
  }
  function cellWords(cell, column) {
    const c = record(cell);
    const type = (column && column.type) || c.t;
    if (type === 'file' || c.t === 'file') return text(c.n) && text(c.n) !== 'No file chosen' ? text(c.n) : '';
    if (type === 'select' || c.t === 'select') return choiceWords(c);
    if (type === 'date' || c.t === 'date') return dateWords(c.v);
    return text(c.v);
  }

  // "1", "1 and 2", "1, 2 and 3".
  function inWords(numbers) {
    const n = numbers.map(String);
    return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }

  // A field that another field reveals is asked only while that one's first
  // option is chosen (RPA-141). Not asked, it has no place in the document.
  function hiddenKeys(fields, draft) {
    const hidden = new Set();
    fields.forEach((f) => {
      if (!f.reveals) return;
      const first = list(f.options)[0];
      if (choiceWords(record(draft.selects)[f.key]) !== first) hidden.add(f.reveals);
    });
    return hidden;
  }

  // One field's answer, as the blocks that show it under its heading.
  function answerBlocks(field, draft) {
    const fields = record(draft.fields), selects = record(draft.selects), lists = record(draft.lists);
    const none = [{ type: 'empty', text: NOT_PROVIDED }];
    if (field.type === 'list') {
      const items = list(lists[field.key]).map(text).filter(Boolean);
      // Research questions and outcomes are numbered: a study is said to answer them by number.
      return items.length ? [{ type: 'list', ordered: field.key === 'researchQuestions' || field.key === 'outcomes', items }] : none;
    }
    if (field.type === 'table') {
      const columns = list(field.columns);
      const rows = list(record(draft.tables)[field.key + '-table']).map((row) => columns.map((col, i) => cellWords(list(row)[i], col))).filter((row) => row.some(Boolean));
      if (!rows.length) return none;
      const start = columns.findIndex((c) => c.key === 'startDate'), end = columns.findIndex((c) => c.key === 'completionDate');
      const header = columns.map((c) => c.label);
      if (start === -1 || end === -1) return [{ type: 'table', header, rows }];
      const saved = list(record(draft.tables)[field.key + '-table']).filter((row) => columns.some((col, i) => cellWords(list(row)[i], col)));
      return [{ type: 'table', header: header.concat('Days'), rows: rows.map((row, r) => row.concat(inclusiveDays(record(list(saved[r])[start]).v, record(list(saved[r])[end]).v))) }];
    }
    if (field.type === 'custom-fields') {
      const blocks = list(record(draft.custom)[field.key]).filter((b) => text(record(b).label) || text(record(b).body));
      if (!blocks.length) return none;
      return blocks.reduce((out, b) => out.concat({ type: 'heading', level: 3, text: text(b.label) || 'Untitled' }, linesOf(b.body).length ? { type: 'paragraphs', lines: linesOf(b.body) } : none[0]), []);
    }
    if (field.type === 'radios' || field.type === 'select') {
      const words = choiceWords(selects[field.key]);
      return words ? [{ type: 'paragraphs', lines: [words] }] : none;
    }
    if (field.type === 'date') return text(fields[field.key]) ? [{ type: 'paragraphs', lines: [dateWords(fields[field.key])] }] : none;
    const lines = linesOf(fields[field.key]);
    return lines.length ? [{ type: 'paragraphs', lines }] : none;
  }
  // The same answer as the lines of one table cell, for a short answer beside its name.
  function answerLines(field, draft) {
    return answerBlocks(field, draft).reduce((out, b) => out.concat(b.type === 'list' ? b.items : b.type === 'paragraphs' ? b.lines : b.type === 'empty' ? [] : []), []);
  }

  function studyBlocks(section, draft) {
    const questions = list(record(draft.lists).researchQuestions);
    // The document numbers the questions that were written, 1, 2, 3, and a
    // study is said to answer them by those numbers, so the two agree even
    // where the form holds a blank row between two questions.
    const answered = PLAN.answered(questions);
    const shown = new Map(answered.map((q, i) => [q.number, i + 1]));
    const studies = list(draft.studies).map((s) => PLAN.study(s, questions.length));
    const per = list(section.fields).filter((f) => f.key === 'methods' || f.perQuestion);
    if (!studies.length) return [{ type: 'empty', text: NOT_PROVIDED }];
    return studies.reduce((out, study, i) => {
      const numbers = study.questions.map((n) => shown.get(n)).filter(Boolean);
      const rows = per.map((f) => {
        const value = f.type === 'radios' || f.type === 'select' ? [choiceWords(study[f.key])].filter(Boolean) : list(study[f.key]).map(text).filter(Boolean);
        return [f.label, value];
      });
      return out.concat(
        { type: 'heading', level: 2, text: PLAN.studyLabel(i) },
        { type: 'paragraphs', lines: [numbers.length ? 'Answers research question' + (numbers.length > 1 ? 's ' : ' ') + inWords(numbers) + '.' : 'Not linked to a research question yet.'] },
        { type: 'pairs', rows });
    }, []);
  }

  function signOffBlocks(section, draft) {
    const fields = record(draft.fields);
    const all = list(section.fields);
    const rows = [];
    all.forEach((f, i) => {
      if (f.type !== 'checkbox') return;
      const signature = all[i + 1] && all[i + 1].type !== 'checkbox' ? all[i + 1] : null;
      const role = text(f.label.indexOf(':') === -1 ? f.label : f.label.slice(f.label.indexOf(':') + 1));
      const signed = fields[f.key] === 'yes' && signature ? text(fields[signature.key]) : '';
      rows.push([role, text(f.statement), signed || 'Not signed']);
    });
    return rows.length ? [{ type: 'table', header: ['Role', 'Declaration', 'Signed'], rows, emptyWords: ['Not signed'] }] : [];
  }

  // The plan as an outline. `today` is an ISO date, for the last line.
  function view(schema, draft, options) {
    const s = record(schema), d = record(draft), header = record(s.header);
    const opts = record(options);
    const title = header.title ? text(record(d.fields)[header.title.key]) : '';
    const blocks = [{ type: 'title', text: title || 'Untitled research plan' }];

    const meta = list(header.meta);
    const hiddenMeta = hiddenKeys(meta, d);
    const details = meta.filter((f) => !hiddenMeta.has(f.key)).map((f) => [f.label, answerLines(f, d)]);
    if (details.length) blocks.push({ type: 'pairs', rows: details });

    const sections = list(s.sections);
    const hasStudies = sections.some((sec) => list(sec.fields).some((f) => f.type === 'study-questions'));
    sections.forEach((section) => {
      const fields = list(section.fields);
      // How many studies, and which questions each answers, are said with the studies themselves.
      if (fields.some((f) => f.type === 'study-questions')) return;
      if (fields.some((f) => f.type === 'checkbox')) {
        const rows = signOffBlocks(section, d);
        if (rows.length) blocks.push({ type: 'heading', level: 1, text: 'Sign-off' }, ...rows);
        return;
      }
      const methodology = fields.some((f) => f.key === 'methods');
      blocks.push({ type: 'heading', level: 1, text: methodology && hasStudies ? 'Studies and ' + section.title.toLowerCase() : section.title });
      if (methodology) blocks.push(...studyBlocks(section, d));
      const hidden = hiddenKeys(fields, d);
      fields.filter((f) => !hidden.has(f.key) && !(methodology && (f.key === 'methods' || f.perQuestion))).forEach((f) => {
        blocks.push({ type: 'heading', level: 2, text: f.label }, ...answerBlocks(f, d));
      });
    });

    blocks.push({ type: 'note', text: 'Made with Research Plan' + (opts.today ? ' on ' + dateWords(opts.today) : '') + '. Changes made in this document are not brought back into the form.' });
    return { title, blocks };
  }

  // "Usability testing of checkout flow - research plan - 2026-09-17.docx".
  // The title comes first so the files sort by study; what a computer refuses
  // in a filename is dropped, and a very long title is cut.
  function filename(title, today, extension) {
    const clean = text(title).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').replace(/^[. ]+|[. ]+$/g, '').slice(0, 80).trim();
    return (clean ? clean + ' - research plan' : 'Research plan') + (today ? ' - ' + today : '') + '.' + (extension || 'docx');
  }

  // ---------- the .docx ----------

  // XML 1.0 has no place for most control characters, and Word refuses a
  // document that holds one. They arrive by paste. A lone surrogate goes too.
  function clean(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
  }
  const xml = (value) => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // A run of text. A tab is Word's tab; a line break inside a run is Word's break.
  function run(value, props) {
    const rPr = props ? '<w:rPr>' + props + '</w:rPr>' : '';
    const parts = clean(value).split(/(\t|\r\n?|\n)/).map((part) => {
      if (part === '\t') return '<w:tab/>';
      if (/^[\r\n]+$/.test(part)) return '<w:br/>';
      return part ? '<w:t xml:space="preserve">' + xml(part) + '</w:t>' : '';
    }).join('');
    return '<w:r>' + rPr + parts + '</w:r>';
  }
  const para = (inner, pPr) => '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + inner + '</w:p>';
  const styled = (style) => '<w:pStyle w:val="' + style + '"/>';
  const GREY = '<w:i/><w:color w:val="595959"/>';

  const PAGE_WIDTH = 9026;   // A4 less two 2.54 cm margins, in twentieths of a point
  function table(header, rows, options) {
    const opts = record(options);
    const count = Math.max(1, header ? header.length : 0, ...rows.map((r) => r.length));
    // Widths in whole units that add up to the page exactly: the last column takes what is left.
    const even = Math.floor(PAGE_WIDTH / count);
    const widths = opts.widths || Array.from({ length: count }, (_, i) => (i === count - 1 ? PAGE_WIDTH - even * (count - 1) : even));
    const border = (side) => '<w:' + side + ' w:val="single" w:sz="4" w:space="0" w:color="808080"/>';
    const cell = (value, i, head) => {
      const lines = Array.isArray(value) ? value : [value];
      const shown = lines.map(text).filter(Boolean);
      const empty = !shown.length || list(opts.emptyWords).indexOf(shown.join('')) !== -1;
      const words = shown.length ? shown : [NOT_PROVIDED];
      const shade = head || (opts.firstColumnHead && i === 0);
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[i] + '" w:type="dxa"/>' + (shade ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '') + '</w:tcPr>' +
        words.map((line) => para(run(line, shade ? '<w:b/>' : empty ? GREY : ''), '<w:spacing w:after="60"/>')).join('') + '</w:tc>';
    };
    const row = (values, head) => '<w:tr><w:trPr><w:cantSplit/>' + (head ? '<w:tblHeader/>' : '') + '</w:trPr>' +
      Array.from({ length: count }, (_, i) => cell(values[i], i, head)).join('') + '</w:tr>';
    return '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + PAGE_WIDTH + '" w:type="dxa"/><w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('') + '</w:tblBorders>' +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>' +
      (header ? row(header, true) : '') + rows.map((r) => row(r, false)).join('') + '</w:tbl>' +
      // Word wants a paragraph between a table and whatever follows it, the end of the document included.
      para('', '<w:spacing w:after="120"/>');
  }

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  function documentXml(blocks, numbered) {
    const body = blocks.map((b) => {
      if (b.type === 'title') return para(run(b.text), styled('Title'));
      if (b.type === 'heading') return para(run(b.text), styled('Heading' + Math.min(3, Math.max(1, b.level || 1))));
      if (b.type === 'paragraphs') return b.lines.map((line) => para(run(line))).join('');
      if (b.type === 'empty') return para(run(b.text, GREY));
      if (b.type === 'note') return para(run(b.text, '<w:color w:val="595959"/><w:sz w:val="18"/>'), '<w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="808080"/></w:pBdr><w:spacing w:before="360"/>');
      if (b.type === 'list') {
        // A numbered list has a numbering of its own, so each starts at 1.
        const numId = b.ordered ? numbered.push(true) + 1 : 1;
        return b.items.map((item) => para(run(item), styled('ListParagraph') + '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + numId + '"/></w:numPr>')).join('');
      }
      if (b.type === 'pairs') return table(null, b.rows, { widths: [3000, PAGE_WIDTH - 3000], firstColumnHead: true });
      if (b.type === 'table') return table(b.header, b.rows, { emptyWords: b.emptyWords });
      return '';
    }).join('');
    return DECL + '<w:document ' + W + '><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
  }

  // Word's own names for its built-in styles, so the navigation pane, a table
  // of contents and "change the style, change the document" all work.
  function stylesXml() {
    const heading = (id, name, size, level, before) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="' + before + '" w:after="80"/>' + (level === null ? '' : '<w:outlineLvl w:val="' + level + '"/>') + '</w:pPr><w:rPr><w:b/><w:sz w:val="' + size + '"/></w:rPr></w:style>';
    return DECL + '<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      heading('Title', 'Title', 44, null, 0) + heading('Heading1', 'heading 1', 30, 0, 360) + heading('Heading2', 'heading 2', 24, 1, 220) + heading('Heading3', 'heading 3', 22, 2, 160) +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/></w:style></w:styles>';
  }
  // Numbering 1 is the bullets. Each numbered list has a definition of its
  // own, so each starts at 1 in every editor. Sharing one definition and
  // asking it to restart is enough for Word and not for the rest: the second
  // list carried on, 3, 4, in the macOS reader.
  function numberingXml(numberedCount) {
    const level = (format, words) => '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="' + format + '"/><w:lvlText w:val="' + words + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>';
    const definition = (id, format, words) => '<w:abstractNum w:abstractNumId="' + id + '"><w:nsid w:val="' + (0x5A100000 + id).toString(16).toUpperCase() + '"/><w:multiLevelType w:val="hybridMultilevel"/>' + level(format, words) + '</w:abstractNum>';
    let definitions = definition(0, 'bullet', '•'), nums = '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
    for (let i = 0; i < numberedCount; i++) {
      definitions += definition(i + 1, 'decimal', '%1.');
      nums += '<w:num w:numId="' + (i + 2) + '"><w:abstractNumId w:val="' + (i + 1) + '"/></w:num>';
    }
    return DECL + '<w:numbering ' + W + '>' + definitions + nums + '</w:numbering>';
  }

  // UTF-8 by hand: TextEncoder is not everywhere this runs.
  function utf8(string) {
    const out = [];
    for (let i = 0; i < string.length; i++) {
      let c = string.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < string.length) {
        const low = string.charCodeAt(i + 1);
        if (low >= 0xDC00 && low <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (low - 0xDC00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return Uint8Array.from(out);
  }
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // A zip with every file stored as it is. `when` is a Date, for the files' timestamps.
  function zip(files, when) {
    const d = when instanceof Date && !isNaN(when) ? when : new Date(Date.UTC(2026, 0, 1));
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = [], central = [];
    let offset = 0;
    const record_ = (size, write) => { const b = new Uint8Array(size); write(new DataView(b.buffer)); return b; };
    files.forEach(([name, content]) => {
      const n = utf8(name), data = utf8(content), crc = crc32(data);
      const common = (v, at) => { v.setUint16(at, 20, true); v.setUint16(at + 2, 0x0800, true); v.setUint16(at + 4, 0, true); v.setUint16(at + 6, dosTime, true); v.setUint16(at + 8, dosDate, true);
        v.setUint32(at + 10, crc, true); v.setUint32(at + 14, data.length, true); v.setUint32(at + 18, data.length, true); v.setUint16(at + 22, n.length, true); };
      chunks.push(record_(30, (v) => { v.setUint32(0, 0x04034b50, true); common(v, 4); }), n, data);
      central.push(record_(46, (v) => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); common(v, 6); v.setUint32(42, offset, true); }), n);
      offset += 30 + n.length + data.length;
    });
    const centralSize = central.reduce((sum, b) => sum + b.length, 0);
    const end = record_(22, (v) => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, centralSize, true); v.setUint32(16, offset, true); });
    const all = chunks.concat(central, [end]);
    const out = new Uint8Array(all.reduce((sum, b) => sum + b.length, 0));
    let at = 0;
    all.forEach((b) => { out.set(b, at); at += b.length; });
    return out;
  }

  const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  // The outline as the bytes of a .docx (a Uint8Array).
  function docx(planView, options) {
    const numbered = [];
    const documentPart = documentXml(list(record(planView).blocks), numbered);
    return zip([
      ['[Content_Types].xml', DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="' + DOCX_TYPE + '.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'],
      ['_rels/.rels', DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/_rels/document.xml.rels', DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/styles" Target="styles.xml"/><Relationship Id="rId2" Type="' + REL + '/numbering" Target="numbering.xml"/></Relationships>'],
      ['word/document.xml', documentPart],
      ['word/styles.xml', stylesXml()],
      ['word/numbering.xml', numberingXml(numbered.length)],
    ], record(options).when);
  }

  return { view, docx, filename, dateWords, inclusiveDays, DOCX_TYPE, NOT_PROVIDED };
});
