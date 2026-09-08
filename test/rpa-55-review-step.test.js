'use strict';

// RPA-55's audit found that the sign-offs sat in section two, so people
// approved a plan before it existed. The verdict was to move them to a review
// step at the end, and the point was the moment rather than the place: another
// collapsible section would have moved the problem down the page.
//
// Shaped after GOV.UK's check-your-answers — a summary of what is there, a
// Change action on every row, then the approval. ADR 001 names that pattern
// and the task list as the two that survive this being an application rather
// than a one-time form, and this is a hybrid: rows are sections, not answers,
// because restating thirty rows would be unreadable.
//
// Nothing here blocks signing. ADR 001 settled that stale evaluations still
// count as complete and that currency is tracked separately and surfaced here.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

function step(document) {
  const el = document.querySelector('.review-step');
  assert.ok(el, 'the review step renders');
  return el;
}

function rows(document) {
  return Array.from(document.querySelectorAll('.review-row')).map((r) => ({
    name: r.querySelector('.review-name').textContent,
    state: r.querySelector('.review-state').textContent,
    note: r.querySelector('.review-note').textContent,
    stale: r.querySelector('.review-note').classList.contains('review-note-stale'),
    change: r.querySelector('.review-change'),
  }));
}

// Deliberately slower than the summary's 120ms redraw debounce. An instant
// mock made the currency test pass for the wrong reason: the redraw triggered
// by clicking Evaluate happened to land after the result had already arrived,
// so the test could not tell whether finishing an evaluation refreshes the
// step at all. Against the real API, which takes seconds, it does not.
const EVALUATION_DELAY_MS = 400;

function evaluationResult() {
  return new Promise((resolve) => setTimeout(() => resolve({
    metrics: [{ name: 'Current quality', score: 2, desc: 'Fine' }],
    recommendations: [],
  }), EVALUATION_DELAY_MS));
}

test('closes the document, and is not a section you can collapse past', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const el = step(document);
  assert.equal(el, document.getElementById('doc').lastElementChild,
    'it is the last thing in the document');
  assert.equal(el.classList.contains('acc'), false, 'it is not an accordion');
  assert.equal(el.querySelector('.acc-head'), null, 'so there is nothing to collapse it with');

  // It names itself for assistive tech rather than relying on visual order.
  const heading = document.getElementById(el.getAttribute('aria-labelledby'));
  assert.equal(heading.textContent, 'Review');

  // And the sign-offs live here now, not in a section above.
  const signOffs = Array.from(el.querySelectorAll('[data-field^="signOff"]'));
  assert.deepEqual(signOffs.map((i) => i.getAttribute('data-field')),
    ['signOffResearcher', 'signOffProjectOwner']);
  assert.equal(document.querySelectorAll('.acc [data-field^="signOff"]').length, 0);
});

test('summarises every section, with a Change action on each row', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const sections = Array.from(document.querySelectorAll('.acc-title')).map((e) => e.textContent);
  const summary = rows(document);
  assert.deepEqual(summary.map((r) => r.name), sections,
    'one row per section, in the same order');

  summary.forEach((r) => {
    assert.ok(r.change, `${r.name} has a Change action`);
    assert.equal(r.change.getAttribute('aria-label'), 'Change ' + r.name);
  });
});

test('an untouched plan reports nothing answered', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  // Every row should be 0. A select always holds a value, so its first option
  // must not count as an answer — otherwise Execution claims 2 of 4 on a form
  // nobody has touched, because Stage and Status default to Planning and
  // Not Started.
  rows(app.document).forEach((r) => {
    assert.match(r.state, /^0 of \d+ fields$/, `${r.name} should be empty, got "${r.state}"`);
  });
});

test('a section reads complete once its fields are answered', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  ['background', 'goal', 'problemStatement'].forEach((key) => {
    setValue(window, document.querySelector(`[data-field="${key}"]`), 'Something written here');
  });
  await waitFor(() => rows(document).find((r) => r.name === 'Context').state === 'complete', {
    timeout: 5000,
    message: 'the summary should redraw as the plan changes',
  });

  const context = rows(document).find((r) => r.name === 'Context');
  assert.equal(context.state, 'complete');
  assert.equal(context.note, '', 'complete is not the same as evaluated');
});

test('Change opens the section and puts the caret in it', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const methodology = Array.from(document.querySelectorAll('.acc'))
    .find((a) => a.querySelector('.acc-title').textContent.trim() === 'Methodology');
  assert.equal(methodology.querySelector('.acc-body').hidden, true, 'starts collapsed');

  rows(document).find((r) => r.name === 'Methodology').change.click();

  assert.equal(methodology.querySelector('.acc-body').hidden, false, 'Change opens it');
  assert.ok(methodology.contains(document.activeElement),
    'and focus lands inside, so the row is a way there rather than a verdict');
});

