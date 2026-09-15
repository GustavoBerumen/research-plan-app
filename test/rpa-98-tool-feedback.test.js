'use strict';

// RPA-98. Feedback on the tool, where people finish: after the plan is
// signed, a Give feedback button on the review step reveals a score and two
// questions for the people building the tool (Gus, 15 September 2026: the
// plan's own Feedback box gave way to this, the score comes first, and
// "what were you trying to do" went). How useful was it overall, what got
// in the way, what would you change first. The answers are not part of the
// plan: no draft key, no backup, no print. Send posts them to the server as
// one record, with the plan's name and the build, thanks the person and
// folds the form away. When sending fails, or is unavailable, the answers
// are offered as a file so nothing is lost.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const DRAFT_KEY = 'research-plan-app:draft';
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const form = (d) => d.querySelector('.tool-feedback');
const status = (d) => text(d.getElementById('tool-feedback-status'));
const reveal = (d) => { const b = d.getElementById('tool-feedback-open'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); };
const fill = (app, answers) => {
  const { document: d, window } = app;
  reveal(d);
  if (answers.notAsExpected !== undefined) setValue(window, d.getElementById('tool-feedback-not-as-expected'), answers.notAsExpected);
  if (answers.improve !== undefined) setValue(window, d.getElementById('tool-feedback-improve'), answers.improve);
  if (answers.usefulness) { const r = d.getElementById('tool-feedback-usefulness-' + answers.usefulness); r.checked = true; r.dispatchEvent(new window.Event('change', { bubbles: true })); }
};
function captureFetch(app, respond) {
  const calls = [];
  app.window.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    return respond(String(url), init);
  };
  return calls;
}
function captureDownloads(app) {
  const { window } = app;
  const downloads = [];
  window.URL.createObjectURL = (blob) => { downloads.push({ blob }); return 'blob:synthetic'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { downloads[downloads.length - 1].name = this.download; };
  return downloads;
}
const ok = () => ({ ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{"ok":true}' });

test('the review step ends with a Give feedback button; the form is hidden until pressed, then asks the score first and two questions, outside the plan', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const f = form(d);
  assert.ok(f, 'the form exists');
  const review = d.querySelector('.review-step');
  assert.ok(review.contains(f), 'on the review step');
  assert.ok(review.querySelector('.review-signoffs').compareDocumentPosition(f) & 4, 'after the sign-offs: where people finish');
  assert.equal(f.nextElementSibling, null, 'the last thing in the step');
  assert.equal(d.querySelector('.comments-block'), null, 'the plan\'s own Feedback box is gone');
  const open = d.getElementById('tool-feedback-open');
  assert.equal(text(open), 'Give feedback', 'the button the old box had');
  const panel = d.getElementById('tool-feedback-form');
  assert.equal(panel.hidden, true, 'the form waits until someone decides to give feedback');
  assert.equal(open.getAttribute('aria-expanded'), 'false');
  open.click();
  assert.equal(panel.hidden, false);
  assert.equal(open.getAttribute('aria-expanded'), 'true');
  assert.equal(d.activeElement, d.getElementById('tool-feedback-usefulness-1'), 'focus lands on the first answer');
  assert.equal(text(f.querySelector('.tool-feedback-h')), 'Feedback on this tool');
  assert.deepEqual(Array.from(f.querySelectorAll('.tf-label')).map(text), ['How useful was this tool overall?', 'What didn\u2019t work as expected?', 'What could we do to improve this tool?'], 'the score first, then two questions; "what were you trying to do" is gone');
  assert.equal(d.getElementById('tool-feedback-trying'), null);
  const hints = { 'tool-feedback-not-as-expected': 'Anything that slowed you down, felt confusing, or broke.', 'tool-feedback-improve': 'If you could change or add something, what would it be?' };
  for (const id of ['tool-feedback-not-as-expected', 'tool-feedback-improve']) {
    const ta = d.getElementById(id);
    assert.equal(ta.tagName, 'TEXTAREA', id);
    assert.ok(d.querySelector('label[for="' + id + '"]'), id + ' has a label');
    const described = ta.getAttribute('aria-describedby').split(/\s+/);
    assert.ok(d.getElementById(described[0]).classList.contains('field-hint-text'), id + ' is described by its hint');
    assert.equal(text(d.getElementById(described[0])), hints[id], id + ' hint');
    assert.equal(ta.hasAttribute('data-field'), false, id + ' is not a plan field');
    // One line to begin with, growing with the answer, and a running word
    // count under it as the plan's own questions have (Gus, 15 September 2026).
    assert.equal(ta.getAttribute('rows'), '1', id + ' starts one line high');
    assert.ok(ta.classList.contains('field-ta'), id + ' grows with its text like every other box');
    const count = ta.nextElementSibling;
    assert.ok(count && count.classList.contains('word-count-wrap'), id + ' has a word count under it');
    assert.equal(text(count.querySelector('.word-count')), 'You have written 0 words');
    assert.ok(described.includes(count.querySelector('.word-count').id), id + ' is described by its count');
    setValue(window, ta, 'One');
    assert.equal(text(count.querySelector('.word-count')), 'You have written 1 word', 'the singular');
    setValue(window, ta, 'It lost my  answer twice.');
    assert.equal(text(count.querySelector('.word-count')), 'You have written 5 words', 'counting up, no limit and no remaining');
    setValue(window, ta, '');
    assert.equal(text(count.querySelector('.word-count')), 'You have written 0 words');
  }
  const score = f.querySelector('fieldset');
  assert.equal(score.querySelector('legend') && text(score.querySelector('legend')), 'How useful was this tool overall?', 'the score is a fieldset whose legend asks');
  assert.deepEqual(Array.from(score.querySelectorAll('.radio-label')).map(text), ['1 Not useful', '2 Slightly useful', '3 Somewhat useful', '4 Useful', '5 Very useful'], 'every option has words, so a screen reader hears a scale');
  assert.equal(score.querySelector('.select-cell'), null, 'not a plan choice either');
  fill(app, { notAsExpected: 'Plan a study.', usefulness: 4 });
  setValue(window, d.querySelector('[data-field="background"]'), 'An edit that saves the plan.');
  const saved = await waitFor(() => { const s = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); return s && s.fields.background ? s : null; });
  assert.equal(JSON.stringify(saved).includes('Plan a study.'), false, 'the answers never enter the draft');
  assert.match(CSS.slice(CSS.lastIndexOf('@media print')), /\.tool-feedback/, 'and do not print with the plan');
  open.click();
  assert.equal(panel.hidden, true, 'the button also folds the form away');
  assert.deepEqual(app.jsdomErrors, []);
});

test('Send posts the answers with the plan\'s name and build, thanks the person, and clears the form', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const calls = captureFetch(app, () => ok());
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Usability testing of checkout flow');
  fill(app, { notAsExpected: 'The sample size question.', improve: 'Fewer pages.', usefulness: 4 });
  d.getElementById('tool-feedback-send').click();
  await waitFor(() => /Thank you/.test(status(d)), { message: 'no thanks' });
  const sent = calls.filter((c) => c.url.endsWith('/api/feedback'));
  assert.equal(sent.length, 1, 'one request');
  assert.equal(sent[0].method, 'POST');
  assert.deepEqual(sent[0].body, { usefulness: 4, notAsExpected: 'The sample size question.', improve: 'Fewer pages.', plan: 'Usability testing of checkout flow', build: sent[0].body.build, section: sent[0].body.section });
  assert.equal(typeof sent[0].body.build, 'string');
  assert.equal(d.getElementById('tool-feedback-not-as-expected').value, '', 'cleared after sending');
  assert.equal(text(d.getElementById('tool-feedback-not-as-expected').nextElementSibling.querySelector('.word-count')), 'You have written 0 words', 'and its count with it');
  assert.equal(d.querySelector('.tool-feedback .radio-input:checked'), null);
  assert.equal(d.getElementById('tool-feedback-form').hidden, true, 'and folded away, the thanks staying by the button');
  assert.equal(d.activeElement, d.getElementById('tool-feedback-open'));
  assert.equal(d.getElementById('tool-feedback-download').hidden, true, 'no file needed');
});

