(() => {
  'use strict';

  const DRAFT_KEY = 'research-plan-draft';
  const doc = document.getElementById('doc');

  // ---------- textarea autosize ----------
  function resizeTa(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
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
  function addRow(tableId, colTypes) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    const tr = document.createElement('tr');
    colTypes.forEach((type) => {
      const td = document.createElement('td');
      if (type === 'status') {
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
        inp.placeholder = type === 'date' ? 'Date' : type === 'person' ? 'Person' : 'Enter text…';
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
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
  function evaluateField(text, fieldType) {
    if (fieldType === 'problem') {
      return Promise.resolve(EVAL_DATA[getMockKey(text)]);
    }
    return Promise.reject(new Error('No evaluator for field type: ' + fieldType));
  }

  function renderEval(data) {
    const badge = document.getElementById('eval-badge');
    badge.textContent = data.label;
    badge.style.background = data.color;

    const panel = document.getElementById('eval-panel');
    panel.style.background = data.bg;
    panel.style.borderColor = data.border;

    const metricsEl = document.getElementById('eval-metrics');
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

    const recsEl = document.getElementById('eval-recs');
    recsEl.innerHTML = '';
    data.recs.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'eval-rec';
      li.textContent = r;
      recsEl.appendChild(li);
    });

    panel.hidden = false;
  }

  function initEvaluate() {
    const btn = document.getElementById('eval-btn');
    const btnTxt = document.getElementById('eval-btn-txt');
    const ta = document.getElementById('problem-ta');
    const panel = document.getElementById('eval-panel');

    btn.addEventListener('click', () => {
      const text = ta.value;
      if (!text.trim()) {
        alert('Please enter a problem statement to evaluate.');
        return;
      }
      btn.disabled = true;
      btn.classList.add('loading');
      btnTxt.textContent = 'Evaluating…';
      evaluateField(text, 'problem').then((data) => {
        renderEval(data);
      }).finally(() => {
        btn.disabled = false;
        btn.classList.remove('loading');
        btnTxt.textContent = 'Evaluate Problem';
      });
    });

    document.getElementById('eval-dismiss').addEventListener('click', () => {
      panel.hidden = true;
    });
  }

  // ---------- good/bad example toggle ----------
  function initExampleToggle() {
    const toggle = document.getElementById('example-toggle');
    const panel = document.getElementById('example-panel');
    toggle.addEventListener('click', () => {
      const show = panel.hidden;
      panel.hidden = !show;
      toggle.textContent = show ? 'Hide example' : 'Show example';
    });
  }

  // ---------- clear form ----------
  function clearForm() {
    if (!window.confirm('Reset all fields? This cannot be undone.')) return;
    doc.querySelectorAll('input[type="text"]').forEach((el) => { el.value = ''; });
    doc.querySelectorAll('textarea').forEach((el) => {
      el.value = '';
      resizeTa(el);
    });

    ['stage-table', 'action-table'].forEach((id) => {
      const tbody = document.getElementById(id).querySelector('tbody');
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((row, i) => { if (i > 0) row.remove(); });
    });
    doc.querySelectorAll('.ssel').forEach((el) => { el.value = 'not-started'; });
    initStatusSelects(doc);

    document.getElementById('eval-panel').hidden = true;
    document.getElementById('example-panel').hidden = true;
    document.getElementById('example-toggle').textContent = 'Show example';

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
    return {
      fields,
      stages: readRows('stage-table', ['stage', 'date']),
      actions: readRows('action-table', ['action', 'person', 'status']),
    };
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

    const fillRows = (tableId, colTypes, cols, rows) => {
      if (!rows || rows.length === 0) return;
      const tbody = document.getElementById(tableId).querySelector('tbody');
      tbody.innerHTML = '';
      rows.forEach((rowData) => {
        const tr = addRow(tableId, colTypes);
        const cells = tr.querySelectorAll('input, select');
        cols.forEach((c, i) => { if (cells[i]) cells[i].value = rowData[c] || ''; });
        const sel = tr.querySelector('select');
        if (sel) updateSelectClass(sel);
      });
    };
    fillRows('stage-table', ['text', 'date'], ['stage', 'date'], draft.stages);
    fillRows('action-table', ['text', 'person', 'status'], ['action', 'person', 'status'], draft.actions);

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
  document.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
    initTextareas(doc);
    initStatusSelects(doc);
    initAccordion();
    initEvaluate();
    initExampleToggle();
    initAutosave();

    document.getElementById('add-stage-btn').addEventListener('click', () => addRow('stage-table', ['text', 'date']));
    document.getElementById('add-action-btn').addEventListener('click', () => addRow('action-table', ['text', 'person', 'status']));
    document.getElementById('clear-btn').addEventListener('click', clearForm);
    document.getElementById('print-btn').addEventListener('click', () => window.print());
  });
})();
