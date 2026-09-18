'use strict';

// GOV.UK: a placeholder is not guidance. It disappears the moment someone
// types, it is invisible to some assistive tech, and low-contrast grey text
// inside a box is routinely mistaken for an answer already given.
//
// The form had guidance in placeholders in seven places. It now lives in hint
// text below each control, where it stays put — examples in the form
// "For example: …", and the ones that were not examples folded into the hint
// they were already repeating.
//
// Two placeholders survive on purpose and are named below: the DD/MM/YYYY
// segments of the date editor, which are a format mask rather than guidance,
// and the "Other…" escape-hatch inputs, which appear only after someone has
// chosen to type their own value and would otherwise be an unlabelled box.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, withFieldUncommented } = require('./app-harness');

// RPA-117 made this field dormant in the template; these tests are about it,
// so the fixture brings it back the way a future template line would.
const WITH_ACTIONS = { 'research-plan-template.md': withFieldUncommented(fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'), 'actionPoints') };

// Format masks on the segmented date control.
const DATE_SEGMENTS = ['DD', 'MM', 'YYYY'];
// The free-text input revealed by choosing "Other…" in a dropdown.
const OTHER_ESCAPE = /^Type (your own|a custom) value…$/;

function placeholders(document) {
  return Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'))
    .map((el) => ({
      placeholder: el.getAttribute('placeholder'),
      field: el.getAttribute('data-field') || el.className,
    }))
    .filter((p) => p.placeholder);
}

test('no control carries guidance in its placeholder', async (t) => {
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());

  const stray = placeholders(app.document).filter((p) =>
    !DATE_SEGMENTS.includes(p.placeholder) && !OTHER_ESCAPE.test(p.placeholder));

  assert.deepEqual(stray, [],
    'guidance belongs in hint text below the control, not inside it');
});

test('the two survivors are still there, so this is not passing by accident', async (t) => {
  // If the date editor or the "Other…" input lost its placeholder, the test
  // above would go green for the wrong reason. Both are asserted present.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());
  const all = placeholders(app.document).map((p) => p.placeholder);

  DATE_SEGMENTS.forEach((seg) => assert.ok(all.includes(seg), `the date editor kept its ${seg}`));
  assert.ok(all.some((p) => OTHER_ESCAPE.test(p)), 'the "Other…" input kept its placeholder');
});

test('a table cell with no declared placeholder gets none', async (t) => {
  // The regression that made the change incomplete the first time: dropping a
  // column's placeholder from the template left the cell falling back to
  // "Enter text…" in code, so the guidance was gone and a placeholder was not.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());

  const cells = Array.from(app.document.querySelectorAll('#actionPoints-table tbody textarea'));
  assert.equal(cells.length, 2);
  cells.forEach((cell) => {
    assert.equal(cell.getAttribute('placeholder'), '',
      'the column header already names what goes in the cell');
  });

  // A file cell keeps its empty-state label, which is text beside a button
  // rather than a placeholder in a box.
  assert.equal(
    app.document.querySelector('#previousKnowledge-table .file-name').textContent,
    'No file chosen'
  );
});

test('guidance is never hidden behind a tooltip either', async (t) => {
  // Same principle as the placeholder rule, and the same fix. Research
  // Questions carried its only piece of advice — how many to write — inside a
  // "?" bubble that appeared on hover, so it was invisible on touch, invisible
  // when printed, and invisible to anyone who never thought to hover.
  //
  // The icon is gone and the advice is in the hint. Nothing in the template
  // can produce a tooltip, so renderInfoTip and its stylesheet rules went with
  // it rather than being left unreachable.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());

  assert.equal(app.document.querySelectorAll('.info-tip, .info-tip-bubble').length, 0);

  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(source, /renderInfoTip/, 'the builder went with its only caller');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(css, /info-tip/, 'and so did its styling');

  // The advice itself survives, where it can be read without hovering.
  const hint = app.document.querySelector('.list-rows[data-list-key="researchQuestions"]')
    .closest('.field').querySelector('.field-hint-text').textContent;
  // Gus's words of 17 September (RPA-119) no longer name a number in the hint;
  // the warning that appears past three questions still does, without hovering.
  assert.match(hint, /gaps in your understanding/, 'the hint says what a research question is');
  assert.match(source, /more than three/i, 'and the advice about three still exists, as a warning shown when it applies');
});

test('controls that only exist once revealed are swept too', async (t) => {
  // The sweep above reads a form nobody has touched, so anything built on
  // demand is invisible to it. Two things are: the custom section block, whose
  // body carried the field's placeholder, and the Feedback textarea. Both are
  // opened here first.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());
  const { document } = app;

  document.querySelector('.custom-fields-list[data-list-key="additionalResources"]')
    .closest('.field').querySelector('.add-btn').click();
  document.getElementById('tool-feedback-open').click();   // reveals feedback on the tool (RPA-98)

  const stray = placeholders(document).filter((p) =>
    !DATE_SEGMENTS.includes(p.placeholder) && !OTHER_ESCAPE.test(p.placeholder));
  assert.deepEqual(stray.map((p) => p.placeholder), ['Label'],
    'only the custom block title keeps one, and it is a label rather than guidance');

  // Both revealed controls are named, which is what the placeholder was doing
  // badly. The block's textarea has a visually hidden label; the field above
  // it explains the whole thing.
  const body = document.querySelector('.custom-field-body');
  assert.ok(body.id && document.querySelector('label[for="' + body.id + '"]'),
    'the block body has a real label, not a placeholder');
});

test('the escape hatch says what it is, and is scoped to the plan', async (t) => {
  // It rendered as a bare "+ Add additional section" button: no label, no
  // hint, sitting at the bottom of Execution because that is where the
  // Resources section was folded. GOV.UK has no pattern for a user-defined
  // field, so there is exactly one of these and it belongs to the document.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());
  const { document } = app;

  const wrap = document.querySelector('.custom-fields-list[data-list-key="additionalResources"]')
    .closest('.field');

  assert.equal(wrap.querySelector('.flabel').textContent, 'Additional information');
  const hint = wrap.querySelector('.field-hint-text');
  assert.ok(hint && hint.textContent.trim(), 'it explains what it is for');
  assert.doesNotMatch(hint.textContent, /Feedback/,
    'and no longer points at a Feedback box, which is dormant since RPA-98');
  assert.equal(wrap.querySelector('.add-btn').textContent, '+ Add additional information');

  // RPA-101: one hatch per section, rendered inside it after the section's
  // questions and Evaluate control. Execution keeps the original key so
  // older drafts restore into it; the others are named for their section.
  // Plan details, the document's header, has one too since RPA-145.
  assert.equal(wrap.closest('.acc').querySelector('.acc-title').textContent, 'Execution');
  assert.deepEqual(
    Array.from(document.querySelectorAll('.custom-fields-list')).map((l) => l.dataset.listKey),
    ['additionalPlanDetails', 'additionalContext', 'additionalResearch', 'additionalMethodology', 'additionalResources']
  );
  // Capped at one block each (RPA-82): the control goes at the limit, and
  // the block that exists stays editable and removable.
  const add = wrap.querySelector('.add-btn');
  add.click();
  assert.equal(wrap.querySelectorAll('.custom-field-block').length, 1);
  assert.equal(add.hidden, true, 'one is the limit');
  wrap.querySelector('.custom-field-block .list-remove').click();
  assert.equal(add.hidden, false, 'removing it brings the control back');
});

test('the examples that were placeholders now read as hints', async (t) => {
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());
  const { document } = app;

  const hintFor = (selector) => document.querySelector(selector)
    .closest('.field').querySelector('.field-hint-text').textContent.trim();

  // One participants question since RPA-119, with one example in Gus's words.
  assert.match(hintFor('.list-rows[data-list-key="characteristics"]'),
    /For example: New customers who abandoned a checkout in the last 30 days\./);
  assert.match(hintFor('#previousKnowledge-table'),
    /prior findings, analytics reports, or past studies relevant to this work\./, 'the hint of 18 September 2026');
});