test('nothing to send is refused kindly, without a request', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const calls = captureFetch(app, () => ok());
  reveal(d);
  d.getElementById('tool-feedback-send').click();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(status(d), 'Answer at least one question first.');
  assert.equal(d.getElementById('tool-feedback-status').dataset.error, 'true');
  assert.equal(calls.filter((c) => c.url.endsWith('/api/feedback')).length, 0);
});

test('when sending fails, nothing is lost: the answers stay, and are offered as a file to send by hand', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  captureFetch(app, () => { throw new Error('Synthetic network failure'); });
  const downloads = captureDownloads(app);
  fill(app, { notAsExpected: 'It stopped.', usefulness: 2 });
  d.getElementById('tool-feedback-send').click();
  await waitFor(() => /Could not send/.test(status(d)), { message: 'no failure message' });
  assert.equal(d.getElementById('tool-feedback-not-as-expected').value, 'It stopped.', 'the answers stay');
  const download = d.getElementById('tool-feedback-download');
  assert.equal(download.hidden, false, 'a file is offered');
  download.click();
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].name, /^Feedback on Research Plan - \d{4}-\d{2}-\d{2}\.json$/);
  const written = JSON.parse(await downloads[0].blob.text());
  assert.equal(written.notAsExpected, 'It stopped.');
  assert.equal(written.usefulness, 2);
  assert.match(status(d), /Send the file to the person who shared this link/);
});

test('when the server says feedback is unavailable, the form offers the file straight away and never asks the server', async (t) => {
  const closed = { pilotMode: true, capabilities: { feedback: false, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false } };
  const app = await bootApp({ configResponse: async () => ({ ok: true, json: async () => closed }) });
  t.after(() => app.close());
  const d = app.document;
  const calls = captureFetch(app, () => ok());
  fill(app, { improve: 'The order of the sections.' });
  d.getElementById('tool-feedback-send').click();
  await waitFor(() => /unavailable/.test(status(d)), { message: 'no unavailable message' });
  assert.equal(calls.filter((c) => c.url.endsWith('/api/feedback')).length, 0, 'no request');
  assert.equal(d.getElementById('tool-feedback-download').hidden, false);
});

test('a pilot configuration that advertises feedback is accepted whole: the build marker renders and Send posts', async (t) => {
  const pilot = { pilotMode: true, version: '1.0.0', build: 'abc1234', capabilities: { feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false } };
  const app = await bootApp({ configResponse: async () => ({ ok: true, json: async () => pilot }) });
  t.after(() => app.close());
  const d = app.document;
  const calls = captureFetch(app, () => ok());
  assert.equal(text(d.getElementById('app-version')), 'v1.0.0 · abc1234', 'the pilot config was not thrown away for advertising feedback');
  fill(app, { improve: 'A pilot session.' });
  d.getElementById('tool-feedback-send').click();
  await waitFor(() => /Thank you/.test(status(d)), { message: 'no thanks in pilot mode' });
  assert.equal(calls.filter((c) => c.url.endsWith('/api/feedback')).length, 1);
});
