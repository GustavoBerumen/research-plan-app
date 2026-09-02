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
    .v3-hint-example{display:block}
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

    /* --- Title, as GOV.UK's "label as page heading" --- */
    .v3-title-wrap{margin:0 0 5px;font-family:Arial,Helvetica,sans-serif}
    .v3-page-heading{font-size:36px;font-weight:700;line-height:1.09;color:${GDS_INK};margin:0 0 8px}
    .v3-dateline{font-size:16px;line-height:1.4;color:#505a5f;margin:0 0 28px}
    .v3-hidden{display:none!important}
    .v3-title-input{font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.32;
      font-weight:400;color:${GDS_INK};width:100%;max-width:30em;min-height:40px;padding:5px;
      border:2px solid ${GDS_INK};border-radius:0;background:#fff;box-shadow:none;
      resize:none;overflow:hidden}
    .v3-title-input:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK};background:#fff;border-bottom-color:${GDS_INK}}

    /* --- Sections: a heading and a rule, not a card (option B) ---
       These override style.css rather than !important-ing past it: every
       target is a single-class selector, and this <style> is appended after
       the linked stylesheet, so equal specificity wins on order. The markup
       already does the right thing — .acc-head is a <button> with
       aria-expanded — so this is purely presentational. */
    .acc{margin-bottom:0;border:0;border-top:1px solid #b1b4b6;border-radius:0;overflow:visible}
    .acc:last-of-type{border-bottom:1px solid #b1b4b6}
    .acc-head{background:none;padding:24px 0 16px}
    .acc-head:hover{background:none}
    .acc-head:hover .acc-title{color:#003078}
    .acc-head:focus{outline:3px solid ${GDS_FOCUS};background:${GDS_FOCUS};
      box-shadow:0 -2px ${GDS_FOCUS},0 4px ${GDS_INK}}
    .acc-title{font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;
      letter-spacing:normal;line-height:1.09;color:${GDS_INK}}
    .acc-count{font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#505a5f}
    .acc-chevron{width:18px;height:18px;color:#505a5f}
    .acc-body{padding:0 0 32px}

    /* --- Sign-off: a declaration, not a typed signature --- */
    .v3-signoff-state{font-size:16px;line-height:1.4;color:#505a5f;margin:0 0 10px}
    .v3-signoff-state.is-signed{color:${GDS_INK}}
    .v3-initials{font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.32;
      width:5.5em;height:40px;padding:5px;border:2px solid ${GDS_INK};border-radius:0;
      background:#fff;color:${GDS_INK};text-transform:uppercase;box-shadow:none}
    .v3-initials:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK}}
    .v3-initials-label{display:block;font-size:19px;line-height:1.32;margin-bottom:5px}
    .v3-check{display:flex;align-items:center;gap:12px;margin-top:16px}
    .v3-check input[type="checkbox"]{appearance:none;-webkit-appearance:none;flex:0 0 auto;
      width:40px;height:40px;margin:0;border:2px solid ${GDS_INK};background:#fff;
      cursor:pointer;position:relative;border-radius:0}
    .v3-check input[type="checkbox"]:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:0 0 0 4px ${GDS_INK}}
    .v3-check input[type="checkbox"]:checked::after{content:"";position:absolute;top:9px;left:8px;
      width:20px;height:9px;border:solid ${GDS_INK};border-width:0 0 4px 4px;
      transform:rotate(-45deg);background:transparent}
    .v3-check label{font-size:19px;line-height:1.32;cursor:pointer}

    /* --- Project Context: textarea, hint, and secondary button --- */
    .v3-pc .field{margin-bottom:30px}
    .v3-pc .flabel{display:block;font-family:Arial,Helvetica,sans-serif;font-size:19px;
      font-weight:400;letter-spacing:normal;line-height:1.32;color:${GDS_INK};margin-bottom:5px}
    .v3-pc .finput{font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.32;
      color:${GDS_INK};width:100%;min-height:140px;padding:5px;border:2px solid ${GDS_INK};
      border-radius:0;background:#fff;box-shadow:none;resize:none}
    .v3-pc .finput:focus{outline:3px solid ${GDS_FOCUS};outline-offset:0;
      box-shadow:inset 0 0 0 2px ${GDS_INK};background:#fff}
    /* GOV.UK secondary button — Evaluate is an optional aside, not the
       primary action, so it should not compete with one. */
    .v3-pc .eval-btn{position:relative;font-family:Arial,Helvetica,sans-serif;font-size:19px;
      line-height:1.32;font-weight:400;background:#f3f2f1;color:${GDS_INK};
      border:2px solid transparent;border-radius:0;box-shadow:0 2px 0 #929191;
      padding:8px 10px;margin-top:8px;cursor:pointer}
    .v3-pc .eval-btn:hover{background:#dbdad9}
    .v3-pc .eval-btn:focus{background:${GDS_FOCUS};border-color:${GDS_INK};
      box-shadow:0 2px 0 ${GDS_INK};outline:3px solid transparent}
    .v3-pc .eval-btn:active{top:2px;box-shadow:none}

    /* --- Evaluation results as a GOV.UK notification banner ---
       app.js sets the panel, badge and dot colours inline
       (panel.style.background, badge.style.background, dot.style.background),
       so these need !important to win. A real implementation would move that
       colouring into classes instead. Tone is only exposed as a class on the
       result button, so :has() reaches the panel from it. */
    .v3-pc .eval-panel{background:#fff!important;border:0!important;border-radius:0!important;
      padding:0!important;margin-top:15px;border-top:5px solid #1d70b8!important}
    .v3-pc .eval-head{background:#1d70b8;margin:0;padding:10px 20px;gap:10px}
    .v3-pc .eval-badge{background:transparent!important;color:#fff!important;font-size:19px;
      font-weight:700;letter-spacing:normal;padding:0;border-radius:0}
    .v3-pc .eval-hl{color:#fff;font-size:19px;font-weight:700;letter-spacing:normal}
    .v3-pc .eval-x{color:#fff;font-size:19px;border-radius:0}
    .v3-pc .eval-x:hover{background:rgba(255,255,255,.2);color:#fff}

    .v3-pc .eval-controls:has(.eval-result-success) .eval-panel{border-top-color:#00703c!important}
    .v3-pc .eval-controls:has(.eval-result-success) .eval-head{background:#00703c}
    .v3-pc .eval-controls:has(.eval-result-warning) .eval-panel{border-top-color:#8f4b0a!important}
    .v3-pc .eval-controls:has(.eval-result-warning) .eval-head{background:#8f4b0a}
    .v3-pc .eval-controls:has(.eval-result-problem) .eval-panel{border-top-color:#d4351d!important}
    .v3-pc .eval-controls:has(.eval-result-problem) .eval-head{background:#d4351d}

    .v3-pc .eval-metrics{padding:20px 20px 0;margin:0;border-bottom:0;gap:20px;
      grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
    .v3-pc .eval-mname{font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;
      letter-spacing:normal;line-height:1.32;color:${GDS_INK}}
    .v3-pc .eval-mdesc{font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4;
      color:#505a5f}
    .v3-pc .eval-dots{gap:5px;margin:5px 0}
    .v3-pc .eval-dot{width:14px;height:14px;border-radius:0}
    .v3-pc .eval-rlabel{font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;
      letter-spacing:normal;color:${GDS_INK};padding:0 20px;margin:24px 0 10px}
    .v3-pc .eval-recs{display:block;padding:0 20px 0 40px;margin:0;list-style:disc}
    .v3-pc .eval-rec{display:list-item;font-family:Arial,Helvetica,sans-serif;font-size:19px;
      line-height:1.32;color:${GDS_INK};padding-left:0;margin-bottom:10px}
    .v3-pc .eval-rec::before{content:none}
    .v3-pc .eval-actions{padding:16px 20px 20px;margin:0}
    .v3-pc .eval-reevaluate-btn{position:relative;font-family:Arial,Helvetica,sans-serif;
      font-size:19px;font-weight:400;line-height:1.32;color:${GDS_INK};background:#f3f2f1;
      border:2px solid transparent;border-radius:0;box-shadow:0 2px 0 #929191;padding:8px 10px}
    .v3-pc .eval-reevaluate-btn:hover{background:#dbdad9;color:${GDS_INK}}
    .v3-pc .eval-reevaluate-btn:focus{background:${GDS_FOCUS};border-color:${GDS_INK};
      box-shadow:0 2px 0 ${GDS_INK}}
    .v3-pc .eval-reevaluate-btn:active{top:2px;box-shadow:none}
    .v3-pc .eval-fb-btn{width:40px;height:40px;border:2px solid ${GDS_INK};border-radius:0;
      background:#fff;font-size:16px}
    .v3-pc .eval-fb-btn:hover{background:#f3f2f1}

    @media print{.v3-flag{display:none!important}}
  `;

  function formatLongDate(iso) {
    const parsed = new Date(iso + 'T00:00:00');
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
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
  /*
   * Worked examples are derived from today rather than hardcoded, so they
   * always model a plausible timeline: a decision a month out, and reporting a
   * week before it. That week is not arbitrary — initDeadlineConstraints()
   * warns when reporting lands less than a week before the decision, so the
   * examples demonstrate the minimum buffer the app already asks for.
   */
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function addMonths(date, months) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // 31 Jan + 1 month would roll into March; clamp to the last day instead.
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatExampleDate(date) {
    return String(date.getDate()).padStart(2, '0')
      + ' ' + MONTH_NAMES[date.getMonth()]
      + ' ' + date.getFullYear();
  }

  const DECISION_EXAMPLE = addMonths(new Date(), 1);
  const REPORT_EXAMPLE = addDays(DECISION_EXAMPLE, -7);

  const DATE_FIELDS = [
    ['projectDecision', 'When is the project decision due?', formatExampleDate(DECISION_EXAMPLE)],
    ['reportResearch', 'When will the research be reported?', formatExampleDate(REPORT_EXAMPLE)],
  ];

  function applyDateField(key, legendText, exampleDate) {
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

    // One visible hint: what the field is for, then a worked example of the
    // format. Both matter while typing, so neither is hidden behind a
    // disclosure.
    const describedBy = [];
    const hint = document.createElement('span');
    hint.className = 'v3-hint';
    hint.id = 'v3-' + key + '-hint';
    hint.textContent = hintText || '';
    // Own line: the worked example is a different kind of guidance from the
    // description, and runs together with it when they share a paragraph.
    const example = document.createElement('span');
    example.className = 'v3-hint-example';
    example.textContent = 'For example, ' + exampleDate + '.';
    hint.appendChild(example);
    fieldset.appendChild(hint);
    describedBy.push(hint.id);

    if (errorEl && errorEl.id) describedBy.push(errorEl.id);
    fieldset.setAttribute('aria-describedby', describedBy.join(' '));

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

  /*
   * Title, following GOV.UK's "label as page heading" guidance from the text
   * input component: when a page asks one question, the label is wrapped in an
   * <h1> so the question is the heading.
   *
   * Note the inversion this causes. Today the title *input* is the heading —
   * 27px bold, and the plan's name reads as the document's title. This pattern
   * makes the *question* the heading and the answer ordinary input text. That
   * is right for a form and arguable for a document, which is what we decided
   * this app is. Applied here so the trade can be judged rather than guessed.
   */
  function applyTitle() {
    const input = document.querySelector('[data-field="title"]');
    if (!input || input.id) return;
    const header = input.parentElement;
    if (!header) return;

    const id = 'v3-title';
    input.id = id;
    input.removeAttribute('placeholder');
    input.classList.add('v3-title-input');

    const wrap = document.createElement('div');
    wrap.className = 'v3-title-wrap';

    // GOV.UK's "label as page heading" only applies when a page asks a single
    // question. This page is a whole document, so the heading names the
    // document and the field keeps an ordinary label.
    const h1 = document.createElement('h1');
    h1.className = 'v3-page-heading';
    h1.textContent = 'Research Plan';
    wrap.appendChild(h1);

    // The eyebrow above the title said "Research Plan" too. The heading does
    // that job properly now, so the decorative duplicate goes.
    const sup = document.querySelector('.sup-label');
    if (sup && sup.textContent.trim().toLowerCase() === 'research plan') sup.remove();

    const label = document.createElement('label');
    label.className = 'v3-label';
    label.setAttribute('for', id);
    // "Title" matches what research-plan-template.md calls this field.
    label.textContent = 'Title';
    wrap.appendChild(label);

    const hint = document.createElement('span');
    hint.className = 'v3-hint';
    hint.id = id + '-hint';
    hint.textContent = 'For example, "Mobile checkout abandonment among new shoppers".';
    wrap.appendChild(hint);
    input.setAttribute('aria-describedby', hint.id);

    header.insertBefore(wrap, input);
  }

  /*
   * Last Updated, moved below the heading and rendered as a dateline rather
   * than a date control.
   *
   * It is a computed value — setLastUpdatedToday() stamps it and
   * draftContentSignature() excludes it — so presenting it as an editable date
   * control invited people to overwrite something the app maintains. Above the
   * <h1> it also read as more important than the document's own title, and a
   * screen reader announced the date before saying what the document was.
   *
   * The original input stays in the DOM, hidden, so app.js can keep writing to
   * it. setDateInputValue() writes the value without dispatching an event, so
   * the display is polled rather than driven by a listener — cheap, and honest
   * about being spike code.
   */
  function applyLastUpdatedDateline() {
    const native = document.querySelector('[data-field="lastUpdated"]');
    const wrap = document.querySelector('.v3-title-wrap');
    const heading = wrap && wrap.querySelector('.v3-page-heading');
    if (!native || !heading) return;

    const block = native.closest('.mf');
    if (block) block.classList.add('v3-hidden');

    const line = document.createElement('p');
    line.className = 'v3-dateline';
    heading.insertAdjacentElement('afterend', line);

    function format(iso) {
      if (!iso) return 'Not saved yet';
      const parsed = new Date(iso + 'T00:00:00');
      if (isNaN(parsed.getTime())) return 'Not saved yet';
      return 'Last updated ' + parsed.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    }

    let shown = null;
    function sync() {
      if (native.value === shown) return;
      shown = native.value;
      line.textContent = format(native.value);
    }
    sync();
    setInterval(sync, 500);
  }

  /*
   * Sign-off, as a declaration rather than a typed signature.
   *
   * The old control asked for initials and appended today's date to the same
   * text box, giving one free-text field holding two facts, with the stamped
   * date editable and formatted DD/MM/YYYY — ambiguous, and the same
   * ambiguity RPA-27 removed everywhere else by showing "Sep".
   *
   * More fundamentally, initials in a text box assert approval without
   * establishing it: anyone at the keyboard can type anyone's initials, and
   * there is one form and one autosave. So this claims only what it can
   * deliver — someone confirmed approval, and when. Building real identity
   * would need accounts, which a prototype does not need.
   *
   * Who signed is read from the Researcher / Project Owner names already in
   * the plan rather than typed again.
   *
   * NOT done here: moving sign-off into the review step, where it belongs —
   * you should confirm after reading what you are approving, not halfway up an
   * editable form. That needs the review mode from the RPA-44 spike, not a DOM
   * restyle.
   */
  const SIGN_OFF_FIELDS = [
    { key: 'signOffProjectOwner', label: 'Project Owner', nameField: 'projectOwner' },
    { key: 'signOffResearcher', label: 'Researcher', nameField: 'researcher' },
  ];

  // Stored as "Approved — YYYY-MM-DD". Older drafts hold "JNB — DD/MM/YYYY",
  // which is read as approved on that date so existing plans keep their state.
  function readSignOff(value) {
    const raw = (value || '').trim();
    if (!raw) return null;
    const iso = raw.match(/^(.*?)\s*—\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (iso) {
      // "Approved" is what the short-lived checkbox version wrote, and is not
      // somebody's initials.
      const who = iso[1].trim();
      return {
        iso: iso[2] + '-' + iso[3] + '-' + iso[4],
        who: who && who.toLowerCase() !== 'approved' ? who : null,
      };
    }
    const legacy = raw.match(/^(.*?)\s*—\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    if (legacy) {
      return { iso: legacy[4] + '-' + legacy[3] + '-' + legacy[2], who: legacy[1].trim() || null };
    }
    return { iso: null, who: raw };
  }

  function applySignOff() {
    SIGN_OFF_FIELDS.forEach(({ key, label, nameField }) => {
      const input = document.querySelector('[data-field="' + key + '"]');
      const group = input && input.closest('.v3-group');
      if (!input || !group || group.querySelector('.v3-initials')) return;

      input.classList.add('v3-hidden');

      const fieldLabel = group.querySelector('.v3-label');
      if (fieldLabel) fieldLabel.textContent = label;   // was "Sign off: Project Owner"

      // The stored help text still described the old control ("type initials
      // and the date is added automatically"), so rewrite it.
      const hint = group.querySelector('.v3-hint');
      if (hint) {
        hint.textContent = 'Enter your initials and tick to confirm you approve this plan. '
          + 'The date is recorded automatically. This records that approval was given.';
      }

      const state = document.createElement('p');
      state.className = 'v3-signoff-state';

      const row = document.createElement('div');
      const box = document.createElement('input');
      box.type = 'text';
      box.className = 'v3-initials';
      box.id = 'v3-initials-' + key;
      box.maxLength = 5;
      box.autocomplete = 'off';
      const boxLabel = document.createElement('label');
      boxLabel.className = 'v3-initials-label';
      boxLabel.setAttribute('for', box.id);
      boxLabel.textContent = 'Your initials';
      row.append(boxLabel, box);

      // The initials say who; ticking is the act of approving. A plan counts
      // as signed only once the box is ticked, so typing initials alone never
      // records an approval nobody made.
      const check = document.createElement('div');
      check.className = 'v3-check';
      const tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.id = 'v3-approve-' + key;
      const tickLabel = document.createElement('label');
      tickLabel.setAttribute('for', tick.id);
      tickLabel.textContent = 'I approve this research plan';
      check.append(tick, tickLabel);
      row.appendChild(check);

      // Falls back to the name already in the plan when a draft was signed
      // without initials.
      function planName() {
        const named = document.querySelector('[data-field="' + nameField + '"]');
        const value = named ? named.value.trim() : '';
        return value || null;
      }

      function render() {
        const stored = readSignOff(input.value);
        if (document.activeElement !== box && stored && stored.who) box.value = stored.who;
        tick.checked = !!stored;
        if (!stored) {
          state.textContent = 'Not yet signed';
          state.classList.remove('is-signed');
          return;
        }
        const who = stored.who || planName();
        const when = stored.iso ? formatLongDate(stored.iso) : null;
        state.textContent = 'Approved'
          + (who ? ' by ' + who : '')
          + (when ? ' on ' + when : '');
        state.classList.add('is-signed');
      }

      function store() {
        if (!tick.checked) {
          input.value = '';
        } else {
          // Keep the original date once signed, so correcting initials never
          // silently re-dates an approval.
          const existing = readSignOff(input.value);
          const iso = existing && existing.iso ? existing.iso : todayIso();
          input.value = box.value.trim().toUpperCase() + ' — ' + iso;
        }
        // app.js autosaves off input events, so tell it something changed.
        input.dispatchEvent(new Event('input', { bubbles: true }));
        render();
      }

      box.addEventListener('input', store);
      tick.addEventListener('change', store);

      group.insertBefore(state, input);
      group.insertBefore(row, input);
      render();
    });

    const legend = Array.from(document.querySelectorAll('.v3-legend'))
      .find((l) => /signed this off/i.test(l.textContent));
    if (legend) legend.textContent = 'Sign-off';
  }

  /*
   * Project Context: the same treatment as the header and Alignment, applied
   * to the long-form fields.
   *
   * Scoped to this one section because that is what was asked for. Every
   * accordion section uses the same .field / .flabel / .finput markup, so
   * widening it is a matter of changing the selector below.
   *
   * The label fix matters beyond the styling: .flabel is a <label> element but
   * carries no "for" and does not wrap its input, so it was associated with
   * nothing — the same defect the label-association ticket covers.
   */
  const CONTEXT_SECTION = 'body-project-context';

  function applyProjectContext() {
    const body = document.getElementById(CONTEXT_SECTION);
    if (!body || body.classList.contains('v3-pc')) return;
    body.classList.add('v3-pc');

    body.querySelectorAll('.field').forEach((field) => {
      const input = field.querySelector('.finput');
      const label = field.querySelector('.flabel');
      if (!input || !label) return;

      const key = input.getAttribute('data-field');
      const tip = label.querySelector('.info-tip');
      const hintText = tip ? tip.getAttribute('aria-label') : '';

      const id = 'v3-pc-' + key;
      input.id = id;
      label.setAttribute('for', id);
      label.textContent = label.textContent.replace(/\s*\?\s*$/, '').trim();

      if (!PLACEHOLDER_IS_LOAD_BEARING.has(key)) input.removeAttribute('placeholder');

      if (hintText) {
        const hint = document.createElement('span');
        hint.className = 'v3-hint';
        hint.id = id + '-hint';
        hint.textContent = hintText;
        label.insertAdjacentElement('afterend', hint);
        input.setAttribute('aria-describedby', hint.id);
      }
    });
  }

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

    // Visible hint, matching the header fields. Details was tried here and
    // measured worse: it saved no vertical space (the disclosure link costs
    // what the hint did) while hiding guidance behind an extra click.
    if (hintText) {
      const hint = document.createElement('span');
      hint.className = 'v3-hint';
      hint.id = id + '-hint';
      hint.textContent = hintText;
      group.appendChild(hint);
      input.setAttribute('aria-describedby', hint.id);
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

    applyTitle();
    applyLastUpdatedDateline();   // needs the title wrap and heading to exist
    DATE_FIELDS.forEach(([key, legend, example]) => applyDateField(key, legend, example));
    applyAlignmentStack();   // must run after the dates, so it can move them
    applySignOff();          // needs the stack's .v3-group wrappers to exist
    applyProjectContext();
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
