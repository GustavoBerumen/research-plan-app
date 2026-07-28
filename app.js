(() => {
  'use strict';

  const DRAFT_KEY = 'research-plan-draft';
  const SCHEMA_URL = 'research-plan-template.md';
  const doc = document.getElementById('doc');

  // tables holds one entry per rendered <table> field: its DOM id, the
  // column definitions (for building rows), and the column keys (for
  // reading/writing draft rows as plain objects).
  const tables = [];

  // ---------- small DOM helper ----------
  function el(tag, className, attrs) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // ---------- schema parsing (research-plan-template.md) ----------
  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function toCamelKey(label) {
    const words = label.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return words.map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join('');
  }

  function parseColumns(spec) {
    return spec.split('|').map((part) => {
      part = part.trim();
      let [labelType, placeholder] = part.split('=');
      let [label, type] = labelType.split(':');
      label = label.trim();
      type = (type || 'text').trim().toLowerCase();
      if (placeholder === undefined) {
        placeholder = type === 'date' ? 'Date' : type === 'person' ? 'Person' : type === 'status' ? '' : 'Enter text…';
      } else {
        placeholder = placeholder.trim();
      }
      return { label, key: toCamelKey(label), type, placeholder };
    });
  }

  function parseFieldLine(line) {
    const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(.*)$/);
    if (!m) return null;
    const label = m[1].trim();
    const typeParts = m[2].split(',').map((s) => s.trim().toLowerCase());
    const type = typeParts[0];
    const field = {
      label,
      key: toCamelKey(label),
      type,
      optional: typeParts.includes('optional'),
      eval: typeParts.includes('eval'),
    };
    if (type === 'table') {
      field.columns = parseColumns(m[3].trim());
    } else {
      field.placeholder = m[3].trim();
    }
    return field;
  }

  function parseHeading(line) {
    const m = line.match(/^#\s+(.+?)(?:\s*\{([^}]*)\})?\s*$/);
    if (!m) return null;
    const flags = (m[2] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return { title: m[1].trim(), open: flags.includes('open'), grid: flags.includes('grid') };
  }

  function parseSchema(text) {
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    const lines = text.split('\n');
    const header = { title: null, meta: [] };
    const sections = [];
    let mode = 'header-pretitle';
    let currentSection = null;
    let currentField = null;

    lines.forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;

      if (/^#\s+/.test(line)) {
        if (mode === 'header-pretitle') {
          const titleField = parseFieldLine(line.replace(/^#\s+/, ''));
          header.title = titleField || { label: 'Title', key: 'title', type: 'text', placeholder: '' };
          mode = 'header-meta';
          currentField = header.title;
          return;
        }
        const heading = parseHeading(line);
        currentSection = { title: heading.title, slug: slugify(heading.title), open: heading.open, grid: heading.grid, fields: [] };
        sections.push(currentSection);
        mode = 'section';
        currentField = null;
        return;
      }

      const exMatch = raw.match(/^\s+(Good|Bad):\s*(.*)$/i);
      if (exMatch && currentField) {
        currentField.examples = currentField.examples || {};
        currentField.examples[exMatch[1].toLowerCase()] = exMatch[2].trim();
        return;
      }

      const field = parseFieldLine(line);
      if (!field) return;

      if (mode === 'header-meta') {
        header.meta.push(field);
      } else if (mode === 'section') {
        currentSection.fields.push(field);
      }
      currentField = field;
    });

    return { header, sections };
  }

  // ---------- textarea autosize ----------
  function resizeTa(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
  function initTextareas(root) {
    root.querySelectorAll('.field-ta').forEach((ta) => {
      resizeTa(ta);
      ta.addEventListener('input', () => resizeTa(ta));
    });
  }

  // ---------- status select coloring ----------
  const STATUS_CLASS = {
    'not-started': 'ss-ns',
    'in-progress': 'ss-ip',
    'complete': 'ss-done',
    'blocked': 'ss-block',
  };
  function updateSelectClass(sel) {
    sel.className = 'ssel ' + (STATUS_CLASS[sel.value] || 'ss-ns');
  }
  function initStatusSelects(root) {
    root.querySelectorAll('.ssel').forEach((sel) => {
      updateSelectClass(sel);
      if (!sel._bound) {
        sel.addEventListener('change', () => updateSelectClass(sel));
        sel._bound = true;
      }
    });
  }

  // ---------- accordion ----------
  function setAccOpen(head, open) {
    const acc = head.closest('.acc');
    const body = document.getElementById(head.getAttribute('aria-controls'));
    acc.dataset.open = open ? 'true' : 'false';
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
  }
  function initAccordion() {
    document.querySelectorAll('[data-acc-toggle]').forEach((head) => {
      head.addEventListener('click', () => {
        const isOpen = head.getAttribute('aria-expanded') === 'true';
        setAccOpen(head, !isOpen);
      });
    });
  }

  // ---------- dynamic table rows ----------
  function buildRow(columns) {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      if (col.type === 'status') {
        const sel = document.createElement('select');
        sel.className = 'ssel ss-ns';
        [['not-started', 'Not Started'], ['in-progress', 'In Progress'], ['complete', 'Complete'], ['blocked', 'Blocked']].forEach(([v, l]) => {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = l;
          sel.appendChild(o);
        });
        sel.addEventListener('change', () => updateSelectClass(sel));
        td.appendChild(sel);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'cinput';
        inp.placeholder = col.placeholder || '';
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
    return tr;
  }

  function addRow(tableId, columns) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    const tr = buildRow(columns);
    tbody.appendChild(tr);
    const first = tr.querySelector('input, select');
    if (first) first.focus();
    return tr;
  }

  // ---------- evaluate (mock — swap body for a real Claude API call later) ----------
  function getMockKey(text) {
    const len = text.trim().length;
    if (len < 50) return 'needs-work';
    if (len < 130) return 'developing';
    if (len < 260) return 'good';
    return 'ready';
  }

  const EVAL_DATA = {
    'needs-work': {
      label: 'Needs Work', color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
      metrics: [
        { name: 'Clarity', score: 1, desc: 'Statement is vague and undefined' },
        { name: 'Specificity', score: 1, desc: 'No measurable criteria mentioned' },
        { name: 'Feasibility', score: 2, desc: 'Scope too broad to assess' },
        { name: 'Significance', score: 1, desc: 'User or business impact not stated' },
      ],
      recs: [
        'Define the specific user segment affected — narrow it to one persona and context.',
        'Include quantifiable data such as drop-off rates, error frequency, or support volume.',
        'Link the problem directly to a measurable business or UX outcome to establish stakes.',
      ],
    },
    'developing': {
      label: 'Developing', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa',
      metrics: [
        { name: 'Clarity', score: 2, desc: 'Problem area identified, scope is broad' },
        { name: 'Specificity', score: 2, desc: 'Some context; key metrics are missing' },
        { name: 'Feasibility', score: 3, desc: 'Addressable, but constraints are unclear' },
        { name: 'Significance', score: 2, desc: 'Impact implied but not quantified' },
      ],
      recs: [
        'Narrow the scope to a single, well-defined friction point in the user journey.',
        'Add baseline data — e.g. current conversion rate, NPS score, or task completion rate.',
        'Specify which user personas are most affected and articulate the cost to them clearly.',
      ],
    },
    'good': {
      label: 'Good', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
      metrics: [
        { name: 'Clarity', score: 4, desc: 'Well described with sufficient context' },
        { name: 'Specificity', score: 3, desc: 'Good detail; success criteria could sharpen' },
        { name: 'Feasibility', score: 4, desc: 'Well-scoped and clearly actionable' },
        { name: 'Significance', score: 4, desc: 'User and business impact are evident' },
      ],
      recs: [
        'Add a root-cause hypothesis to sharpen your research focus and inform methodology choice.',
        'Quantify the expected impact if this problem is resolved to strengthen prioritisation.',
        'Identify known constraints (time, budget, technical) that may affect the solution space.',
      ],
    },
    'ready': {
      label: 'Ready', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
      metrics: [
        { name: 'Clarity', score: 5, desc: 'Precisely articulated with clear scope' },
        { name: 'Specificity', score: 5, desc: 'Metrics, segments, and context all defined' },
        { name: 'Feasibility', score: 5, desc: 'Constraints acknowledged and actionable' },
        { name: 'Significance', score: 4, desc: 'Business and user impact well established' },
      ],
      recs: [
        'Stress-test the statement with a secondary stakeholder before finalising it.',
        'Ensure each research question maps directly to a dimension of the problem described.',
        'Document assumptions baked into this statement to revisit them after fieldwork.',
      ],
    },
  };

  // Swap this function's body for a real API call later; callers don't change.
  function evaluateField(text) {
    return Promise.resolve(EVAL_DATA[getMockKey(text)]);
  }

  function renderEvalResult(panel, data) {
    panel.style.background = data.bg;
    panel.style.borderColor = data.border;

    const badge = panel.querySelector('.eval-badge');
    badge.textContent = data.label;
    badge.style.background = data.color;

    const metricsEl = panel.querySelector('.eval-metrics');
    metricsEl.innerHTML = '';
    data.metrics.forEach((m) => {
      const wrap = document.createElement('div');
      wrap.className = 'eval-metric';
      const name = document.createElement('div');
      name.className = 'eval-mname';
      name.textContent = m.name;
      const dots = document.createElement('div');
      dots.className = 'eval-dots';
      for (let i = 0; i < 5; i++) {
        const dot = document.createElement('span');
        dot.className = 'eval-dot';
        dot.style.background = i < m.score ? data.color : '#e5e7eb';
        dots.appendChild(dot);
      }
      const desc = document.createElement('div');
      desc.className = 'eval-mdesc';
      desc.textContent = m.desc;
      wrap.append(name, dots, desc);
      metricsEl.appendChild(wrap);
    });

    const recsEl = panel.querySelector('.eval-recs');
    recsEl.innerHTML = '';
    data.recs.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'eval-rec';
      li.textContent = r;
      recsEl.appendChild(li);
    });

    panel.hidden = false;
  }

  // ---------- field rendering ----------
  function renderExamplePanel(field) {
    const toggle = el('button', 'ex-toggle', { type: 'button' });
    toggle.textContent = 'Show example';

    const panel = el('div', 'ex-panel');
    panel.hidden = true;
    if (field.examples.good) {
      const g = el('div', 'ex-block ex-good');
      const lbl = el('span', 'ex-block-label');
      lbl.textContent = 'Good';
      g.append(lbl, field.examples.good);
      panel.appendChild(g);
    }
    if (field.examples.bad) {
      const b = el('div', 'ex-block ex-bad');
      const lbl = el('span', 'ex-block-label');
      lbl.textContent = 'Bad';
      b.append(lbl, field.examples.bad);
      panel.appendChild(b);
    }

    toggle.addEventListener('click', () => {
      const show = panel.hidden;
      panel.hidden = !show;
      toggle.textContent = show ? 'Hide example' : 'Show example';
    });

    return [toggle, panel];
  }

  function renderEvalControls(field, input) {
    const btn = el('button', 'eval-btn', { type: 'button' });
    const spinner = el('span', 'eval-spinner');
    const txt = el('span');
    txt.textContent = 'Evaluate ' + field.label;
    btn.append(spinner, txt);

    const panel = el('div', 'eval-panel');
    panel.hidden = true;
    const head = el('div', 'eval-head');
    const badge = el('span', 'eval-badge');
    const hl = el('span', 'eval-hl');
    hl.textContent = field.label + ' Evaluation';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    head.append(badge, hl, dismiss);
    const metrics = el('div', 'eval-metrics');
    const rlabel = el('div', 'eval-rlabel');
    rlabel.textContent = 'Recommendations';
    const recs = el('ul', 'eval-recs');
    panel.append(head, metrics, rlabel, recs);

    btn.addEventListener('click', () => {
      const text = input.value;
      if (!text.trim()) {
        alert('Please enter a value to evaluate.');
        return;
      }
      btn.disabled = true;
      btn.classList.add('loading');
      txt.textContent = 'Evaluating…';
      evaluateField(text).then((data) => {
        renderEvalResult(panel, data);
      }).finally(() => {
        btn.disabled = false;
        btn.classList.remove('loading');
        txt.textContent = 'Evaluate ' + field.label;
      });
    });
    dismiss.addEventListener('click', () => { panel.hidden = true; });

    return [btn, panel];
  }

  function renderTableField(field) {
    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    wrap.appendChild(label);

    const tblWrap = el('div', 'tbl-wrap');
    const table = el('table', 'dtbl', { id: field.key + '-table' });
    const thead = el('thead');
    const headRow = el('tr');
    field.columns.forEach((c) => {
      const th = document.createElement('th');
      th.textContent = c.label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    const tbody = el('tbody');
    tbody.appendChild(buildRow(field.columns));
    table.append(thead, tbody);
    tblWrap.appendChild(table);
    wrap.appendChild(tblWrap);

    tables.push({ id: table.id, columns: field.columns, cols: field.columns.map((c) => c.key) });

    const addBtn = el('button', 'add-btn', { type: 'button' });
    const singular = field.label.replace(/s$/i, '').toLowerCase();
    addBtn.textContent = '+ Add ' + singular;
    addBtn.addEventListener('click', () => addRow(table.id, field.columns));
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderField(field) {
    if (field.type === 'table') return renderTableField(field);

    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    if (field.optional) {
      const opt = el('span', 'fopt');
      opt.textContent = '(optional)';
      label.append(' ', opt);
    }
    wrap.appendChild(label);

    const isTextarea = field.type === 'textarea';
    const input = el(isTextarea ? 'textarea' : 'input', isTextarea ? 'finput field-ta' : 'finput', {
      'data-field': field.key,
      placeholder: field.placeholder || '',
    });
    if (!isTextarea) input.type = field.type === 'date' ? 'date' : 'text';
    wrap.appendChild(input);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) wrap.append(...renderEvalControls(field, input));

    return wrap;
  }

  function renderChevron() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'acc-chevron');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M9 6l6 6-6 6');
    svg.appendChild(path);
    return svg;
  }

  function renderSection(section) {
    const bodyId = 'body-' + section.slug;
    const acc = el('div', 'acc', { 'data-open': section.open ? 'true' : 'false' });

    const head = el('button', 'acc-head', {
      type: 'button',
      'data-acc-toggle': '',
      'aria-expanded': section.open ? 'true' : 'false',
      'aria-controls': bodyId,
    });
    const headLeft = el('div', 'acc-head-left');
    const titleSpan = el('span', 'acc-title');
    titleSpan.textContent = section.title;
    headLeft.append(renderChevron(), titleSpan);
    const count = el('span', 'acc-count');
    count.textContent = section.fields.length + (section.fields.length === 1 ? ' field' : ' fields');
    head.append(headLeft, count);
    acc.appendChild(head);

    const body = el('div', 'acc-body', { id: bodyId });
    body.hidden = !section.open;

    if (section.grid) {
      const tblWrap = el('div', 'tbl-wrap');
      const table = el('table', 'atbl');
      const tbody = el('tbody');
      for (let i = 0; i < section.fields.length; i += 2) {
        const tr = el('tr');
        [section.fields[i], section.fields[i + 1]].forEach((f) => {
          const td = document.createElement('td');
          if (f) {
            const lbl = el('div', 'clbl');
            lbl.textContent = f.label;
            const inp = el('input', 'cinput', { type: f.type === 'date' ? 'date' : 'text', 'data-field': f.key, placeholder: f.placeholder || '' });
            td.append(lbl, inp);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tblWrap.appendChild(table);
      body.appendChild(tblWrap);
    } else {
      const fieldsWrap = el('div', 'fields');
      section.fields.forEach((f) => fieldsWrap.appendChild(renderField(f)));
      body.appendChild(fieldsWrap);
    }

    acc.appendChild(body);
    return acc;
  }

  function renderHeader(header) {
    const wrap = el('div', 'doc-header');
    const supLabel = el('div', 'sup-label');
    supLabel.textContent = 'Research Plan';
    wrap.appendChild(supLabel);

    const titleInput = el('input', 'title-inp', {
      type: 'text',
      'data-field': header.title.key,
      placeholder: header.title.placeholder || 'Title for your research plan',
    });
    wrap.appendChild(titleInput);

    const metaGrid = el('div', 'meta-grid');
    header.meta.forEach((f) => {
      const mf = el('div', 'mf');
      const label = el('div', 'mlabel');
      label.textContent = f.label;
      const input = el('input', 'minput', { type: f.type === 'date' ? 'date' : 'text', 'data-field': f.key, placeholder: f.placeholder || '' });
      mf.append(label, input);
      metaGrid.appendChild(mf);
    });
    wrap.appendChild(metaGrid);

    return wrap;
  }

  function renderSchema(schema) {
    doc.innerHTML = '';
    tables.length = 0;
    doc.appendChild(renderHeader(schema.header));
    schema.sections.forEach((s) => doc.appendChild(renderSection(s)));
  }

  // ---------- clear form ----------
  function clearForm() {
    if (!window.confirm('Reset all fields? This cannot be undone.')) return;
    doc.querySelectorAll('input[type="text"]').forEach((el) => { el.value = ''; });
    doc.querySelectorAll('textarea').forEach((el) => {
      el.value = '';
      resizeTa(el);
    });

    tables.forEach(({ id }) => {
      const tbody = document.getElementById(id).querySelector('tbody');
      tbody.querySelectorAll('tr').forEach((row, i) => { if (i > 0) row.remove(); });
    });
    doc.querySelectorAll('.ssel').forEach((el) => { el.value = 'not-started'; updateSelectClass(el); });

    doc.querySelectorAll('.eval-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.ex-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.ex-toggle').forEach((t) => { t.textContent = 'Show example'; });

    localStorage.removeItem(DRAFT_KEY);
  }

  // ---------- save / restore draft ----------
  function serializeDraft() {
    const fields = {};
    doc.querySelectorAll('[data-field]').forEach((el) => {
      fields[el.dataset.field] = el.value;
    });
    const readRows = (tableId, cols) => {
      const rows = [];
      document.getElementById(tableId).querySelectorAll('tbody tr').forEach((tr) => {
        const cells = tr.querySelectorAll('input, select');
        const row = {};
        cols.forEach((c, i) => { row[c] = cells[i] ? cells[i].value : ''; });
        rows.push(row);
      });
      return rows;
    };
    const tableData = {};
    tables.forEach(({ id, cols }) => { tableData[id] = readRows(id, cols); });
    return { fields, tables: tableData };
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializeDraft()));
    } catch (e) {
      // localStorage unavailable (e.g. private browsing) — fail silently, nothing to recover
    }
  }

  function restoreDraft() {
    let raw;
    try {
      raw = localStorage.getItem(DRAFT_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    let draft;
    try {
      draft = JSON.parse(raw);
    } catch (e) {
      return;
    }

    Object.entries(draft.fields || {}).forEach(([key, value]) => {
      const el = doc.querySelector(`[data-field="${key}"]`);
      if (el) el.value = value;
    });

    tables.forEach(({ id, cols, columns }) => {
      const rows = draft.tables && draft.tables[id];
      if (!rows || rows.length === 0) return;
      const tbody = document.getElementById(id).querySelector('tbody');
      tbody.innerHTML = '';
      rows.forEach((rowData) => {
        const tr = buildRow(columns);
        tbody.appendChild(tr);
        const cells = tr.querySelectorAll('input, select');
        cols.forEach((c, i) => { if (cells[i]) cells[i].value = rowData[c] || ''; });
        const sel = tr.querySelector('select');
        if (sel) updateSelectClass(sel);
      });
    });

    doc.querySelectorAll('.field-ta').forEach(resizeTa);
  }

  function initAutosave() {
    let t = null;
    doc.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(saveDraft, 400);
    });
    doc.addEventListener('change', () => {
      clearTimeout(t);
      t = setTimeout(saveDraft, 400);
    });
  }

  // ---------- wire up ----------
  function showLoadError(err) {
    doc.innerHTML = '';
    const msg = el('div', 'doc-error');
    msg.textContent = 'Could not load "' + SCHEMA_URL + '" (' + err.message + '). ' +
      'If you opened this file directly from disk (file://), browsers block that fetch — ' +
      'serve the folder over a local server instead, e.g. run `python3 -m http.server` here ' +
      'and open http://localhost:8000/.';
    doc.appendChild(msg);
    console.error('Failed to load field schema:', err);
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetch(SCHEMA_URL)
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((text) => {
        renderSchema(parseSchema(text));
        restoreDraft();
        initTextareas(doc);
        initStatusSelects(doc);
        initAccordion();
        initAutosave();
        document.getElementById('clear-btn').addEventListener('click', clearForm);
        document.getElementById('print-btn').addEventListener('click', () => window.print());
      })
      .catch(showLoadError);
  });
})();
