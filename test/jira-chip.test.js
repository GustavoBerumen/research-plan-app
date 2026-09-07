'use strict';

// A filled Jira reference renders as a small blue tag rather than a text box.
// That styling used to key off :placeholder-shown, which quietly made the
// field's placeholder load-bearing: a field with no placeholder text is never
// "showing" one, so :not(:placeholder-shown) matched always and every empty
// field rendered as a tag. It cost a bug once already (RPA-54) and blocked
// removing the placeholder ever since.
//
// It is a class now, toggled by the combobox from the field's actual value.
// These tests pin the thing CSS cannot assert for itself: that the class
// tracks the value, through typing, clearing, and a restored draft.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue } = require('./app-harness');

function jira(document) {
  const input = document.querySelector('[data-field="jiraProject"]');
  assert.ok(input, 'the Jira Project field renders');
  return input;
}

test('starts empty, with no placeholder and no tag', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const input = jira(app.document);
  assert.equal(input.value, '');
  assert.equal(input.getAttribute('placeholder'), '',
    'the box starts empty — no "Ticket reference" prompt inside it');
  assert.equal(input.classList.contains('jira-filled'), false,
    'an empty field is not a tag');
});

test('the tag class follows the value, not the placeholder', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;
  const input = jira(document);

  setValue(window, input, 'RPA-55 — Reorganise the form');
  assert.equal(input.classList.contains('jira-filled'), true, 'a filled field is a tag');

  setValue(window, input, '   ');
  assert.equal(input.classList.contains('jira-filled'), false,
    'whitespace alone is not a value');

  setValue(window, input, '');
  assert.equal(input.classList.contains('jira-filled'), false, 'cleared, so not a tag');
});

test('a restored draft comes back as a tag', async (t) => {
  const app = await bootApp({
    draft: {
      version: 6,
      savedAt: '2026-09-07T09:00:00.000Z',
      fields: { jiraProject: 'RPA-55 — Reorganise the form' },
      selects: {},
      lists: {},
    },
  });
  t.after(() => app.close());

  const input = jira(app.document);
  assert.equal(input.value, 'RPA-55 — Reorganise the form');
  assert.equal(input.classList.contains('jira-filled'), true,
    'restoring dispatches input, so the tag state is rebuilt');
});

test('the field is still a combobox', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());

  const input = jira(app.document);
  assert.equal(input.getAttribute('role'), 'combobox');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.ok(input.classList.contains('jira-input'));
});
