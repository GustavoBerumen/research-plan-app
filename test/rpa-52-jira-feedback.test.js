'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const unavailable = 'Jira suggestions are unavailable. You can still enter a ticket key manually, or ask your administrator to connect Jira.';
const failure = 'Jira search is temporarily unavailable. You can still enter a ticket key manually.';
const empty = 'No matching Jira tickets. You can still enter a ticket key manually.';
const response = (issues) => ({ ok: true, json: async () => ({ issues }) });
const keydown = (app, input, key) => input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

for (const scenario of [
  { name: 'configuration unavailable', message: unavailable, options: {} },
  { name: 'HTTP failure hides raw server details', message: failure, options: { jiraEnabled: true, jiraSearch: async () => ({ ok: false, json: async () => ({ error: 'JIRA_API_TOKEN credentials in .env' }) }) } },
  { name: 'network failure', message: failure, options: { jiraEnabled: true, jiraSearch: async () => { throw new Error('secret details'); } } },
  { name: 'no matches', message: empty, options: { jiraEnabled: true, jiraSearch: async () => response([]) } },
]) {
  test(scenario.name + ': one non-selectable status and manual draft round-trip', async (t) => {
    const app = await bootApp(scenario.options);
    t.after(() => app.close());
    const input = app.document.querySelector('[data-field="jiraProject"]');
    const status = app.document.querySelector('.jira-status');
    setValue(app.window, input, 'RPA-52');
    await waitFor(() => status.textContent === scenario.message);
    assert.equal(input.closest('td').querySelectorAll('[role="status"]').length, 1);
    assert.equal(status.getAttribute('aria-atomic'), 'true');
    // role=status has implicit aria-live=polite. No duplicate description route.
    assert.equal(status.getAttribute('aria-live'), null);
    assert.equal(status.closest('[role="listbox"]'), null);
    assert.equal(status.matches('.combo-item, [role="option"], [tabindex]'), false);
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.equal(app.document.querySelectorAll('[role="option"]').length, 0);
    assert.doesNotMatch(status.textContent, /JIRA_|credential|token|\.env/i);
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) assert.equal(keydown(app, input, key), true);
    assert.equal(input.value, 'RPA-52');
    assert.equal(status.textContent, scenario.message);
    status.click();
    assert.equal(input.value, 'RPA-52');
    const draft = await waitFor(() => {
      const saved = app.window.localStorage.getItem(DRAFT_KEY);
      return saved && saved.includes('RPA-52') && saved;
    });
    const restored = await bootApp({ draft });
    t.after(() => restored.close());
    assert.equal(restored.document.querySelector('[data-field="jiraProject"]').value, 'RPA-52');
    assert.equal(restored.document.querySelector('.jira-status').textContent, '');
    assert.deepEqual(app.jsdomErrors, []);
  });
}

test('unchanged unavailable feedback does not mutate the live region again', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const input = app.document.querySelector('[data-field="jiraProject"]');
  const status = app.document.querySelector('.jira-status');
  setValue(app.window, input, 'RPA-5');
  await waitFor(() => status.textContent === unavailable);
  const mutations = [];
  const observer = new app.window.MutationObserver((records) => mutations.push(...records));
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  setValue(app.window, input, 'RPA-52');
  await Promise.resolve();
  assert.equal(mutations.length, 0);
  observer.disconnect();
  keydown(app, input, 'Escape');
  assert.equal(status.textContent, '');
});

test('clearing or dismissing pending searches prevents late feedback and results', async (t) => {
  let finish;
  const app = await bootApp({ jiraEnabled: true, jiraSearch: () => new Promise((resolve) => { finish = resolve; }) });
  t.after(() => app.close());
  const input = app.document.querySelector('[data-field="jiraProject"]');
  for (const dismiss of [() => setValue(app.window, input, ''), () => keydown(app, input, 'Escape')]) {
    finish = null;
    setValue(app.window, input, 'RPA-52');
    await waitFor(() => finish);
    dismiss();
    finish(response([{ key: 'RPA-52', summary: 'Late result' }]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(app.document.querySelector('.jira-status').textContent, '');
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.equal(app.document.querySelectorAll('[role="option"]').length, 0);
  }
});

test('a successful retry replaces status with selectable tickets and preserves formatting', async (t) => {
  let issues = [];
  const app = await bootApp({ jiraEnabled: true, jiraSearch: async () => response(issues) });
  t.after(() => app.close());
  const input = app.document.querySelector('[data-field="jiraProject"]');
  setValue(app.window, input, 'missing');
  await waitFor(() => app.document.querySelector('.jira-status').textContent === empty);
  issues = [{ key: 'RPA-52', summary: 'Feedback' }];
  setValue(app.window, input, 'RPA-52');
  await waitFor(() => app.document.querySelector('[role="option"]'));
  assert.equal(app.document.querySelector('.jira-status').textContent, '');
  keydown(app, input, 'ArrowDown');
  keydown(app, input, 'Enter');
  assert.equal(input.value, 'RPA-52 — Feedback');
});

test('feedback wraps in normal flow and has an explicit print exclusion', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const rule = css.match(/\.jira-status\{([^}]+)\}/)[1];
  assert.match(rule, /white-space:normal/);
  assert.match(rule, /overflow-wrap:anywhere/);
  assert.doesNotMatch(rule, /position:(fixed|absolute)|white-space:nowrap/);
  const print = css.slice(css.indexOf('@media print{'));
  assert.match(print, /\.jira-status\{display:none!important\}/);
});
