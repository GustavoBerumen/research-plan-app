/*
 * THROWAWAY SPIKE — RPA-55 section order. Delete this file and its <script>
 * tag in index.html once the order is settled; nothing else references it.
 *
 * Activated only by ?v=4, so the plain URL renders exactly as before. Like the
 * other spikes here, it rearranges the already-rendered DOM rather than editing
 * research-plan-template.md — the real change is a handful of moved blocks in
 * that file, but doing it this way keeps both orders runnable side by side.
 *
 * What it tries, and why:
 *
 *   Project Context first, Research second. Project Context is the input to
 *   Research — you cannot write a defensible Objective without having engaged
 *   with the problem. This assumes Project Context is reviewed rather than
 *   transcribed; if those fields are not sourced from Jira first, this order
 *   opens the form with its least-owned task, which is the opposite of what
 *   question 3 of the audit asks for.
 *
 *   Alignment last. Project and Jira Project are administrative, and the two
 *   sign-off fields are already headed for a review step per RPA-55.
 *
 *   Except the dates, which are lifted out to the top. Project Decision and
 *   Report Research are constraints on the whole plan, not paperwork: they
 *   feed the deadline check, and knowing the deadline shapes the method and
 *   the timeline. Left at the bottom, people design a study and only then
 *   discover they have three weeks.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (!params.has('v4') && params.get('v') !== '4') return;

  // Alignment keeps its identifiers; everything else is ordered before it.
  const ORDER = ['Project Context', 'Research', 'Methodology', 'Execution',
    'Resources', 'Alignment'];

  const CSS = `
    .v4-flag{position:fixed;top:8px;right:8px;z-index:99;
      font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;
      color:#1e40af;background:#dbeafe;border:1px solid #bfdbfe;padding:5px 8px;border-radius:3px}
    /* Deliberately the same grid as .meta-grid — 1fr 1fr, 36px gap, no
       padding of its own — so the two dates line up exactly with Researcher
       and Project Owner above. A table cannot reproduce that: cell padding
       comes out of the percentage, so equal-width cells still yield unequal
       controls. No card either, matching the sections on main. */
    .v4-keydates{margin:0 0 28px;padding:0;border:0}
    .v4-keydates-title{font-size:var(--text,16px);font-weight:700;color:var(--ink,#0b0c0c);
      margin-bottom:14px}
    .v4-keydates-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 36px}
    .v4-keydates-cell{display:flex;flex-direction:column;min-width:0}
    @media print{.v4-flag{display:none!important}}
  `;

  function sectionsByTitle() {
    const map = new Map();
    document.querySelectorAll('.acc').forEach((acc) => {
      const t = acc.querySelector('.acc-title');
      if (t) map.set(t.textContent.trim(), acc);
    });
    return map;
  }

  /*
   * Project Decision and Report Research are the whole of the Alignment
   * table's second row. Each cell's contents — label, hint and date control —
   * are moved into a grid cell, so the controls themselves are never rebuilt:
   * the segmented editor, the start-before-completion constraint and the
   * deadline check all come across untouched, along with the label
   * associations the redesign added.
   */
  function liftKeyDates(doc, header) {
    const anchor = doc.querySelector('[data-field="projectDecision"]');
    const row = anchor && anchor.closest('tr');
    if (!row) return null;

    const fields = Array.from(row.querySelectorAll('[data-field]'))
      .map((el) => el.getAttribute('data-field'));
    if (!fields.includes('reportResearch')) return null;   // not the row we expect

    const block = document.createElement('div');
    block.className = 'v4-keydates';
    const title = document.createElement('div');
    title.className = 'v4-keydates-title';
    title.textContent = 'Key dates';
    const grid = document.createElement('div');
    grid.className = 'v4-keydates-grid';

    Array.from(row.children).forEach((td) => {
      const cell = document.createElement('div');
      cell.className = 'v4-keydates-cell';
      while (td.firstChild) cell.appendChild(td.firstChild);
      grid.appendChild(cell);
    });
    row.remove();                        // the emptied row leaves Alignment

    block.append(title, grid);
    header.insertAdjacentElement('afterend', block);
    return block;
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const doc = document.querySelector('.doc');
    const header = doc && doc.querySelector('.doc-header');
    if (!doc || !header) return;

    const sections = sectionsByTitle();
    const keyDates = liftKeyDates(doc, header);
    const after = keyDates || header;

    // Re-append in the new order. appendChild moves rather than copies, so the
    // comments block stays last by being appended after them.
    let cursor = after;
    ORDER.forEach((name) => {
      const acc = sections.get(name);
      if (!acc) return;
      cursor.insertAdjacentElement('afterend', acc);
      cursor = acc;
    });
    const comments = doc.querySelector('.comments-block');
    if (comments) cursor.insertAdjacentElement('afterend', comments);

    const flag = document.createElement('div');
    flag.className = 'v4-flag';
    flag.textContent = 'v4 order spike';
    document.body.appendChild(flag);
  }

  // app.js fetches and parses the template before rendering, so the sections
  // do not exist at DOMContentLoaded.
  const started = Date.now();
  (function whenReady() {
    if (document.querySelectorAll('.acc').length >= 6) { init(); return; }
    if (Date.now() - started > 8000) return;
    setTimeout(whenReady, 50);
  })();
})();
