/*
 * THROWAWAY SPIKE — GOV.UK fieldset treatment for Researcher / Project Owner.
 * Delete this file and its <script> tag in index.html when the question is
 * answered; nothing else references it.
 *
 * Activated only by ?v=3, so the plain URL renders exactly as before. Like the
 * RPA-44 spike, this rearranges the already-rendered DOM rather than changing
 * app.js — the point is to see the pattern in situ, not to be the
 * implementation.
 *
 * What it demonstrates, in order of how much it actually matters:
 *
 *   1. Hints become visible text above the input instead of a placeholder
 *      inside it. The hint copy already exists — it is the aria-label on the
 *      "?" info-tip — so this just surfaces what was hidden behind a hover.
 *      A placeholder disappears the moment someone types; a hint does not.
 *   2. Real <label for> elements. The current .mlabel is a <div>, so no label
 *      is associated with its input at all — clicking the label does nothing
 *      and screen readers announce the input unlabelled.
 *   3. <fieldset> + <legend> groups both fields as answering one question.
 *   4. GOV.UK's visual scale, applied faithfully so it can be judged honestly.
 *
 * The scale and the yellow focus are the parts most likely to be wrong for
 * this app — see GDS_* below, they are one edit each.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (!params.has('v3') && params.get('v') !== '3') return;

  // The two knobs most likely to need changing. GDS Transport is licensed for
  // GOV.UK only, so this uses Arial — the same fallback govuk-frontend uses
  // for non-government services.
  const GDS_FOCUS = '#ffdd00';   // iconic, accessible, and unmistakably government
  const GDS_INK   = '#0b0c0c';

  const CSS = `
    .v3-flag{position:fixed;top:8px;right:8px;z-index:99;
      font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;
      color:#92400e;background:#fef3c7;border:1px solid #fde68a;padding:5px 8px;border-radius:3px}

    /* Stack, rather than the current two-column meta-grid. */
    .meta-grid.v3-grid{display:block}

    .v3-fieldset{border:0;margin:0 0 8px;padding:0;min-width:0;
      font-family:Arial,Helvetica,sans-serif;color:${GDS_INK}}
    .v3-legend{font-size:24px;font-weight:700;line-height:1.09;padding:0;margin:0 0 20px}
    .v3-fieldset .mf{margin-bottom:20px;display:block}
    .v3-label{display:block;font-size:19px;line-height:1.32;margin-bottom:5px;color:${GDS_INK};
      font-weight:400;letter-spacing:normal;text-transform:none}
    .v3-hint{display:block;font-size:19px;line-height:1.32;color:#505a5f;margin-bottom:5px}
    .v3-fieldset .minput{font-family:inherit;font-size:19px;line-height:1.32;width:100%;
      max-width:20em;height:40px;padding:5px;border:2px solid ${GDS_INK};border-radius:0;
      background:#fff;color:${GDS_INK};appearance:none;box-shadow:none}
    .v3-fieldset .minput:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK};background:#fff}

    /* --- date input (GOV.UK date-input pattern) --- */
    .v3-date-fieldset{margin-top:4px}
    .v3-legend-s{font-size:19px;font-weight:700;margin-bottom:5px}
    .v3-date-row{display:flex;align-items:flex-end;gap:20px;margin-top:5px}
    .v3-date-item{display:flex;flex-direction:column}
    .v3-date-item .v3-label{font-size:19px;margin-bottom:5px}
    .v3-date-fieldset .date-segment{font-family:inherit;font-size:19px;line-height:1.32;
      height:40px;padding:5px;border:2px solid ${GDS_INK};border-radius:0;background:#fff;
      color:${GDS_INK};text-align:left;appearance:none;box-shadow:none}
    .v3-date-fieldset .date-segment:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK};background:#fff}
    .v3-date-fieldset .date-day{width:3.5em}
    .v3-date-fieldset .date-month{width:4.5em}
    .v3-date-fieldset .date-year{width:5.5em}
    .v3-date-fieldset .date-separator{display:none}
    .v3-date-fieldset .date-error{display:block;margin-top:8px;font-size:17px;font-weight:700;color:#d4351d}
    .v3-date-fieldset .date-error[hidden]{display:none}
    /* GOV.UK has no native picker; kept here so the calendar still works. */
    .v3-date-fieldset .date-picker-native{align-self:flex-end;margin-bottom:9px}

    /* --- Alignment as a single-column stack instead of a 2-up grid --- */
    .v3-stack{font-family:Arial,Helvetica,sans-serif;color:${GDS_INK}}
    .v3-stack .v3-fieldset{margin-bottom:30px}
    .v3-stack .v3-group{margin-bottom:20px}
    .v3-stack .cinput{font-family:inherit;font-size:19px;line-height:1.32;width:100%;max-width:20em;
      height:40px;padding:5px;border:2px solid ${GDS_INK};border-radius:0;background:#fff;
      color:${GDS_INK};appearance:none;box-shadow:none}
    .v3-stack .cinput:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK};background:#fff}
    .v3-stack .v3-date-fieldset{margin-bottom:30px}
    /* .tbl-wrap framed the table that is now gone — without it, the border
       just draws a second box inside the accordion's own border. */
    .tbl-wrap.v3-bare{border:0;border-radius:0}

    /* --- Details (progressive disclosure), Alignment only --- */
    .v3-details{display:block;margin:0 0 15px;font-size:19px;line-height:1.32}
    .v3-details>summary{display:list-item;width:fit-content;cursor:pointer;
      color:#1d70b8;text-decoration:underline;text-underline-offset:.1em}
    .v3-details>summary:hover{color:#003078}
    .v3-details>summary:focus{outline:3px solid ${GDS_FOCUS};background:${GDS_FOCUS};
      color:${GDS_INK};text-decoration:none;box-shadow:0 -2px ${GDS_FOCUS},0 4px ${GDS_INK}}
    .v3-details__text{padding:15px;border-left:5px solid #b1b4b6;margin-top:5px}

    @media print{.v3-flag{display:none!important}
      .v3-details__text{display:block!important}}
  `;

  // GOV.UK Details — progressive disclosure for secondary guidance.
  function buildDetails(text, summaryText) {
    const details = document.createElement('details');
    details.className = 'v3-details';
    const summary = document.createElement('summary');
    summary.textContent = summaryText;
    const body = document.createElement('div');
    body.className = 'v3-details__text';
    body.textContent = text;
    details.append(summary, body);
    return details;
  }

  /*
   * Last Updated, as the GOV.UK date-input pattern: a fieldset asking one
   * question, a hint showing the expected format, and three separately
   * labelled Day / Month / Year boxes.
   *
   * Deliberately keeps the existing .date-day/.date-month/.date-year inputs
   * rather than building new ones — app.js's setDateInputValue() and
   * readDateSegments() write straight into them, so reusing them keeps all of
   * RPA-27's parsing, buffering and auto-advance behaviour intact. This only
   * changes presentation.
   *
   * One deliberate divergence: GOV.UK asks for a numeric month. This keeps the
   * "Sep" abbreviation from RPA-27, which removes the DD/MM versus MM/DD
   * ambiguity that a numeric month reintroduces.
   */
  // Deliberately NOT applied to Last Updated. That field is a computed
  // timestamp — setLastUpdatedToday() stamps it, and draftContentSignature()
  // excludes it so stamping cannot re-trigger itself (the RPA-42 fix). The
  // GOV.UK date input is a pattern for asking someone for a date they know;
  // putting three entry boxes on a value the app maintains only invites people
  // to overwrite it. These two are genuinely user-entered deadlines.
  const DATE_FIELDS = [
    ['projectDecision', 'When is the project decision due?'],
    ['reportResearch', 'When will the research be reported?'],
  ];

  function applyDateField(key, legendText) {
    const native = document.querySelector('[data-field="' + key + '"]');
    if (!native) return;
    const control = native.closest('.date-control');
    const cell = control && control.parentElement;
    if (!control || !cell || cell.querySelector('.v3-date-fieldset')) return;

    // Header meta fields label with .mlabel, Alignment table cells with .clbl.
    const labelDiv = cell.querySelector('.mlabel, .clbl');
    const tip = labelDiv ? labelDiv.querySelector('.info-tip') : null;
    const hintText = tip ? tip.getAttribute('aria-label') : '';
    const errorEl = control.querySelector('.date-error');

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'v3-fieldset v3-date-fieldset';
    fieldset.setAttribute('role', 'group');

    const legend = document.createElement('legend');
    legend.className = 'v3-legend v3-legend-s';
    // Placeholder wording — a legend has to frame the group as a question.
    legend.textContent = legendText;
    fieldset.appendChild(legend);

    // The format example stays a visible hint — it is what someone needs while
    // typing, so hiding it behind a disclosure would defeat the point. Only the
    // longer "what is this field for" copy goes into Details.
    const describedBy = [];
    const example = document.createElement('span');
    example.className = 'v3-hint';
    example.id = 'v3-' + key + '-hint';
    example.textContent = 'For example, 27 Mar 2007.';
    fieldset.appendChild(example);
    describedBy.push(example.id);

    if (errorEl && errorEl.id) describedBy.push(errorEl.id);
    fieldset.setAttribute('aria-describedby', describedBy.join(' '));

    if (hintText) fieldset.appendChild(buildDetails(hintText, 'Help with this date'));

    const row = document.createElement('div');
    row.className = 'v3-date-row';

    [['day', 'Day'], ['month', 'Month'], ['year', 'Year']].forEach(([part, text]) => {
      const seg = control.querySelector('.date-' + part);
      if (!seg) return;
      const id = 'v3-' + key + '-' + part;
      seg.id = id;
      // A visible label beats an aria-label, which would otherwise win.
      seg.removeAttribute('aria-label');
      seg.removeAttribute('placeholder');

      const item = document.createElement('div');
      item.className = 'v3-date-item';
      const label = document.createElement('label');
      label.className = 'v3-label';
      label.setAttribute('for', id);
      label.textContent = text;
      item.appendChild(label);
      item.appendChild(seg);
      row.appendChild(item);
    });

    const picker = control.querySelector('.date-picker-native');
    if (picker) row.appendChild(picker);

    fieldset.appendChild(row);
    if (errorEl) fieldset.appendChild(errorEl);

    // dateSegments() and the deadline constraints look the control up via
    // .closest('.date-control'), so the new container has to keep that class.
    fieldset.classList.add('date-control');
    control.remove();
    if (labelDiv) labelDiv.remove();
    cell.appendChild(fieldset);
  }

  /*
   * Alignment: one field per line instead of the 2-up grid, with related
   * fields grouped into fieldsets.
   *
   * Grouping matters here — a fieldset is for fields that answer one question
   * together, not a box round everything. The two dates are deliberately NOT
   * wrapped in an outer fieldset: each date input already needs its own
   * fieldset to group its day/month/year boxes, and nesting one inside another
   * makes screen-reader output worse, not better. They are two questions.
   */
  const ALIGNMENT_GROUPS = [
    { legend: 'What is this research for?', fields: ['project', 'jiraProject'] },
    { legend: null, fields: ['projectDecision', 'reportResearch'] },
    { legend: 'Who has signed this off?', fields: ['signOffProjectOwner', 'signOffResearcher'] },
  ];

  const PLACEHOLDER_IS_LOAD_BEARING = new Set(['jiraProject']);

  function buildStackGroup(key) {
    const input = document.querySelector('[data-field="' + key + '"]');
    if (!input) return null;

    // Dates were already converted to their own fieldset — move as-is.
    const existing = input.closest('.v3-date-fieldset');
    if (existing) return existing;

    const cell = input.closest('td');
    if (!cell) return null;
    const labelDiv = cell.querySelector('.clbl');
    const tip = labelDiv ? labelDiv.querySelector('.info-tip') : null;
    const hintText = tip ? tip.getAttribute('aria-label') : '';
    const labelText = labelDiv
      ? labelDiv.textContent.replace(/\s*\?\s*$/, '').trim()
      : key;

    const id = 'v3-' + key;
    input.id = id;
    // Normally the visible hint makes the placeholder redundant — but some
    // styling keys off :placeholder-shown to detect "has a value" (the Jira
    // field renders as a chip once filled). Stripping the placeholder there
    // makes :not(:placeholder-shown) permanently true, so the chip shows even
    // when empty. Leave those alone.
    if (!PLACEHOLDER_IS_LOAD_BEARING.has(key)) input.removeAttribute('placeholder');

    const group = document.createElement('div');
    group.className = 'v3-group';

    const label = document.createElement('label');
    label.className = 'v3-label';
    label.setAttribute('for', id);
    label.textContent = labelText;
    group.appendChild(label);

    // Details rather than a visible hint, so this section can be compared
    // against the header fields, which keep their hints.
    if (hintText) {
      group.appendChild(buildDetails(hintText, 'Help with ' + labelText.toLowerCase()));
    }

    group.appendChild(input);
    return group;
  }

  function applyAlignmentStack() {
    const table = document.querySelector('table.atbl');
    const wrap = table && table.parentElement;
    if (!table || !wrap || wrap.querySelector('.v3-stack')) return;

    const stack = document.createElement('div');
    stack.className = 'v3-stack';

    ALIGNMENT_GROUPS.forEach(({ legend, fields }) => {
      const built = fields.map(buildStackGroup).filter(Boolean);
      if (!built.length) return;

      if (!legend) {
        built.forEach((node) => stack.appendChild(node));
        return;
      }
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'v3-fieldset';
      const lg = document.createElement('legend');
      lg.className = 'v3-legend v3-legend-s';
      lg.textContent = legend;
      fieldset.appendChild(lg);
      built.forEach((node) => fieldset.appendChild(node));
      stack.appendChild(fieldset);
    });

    table.remove();
    wrap.classList.add('v3-bare');
    wrap.appendChild(stack);
  }

  function applyNameFields() {
    const grid = document.querySelector('.meta-grid');
    if (!grid) return;

    const blocks = ['researcher', 'projectOwner']
      .map((key) => {
        const input = grid.querySelector('[data-field="' + key + '"]');
        return input ? { key, input, mf: input.closest('.mf') } : null;
      })
      .filter((b) => b && b.mf);

    if (blocks.length !== 2) return;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'v3-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'v3-legend';
    // Placeholder wording — a legend has to frame the group as a question,
    // and deciding that question is part of what this spike is asking.
    legend.textContent = 'Who is involved?';
    fieldset.appendChild(legend);

    blocks.forEach(({ key, input, mf }) => {
      const labelDiv = mf.querySelector('.mlabel');
      const tip = labelDiv ? labelDiv.querySelector('.info-tip') : null;

      // The hint copy already exists as the info-tip's aria-label.
      const hintText = tip ? tip.getAttribute('aria-label') : '';
      const labelText = labelDiv
        ? labelDiv.textContent.replace(/\s*\?\s*$/, '').trim()
        : key;

      const id = 'v3-' + key;
      const hintId = id + '-hint';
      input.id = id;
      // The hint is visible now, so the placeholder is redundant noise.
      input.removeAttribute('placeholder');

      const label = document.createElement('label');
      label.className = 'v3-label';
      label.setAttribute('for', id);
      label.textContent = labelText;

      if (labelDiv) labelDiv.remove();
      mf.insertBefore(label, mf.firstChild);

      if (hintText) {
        const hint = document.createElement('span');
        hint.className = 'v3-hint';
        hint.id = hintId;
        hint.textContent = hintText;
        label.insertAdjacentElement('afterend', hint);
        input.setAttribute('aria-describedby', hintId);
      }

      fieldset.appendChild(mf);
    });

    grid.classList.add('v3-grid');
    grid.insertBefore(fieldset, grid.firstChild);
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    DATE_FIELDS.forEach(([key, legend]) => applyDateField(key, legend));
    applyAlignmentStack();   // must run after the dates, so it can move them
    applyNameFields();

    const flag = document.createElement('div');
    flag.className = 'v3-flag';
    flag.textContent = 'v3 fieldset spike';
    document.body.appendChild(flag);
  }

  // app.js fetches and parses research-plan-template.md before rendering the
  // header, so the fields do not exist at DOMContentLoaded. Wait for them.
  function whenReady() {
    const ready = document.querySelector('[data-field="researcher"]')
      && document.querySelector('[data-field="projectOwner"]')
      && document.querySelector('[data-field="projectDecision"]');
    if (ready) { init(); return; }
    if (Date.now() - started > 8000) return;   // give up rather than spin forever
    setTimeout(whenReady, 50);
  }
  const started = Date.now();
  whenReady();
})();