test('no hint was lost when its placeholder went', async (t) => {
  // Every field that had guidance in a placeholder must still explain itself
  // somewhere. Derived from the template so it covers fields added later.
  const app = await bootApp({ textAssets: WITH_ACTIONS });
  t.after(() => app.close());

  const body = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  const keys = [];
  const re = /^(?:# )?[A-Z][^(\n]*? \(([a-z][^)\n]*)\)/gm;
  let m;
  while ((m = re.exec(body))) {
    const key = (m[1].split(',').map((p) => /^key=(.+)$/.exec(p.trim())).filter(Boolean)[0] || [])[1];
    if (key) keys.push(key);
  }
  assert.ok(keys.length > 20, 'expected the full field list, got ' + keys.length);

  const unexplained = keys.filter((key) => {
    const node = app.document.querySelector('[data-field="' + key + '"]')
      || app.document.querySelector('.list-rows[data-list-key="' + key + '"]')
      || app.document.getElementById(key + '-table')
      || app.document.querySelector('.radio-group[data-field-key="' + key + '"]');
    if (!node) return false;
    const wrap = node.closest('.field') || node.closest('.mf');
    if (!wrap) return false;
    const hint = wrap.querySelector('.field-hint-text');
    return !hint || !hint.textContent.trim();
  });

  // Last updated is computed and asks nothing, so it has no hint by design. It
  // was the one field without one; since RPA-148 it is not a field on a page
  // at all but a line on the task list, so nothing is left unexplained.
  assert.deepEqual(unexplained, []);
  assert.equal(app.document.querySelector('.task-list-step [data-field="lastUpdated"]').closest('.dateline').querySelector('.field-hint-text'), null);
});