test('an evaluated section says so, and says when that has gone out of date', async (t) => {
  const app = await bootApp({ evaluate: () => evaluationResult() });
  t.after(() => app.close());
  const { document, window } = app;

  // Fill the whole section, so "complete" is about completeness and the
  // assertion below is really testing that staleness does not undo it.
  ['goal', 'problemStatement'].forEach((key) => {
    setValue(window, document.querySelector(`[data-field="${key}"]`), 'Written');
  });
  const background = document.querySelector('[data-field="background"]');
  setValue(window, background, 'Mobile checkout abandonment rose after the June redesign.');

  const field = background.closest('.field');
  field.querySelector('.eval-btn').click();
  await waitFor(() => rows(document).find((r) => r.name === 'Context').note === 'evaluated', {
    timeout: 3000,
    message: 'finishing an evaluation fires no input event, so the step must be told',
  });

  const evaluated = rows(document).find((r) => r.name === 'Context');
  assert.equal(evaluated.stale, false);

  // Editing the evaluated text does not un-complete the section — ADR 001 —
  // but the feedback no longer describes what is there, and that shows.
  setValue(window, background, 'Mobile checkout abandonment rose. An extra sentence.');
  await waitFor(() => rows(document).find((r) => r.name === 'Context').stale, {
    timeout: 5000,
    message: 'editing an evaluated field should mark its currency, not its completeness',
  });

  const stale = rows(document).find((r) => r.name === 'Context');
  assert.equal(stale.note, 'evaluation out of date');
  assert.equal(stale.state, 'complete', 'stale still counts as complete');
});

test('Feedback is offered here, above the approvals', async (t) => {
  // RPA-55's last open row. Feedback was the only field with no defined
  // reader, and a section of its own at the end of the document was nobody's
  // stop. The review step is where a plan is read rather than written, which
  // is the one moment a comment on it has an audience.
  //
  // Above the sign-offs, not below: feedback offered after approval has missed
  // its moment.
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  const el = step(document);
  const block = el.querySelector('.comments-block');
  assert.ok(block, 'the review step offers Feedback');
  assert.equal(document.querySelectorAll('.comments-block').length, 1,
    'and only here — it is not still rendered outside the step as well');

  // No section of its own any more.
  const titles = Array.from(document.querySelectorAll('.acc-title')).map((e) => e.textContent);
  assert.equal(titles.includes('Feedback'), false);

  const signOffs = el.querySelector('.review-signoffs');
  assert.ok(signOffs);
  assert.equal(
    block.compareDocumentPosition(signOffs) & 4 /* DOCUMENT_POSITION_FOLLOWING */, 4,
    'Feedback comes before the approvals'
  );

  // It also stays out of the way until wanted, as it did before the move, and
  // is not counted as an unanswered field by the summary above it.
  assert.equal(block.querySelector('.field').hidden, true);
  assert.equal(signOffs.querySelector('[data-field="comments"]'), null,
    'and is not rendered as a third sign-off');
});

test('Feedback still reveals, saves and clears from its new home', async (t) => {
  const app = await bootApp();
  const { document, window } = app;

  const block = step(document).querySelector('.comments-block');
  block.querySelector('.add-btn').click();
  const ta = block.querySelector('[data-field="comments"]');
  assert.equal(block.querySelector('.field').hidden, false, 'the reveal still works');

  setValue(window, ta, 'The recruitment timeline looks optimistic.');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.equal(saved.fields.comments, 'The recruitment timeline looks optimistic.',
    'still stored under the key it has always had, so no draft moves');
  app.close();

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  const restored = reopened.document.querySelector('.review-step [data-field="comments"]');
  assert.equal(restored.value, 'The recruitment timeline looks optimistic.');
  assert.equal(restored.closest('.field').hidden, false,
    'a draft with feedback in it opens with the feedback showing');
});

test('nothing in the step blocks signing', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  // The plan is almost entirely empty, and the approvals still work.
  assert.ok(rows(document).every((r) => r.state !== 'complete'));
  const signOff = document.querySelector('[data-field="signOffResearcher"]');
  assert.equal(signOff.disabled, false);
  setValue(window, signOff, 'GB');
  signOff.dispatchEvent(new window.Event('blur', { bubbles: true }));
  assert.match(signOff.value, /^GB — \d{2}\/\d{2}\/\d{4}$/, 'and still stamp the date');
});
