/*
 * RPA-44 — THROWAWAY SPIKE. Delete this file and its <script> tag in index.html
 * when the ticket closes; nothing else references it.
 *
 * Presents the plan one section at a time, activated only by ?v=2 so the plain
 * URL is untouched. Deliberately works by rearranging the already-rendered DOM
 * rather than by changing app.js — the point is to answer the questions in
 * RPA-44 cheaply, not to be the implementation.
 */
(() => {
  'use strict';
  if (!new URLSearchParams(window.location.search).has('v2')
      && new URLSearchParams(window.location.search).get('v') !== '2') return;

  const CSS = `
    .v2-hidden{display:none!important}
    .v2-bar{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e5e7eb;
      padding:10px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .v2-flag{font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;
      color:#92400e;background:#fef3c7;border:1px solid #fde68a;padding:4px 7px;border-radius:3px}
    .v2-rail{display:flex;gap:4px;flex-wrap:wrap;flex:1 1 auto}
    .v2-step{font:500 12px/1.2 inherit;padding:5px 9px;border-radius:3px;border:1px solid transparent;
      background:none;color:#6b7280;cursor:pointer}
    .v2-step:hover{background:#f3f4f6;color:#111827}
    .v2-step[aria-current="step"]{background:#111827;color:#fff}
    .v2-step.v2-filled::after{content:"·";margin-left:5px;color:#16a34a;font-weight:700}
    .v2-step:focus-visible,.v2-nav button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
    .v2-count{font:500 12px/1 inherit;color:#6b7280;white-space:nowrap}
    .v2-nav{display:flex;gap:8px;padding:22px 0 4px;border-top:1px solid #e5e7eb;margin-top:26px}
    .v2-nav button{font:500 13px/1 inherit;padding:9px 15px;border-radius:4px;cursor:pointer}
    .v2-back{background:#fff;border:1px solid #d1d5db;color:#374151}
    .v2-next{background:#111827;border:1px solid #111827;color:#fff;margin-left:auto}
    .v2-next[disabled],.v2-back[disabled]{opacity:.4;cursor:default}
    .v2-review .v2-nav{display:none}
    .v2-h{outline:none}
    @media print{.v2-bar,.v2-nav{display:none!important}.v2-hidden{display:block!important}}
  `;

  const steps = [];
  let index = 0;
  let reviewing = false;
  let rail, counter, backBtn, nextBtn, reviewBtn;

  const doc = document.getElementById('doc');

  function collectSteps() {
    const out = [];
    const header = doc.querySelector('.doc-header');
    // The four header fields (Researcher, Project Owner, Last Updated) plus the
    // Title belong to no section. Trying them as step 1 — one of RPA-44's questions.
    if (header) out.push({ el: header, title: 'Plan details', slug: 'plan-details' });
    doc.querySelectorAll('.acc').forEach((acc) => {
      const title = acc.querySelector('.acc-title').textContent.trim();
      const body = acc.querySelector('.acc-body');
      out.push({ el: acc, title, slug: (body.id || '').replace(/^body-/, '') || title.toLowerCase(), acc });
    });
    // Additional Comments is special-cased in app.js and is not an accordion.
    const comments = doc.querySelector('.comments-block');
    if (comments) out.push({ el: comments, title: 'Additional Comments', slug: 'additional-comments' });
    return out;
  }

  function hasContent(step) {
    return Array.from(step.el.querySelectorAll('input,textarea,select')).some((f) => {
      if (f.type === 'checkbox' || f.type === 'radio') return f.checked;
      if (f.tagName === 'SELECT') return f.selectedIndex > 0;
      return (f.value || '').trim() !== '';
    });
  }

  function show(i, { focus = true, push = true } = {}) {
    index = Math.max(0, Math.min(i, steps.length - 1));
    reviewing = false;
    document.body.classList.remove('v2-review');
    steps.forEach((s, n) => {
      s.el.classList.toggle('v2-hidden', n !== index);
      // A step shows the whole section, so force it open on arrival rather than
      // leaving someone on a step collapsed to nothing.
      if (n === index && s.acc) {
        s.acc.setAttribute('data-open', 'true');
        s.acc.querySelector('.acc-head').setAttribute('aria-expanded', 'true');
        s.acc.querySelector('.acc-body').hidden = false;
      }
    });
    render();
    if (push) history.replaceState(null, '', '#' + steps[index].slug);
    if (focus) {
      const h = steps[index].el.querySelector('.acc-title, .doc-header-top, .comments-title') || steps[index].el;
      h.classList.add('v2-h');
      h.setAttribute('tabindex', '-1');
      h.focus();
    }
  }

  function showAll() {
    reviewing = true;
    document.body.classList.add('v2-review');
    steps.forEach((s) => s.el.classList.remove('v2-hidden'));
    render();
    window.scrollTo({ top: 0 });
  }

  function render() {
    rail.innerHTML = '';
    steps.forEach((s, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'v2-step' + (hasContent(s) ? ' v2-filled' : '');
      b.textContent = s.title;
      // Free navigation for the spike: any step is reachable at any time.
      // Whether it should be gated is one of the questions to report on.
      if (!reviewing && n === index) b.setAttribute('aria-current', 'step');
      b.addEventListener('click', () => show(n));
      rail.appendChild(b);
    });
    counter.textContent = reviewing ? 'Whole plan' : 'Step ' + (index + 1) + ' of ' + steps.length;
    reviewBtn.textContent = reviewing ? 'Back to steps' : 'Review whole plan';
    backBtn.disabled = reviewing || index === 0;
    nextBtn.disabled = reviewing || index === steps.length - 1;
  }

  function buildChrome() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'v2-bar';
    const flag = document.createElement('span');
    flag.className = 'v2-flag';
    flag.textContent = 'spike v2';
    rail = document.createElement('div');
    rail.className = 'v2-rail';
    counter = document.createElement('span');
    counter.className = 'v2-count';
    reviewBtn = document.createElement('button');
    reviewBtn.type = 'button';
    reviewBtn.className = 'v2-step';
    reviewBtn.addEventListener('click', () => (reviewing ? show(index) : showAll()));
    bar.append(flag, rail, counter, reviewBtn);
    document.querySelector('.toolbar').after(bar);

    const nav = document.createElement('div');
    nav.className = 'v2-nav';
    backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'v2-back';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => show(index - 1));
    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'v2-next';
    nextBtn.textContent = 'Next →';
    nextBtn.addEventListener('click', () => show(index + 1));
    nav.append(backBtn, nextBtn);
    doc.appendChild(nav);
  }

  function start() {
    steps.push(...collectSteps());
    if (!steps.length) return;
    buildChrome();
    const wanted = steps.findIndex((s) => '#' + s.slug === window.location.hash);
    show(wanted > -1 ? wanted : 0, { focus: false });
    // Progress dots track what has been filled in, so typing refreshes the rail.
    doc.addEventListener('input', () => render());
    doc.addEventListener('change', () => render());
    // Print must show the whole plan, never just the step you happen to be on.
    window.addEventListener('beforeprint', () => steps.forEach((s) => s.el.classList.remove('v2-hidden')));
    window.addEventListener('afterprint', () => { if (!reviewing) show(index, { focus: false, push: false }); });
    console.log('[RPA-44 spike] section-at-a-time active,', steps.length, 'steps:',
      steps.map((s) => s.title).join(' / '));
  }

  // The form is built after the template fetch resolves, so wait for it.
  const observer = new MutationObserver(() => {
    if (doc.querySelector('.acc')) { observer.disconnect(); start(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (doc.querySelector('.acc')) start();
    else observer.observe(doc, { childList: true, subtree: true });
  });
})();
