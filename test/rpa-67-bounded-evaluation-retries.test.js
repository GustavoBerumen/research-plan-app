'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once, getEventListeners } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { spawnSync } = require('node:child_process');
const Anthropic = require('@anthropic-ai/sdk');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');

const previousKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = previousKey || 'offline-test-key';
const evaluation = require('../server');
if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
else process.env.ANTHROPIC_API_KEY = previousKey;

const RUBRIC = [{ name: 'Clarity', desc: 'Names the affected users.' }, { name: 'Alignment', desc: 'Matches the objective.' }];
const ENTRIES = [{ number: 2, text: 'Checkout barriers.' }, { number: 4, text: 'Payment barriers.' }];
const TEXT = 'Users do not like the checkout and it is causing problems for the business.';
// Exactly the defect: a string containing an incomplete body, including a
// recommendations key. Parsing that string cannot salvage a valid evaluation.
const MALFORMED = '[\n {"name":"Clarity","score":1,"desc":"..."}\n],\n"recommendations": [{"criterionName":"Clarity",';
const metrics = (rubric = RUBRIC) => rubric.map(r => ({ name: r.name, score: 3, desc: 'Supported.' }));
const valid = (kind) => kind === 'scalar' ? { metrics: metrics(), recommendations: [] } : {
  entryEvaluations: ENTRIES.map(e => ({ number: e.number, metrics: metrics() })),
  ...(kind === 'researchQuestions' ? { setMetrics: metrics(evaluation.QUESTION_SET_CRITERIA) } : {}),
  recommendations: [],
};
const malformed = (kind) => kind === 'scalar' ? { metrics: MALFORMED } : {
  ...valid(kind), entryEvaluations: [{ number: 2, metrics: MALFORMED }, valid(kind).entryEvaluations[1]],
};
function wire(input, toolName = 'submit_evaluation') {
  return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: toolName, input }] }), {
    headers: { 'content-type': 'application/json' },
  });
}
function provider(reply) {
  const calls = [], events = [];
  const client = new Anthropic({ apiKey: 'offline-test-key', maxRetries: 2, logLevel: 'off', fetch: async (url, init) => {
    const body = JSON.parse(init.body);
    const call = { body, signal: init.signal, headers: init.headers };
    calls.push(call);
    return reply(call, calls.length);
  } });
  return { calls, events, options: { client, retryDelaysMs: [1, 1], log: event => events.push(event) } };
}
function run(kind, options) {
  const tool = kind === 'scalar' ? evaluation.scalarEvalTool(RUBRIC)
    : kind === 'outcomes' ? evaluation.outcomesEvalTool(RUBRIC) : evaluation.researchQuestionsEvalTool(2, RUBRIC);
  const format = kind === 'scalar' ? input => evaluation.formatScalarResult(input, RUBRIC)
    : kind === 'outcomes' ? input => evaluation.formatOutcomesResult(input, ENTRIES, RUBRIC)
      : input => evaluation.formatResearchQuestionResult(input, ENTRIES, RUBRIC);
  return evaluation.evaluateWithRetries(tool, TEXT, 2048, format, options);
}

for (const kind of ['scalar', 'researchQuestions', 'outcomes']) {
  for (const successAt of [1, 2, 3]) test(`${kind}: valid attempt ${successAt} ends the budget immediately`, async () => {
    const p = provider((call, n) => wire(n < successAt ? malformed(kind) : valid(kind), call.body.tools[0].name));
    const result = await run(kind, p.options);
    assert.equal(p.calls.length, successAt);
    assert.ok(result.metrics.length >= RUBRIC.length);
    assert.deepEqual(result.recommendations, []);
    assert.deepEqual(p.events.map(e => e.attempt), Array.from({ length: successAt }, (_, i) => i + 1));
    assert.equal(p.events.at(-1).category, 'success');
    if (successAt > 1) assert.equal(p.events[0].rule, 'metrics.array_length');
    assert.equal(new Set(p.events.map(e => e.evaluationId)).size, 1);
    assert.ok(p.calls.every(call => call.headers.get('x-stainless-retry-count') === '0'));
    assert.doesNotMatch(JSON.stringify(p.events), /checkout|offline-test-key|recommendations/);
    if (kind === 'outcomes') assert.match(result.metrics[1].name, /Outcome 2 ↔ Question 2/);
    if (kind === 'researchQuestions') assert.match(result.metrics[0].name, /Question 2/);
  });
  test(`${kind}: three invalid evaluations are rejected, never a fourth provider request`, async () => {
    const p = provider(call => wire(malformed(kind), call.body.tools[0].name));
    await assert.rejects(run(kind, p.options), /after 3 attempts\./);
    assert.equal(p.calls.length, 3);
    assert.ok(p.events.every(e => e.category === 'invalid_evaluation'));
  });
}

test('missing tool output, invalid root and truncated JSON are retried without coercion', async t => {
  for (const response of [null, {}, { content: [] }, { content: [{ type: 'text', text: 'Sorry' }] },
    { content: [{ type: 'tool_use', name: 'wrong_tool', input: valid('scalar') }] },
    { content: [{ type: 'tool_use', name: 'submit_evaluation', input: null }] }]) {
    await t.test(JSON.stringify(response), async () => {
      const p = provider((call, n) => n === 1 ? new Response(JSON.stringify(response), {
        headers: { 'content-type': 'application/json' },
      }) : wire(valid('scalar'), call.body.tools[0].name));
      await run('scalar', p.options);
      assert.equal(p.calls.length, 2);
      assert.equal(p.events[0].category, 'invalid_evaluation');
    });
  }
  const p = provider((call, n) => n === 1 ? new Response('{"content":', {
    headers: { 'content-type': 'application/json' },
  }) : wire(valid('scalar'), call.body.tools[0].name));
  await run('scalar', p.options);
  assert.equal(p.calls.length, 2);
  assert.equal(p.events[0].rule, 'response.json');
});

test('strict validators still reject invalid scores, criterion order, advice and positional targets', async t => {
  const invalid = [
    ['scalar', { ...valid('scalar'), metrics: [{ ...metrics()[0], score: '3' }, metrics()[1]] }],
    ['scalar', { ...valid('scalar'), metrics: [{ ...metrics()[0], score: 4 }, metrics()[1]] }],
    ['scalar', { ...valid('scalar'), metrics: metrics().reverse() }],
    ['scalar', { ...valid('scalar'), recommendations: [{ criterionName: 'Clarity', text: 'Unsupported advice on a 3.' }] }],
    ['scalar', { ...valid('scalar'), recommendations: ['First', 'Second', 'Third'] }],
    ['researchQuestions', { ...valid('researchQuestions'), setMetrics: [] }],
    ['researchQuestions', { ...valid('researchQuestions'), entryEvaluations: [{ number: 1, metrics: metrics() }, { number: 4, metrics: metrics() }] }],
    ['outcomes', { ...valid('outcomes'), entryEvaluations: [{ number: 2, metrics: metrics() }, { number: 2, metrics: metrics() }] }],
    ['outcomes', { ...valid('outcomes'), recommendations: [{ outcomeNumber: 1, criterionName: 'Clarity', text: 'Wrong target.' }] }],
  ];
  for (const [kind, input] of invalid) await t.test(kind + JSON.stringify(input), async () => {
    const p = provider(call => wire(input, call.body.tools[0].name));
    await assert.rejects(run(kind, p.options), /after 3 attempts/);
    assert.equal(p.calls.length, 3);
    assert.ok(p.events.every(e => e.rule));
  });
});

test('SDK retries cannot multiply HTTP/connection attempts; authentication and other 4xx stop once', async t => {
  for (const status of [400, 401, 403, 404, 422, 408, 409, 429, 500, 503, 529]) await t.test(String(status), async () => {
    const p = provider(() => new Response(JSON.stringify({ error: { message: 'SECRET PROVIDER ERROR' } }), {
      status, headers: { 'content-type': 'application/json', 'x-should-retry': 'true' },
    }));
    await assert.rejects(run('scalar', p.options), err => !err.message.includes('SECRET'));
    const retryable = [408, 409, 429].includes(status) || status >= 500;
    assert.equal(p.calls.length, retryable ? 3 : 1);
    assert.ok(p.calls.every(c => c.headers.get('x-stainless-retry-count') === '0'));
    assert.doesNotMatch(JSON.stringify(p.events), /SECRET|offline-test-key|checkout/);
  });
  const p = provider(() => { throw new TypeError('fetch failed'); });
  await assert.rejects(run('scalar', p.options), /after 3 attempts/);
  assert.equal(p.calls.length, 3);
  assert.ok(p.events.every(e => e.category === 'connection'));
});

test('unexpected code errors and missing configuration do not trigger retries', async () => {
  let calls = 0;
  await assert.rejects(run('scalar', { client: { messages: { create: () => { calls++; throw new Error('broken configuration'); } } },
    log: () => {}, retryDelaysMs: [1, 1] }), /configuration and input/);
  assert.equal(calls, 1);
  const child = spawnSync(process.execPath, ['server.js'], {
    cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, ANTHROPIC_API_KEY: '', PORT: '0' },
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /ANTHROPIC_API_KEY is not set/);
});

test('a connection lost while reading the response body can recover', async () => {
  const p = provider((call, n) => n === 1 ? new Response(new ReadableStream({ start(controller) {
    controller.error(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } }));
  } }), { headers: { 'content-type': 'application/json' } }) : wire(valid('scalar'), call.body.tools[0].name));
  await run('scalar', p.options);
  assert.equal(p.calls.length, 2);
  assert.equal(p.events[0].category, 'connection');
});

for (const phase of ['headers', 'body']) test(`timeouts during ${phase} abort all three underlying fetches and terminate`, async () => {
  const p = provider(call => phase === 'headers' ? new Promise((resolve, reject) => {
    call.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) : new Response(new ReadableStream({ start(controller) {
    call.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
  } }), { headers: { 'content-type': 'application/json' } }));
  const start = Date.now();
  await assert.rejects(run('scalar', { ...p.options, attemptTimeoutMs: 30 }), /after 3 attempts/);
  assert.equal(p.calls.length, 3);
  assert.ok(p.calls.every(c => c.signal.aborted));
  assert.ok(p.events.every(e => e.category === 'timeout'));
  assert.ok(Date.now() - start < 2000, 'short test deadline bounds total work');
});

test('success cleans deadline timers and cancellation listeners', async () => {
  const parent = new AbortController();
  let requestSignal;
  const result = await run('scalar', { signal: parent.signal, attemptTimeoutMs: 30, log: () => {},
    client: { messages: { create: async (body, options) => {
      requestSignal = options.signal;
      return { content: [{ type: 'tool_use', name: body.tools[0].name, input: valid('scalar') }] };
    } } },
  });
  assert.equal(result.metrics.length, 2);
  assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
  assert.equal(getEventListeners(requestSignal, 'abort').length, 0);
  await delay(60);
  assert.equal(requestSignal.aborted, false, 'completed attempt timer must be cleared');
});

test('cancellation before a request and during backoff cannot start another attempt', async () => {
  const cancelled = new AbortController(); cancelled.abort();
  const p = provider(call => wire(malformed('scalar'), call.body.tools[0].name));
  await assert.rejects(run('scalar', { ...p.options, signal: cancelled.signal }), { name: 'AbortError' });
  assert.equal(p.calls.length, 0);
  const parent = new AbortController();
  const pending = run('scalar', { ...p.options, signal: parent.signal, retryDelaysMs: [500, 500] });
  await waitFor(() => p.events.length === 1);
  parent.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(p.calls.length, 1);
  assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
});

async function endpoint(t, options) {
  const server = http.createServer((req, res) => evaluation.handleEvaluate(req, res, options));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return 'http://127.0.0.1:' + server.address().port;
}
const payload = (kind = 'scalar') => ({ fieldKey: kind, text: TEXT, rubric: RUBRIC, entries: ENTRIES });
const post = (url, body, signal) => fetch(url, { method: 'POST', body: JSON.stringify(body), signal });

test('all HTTP evaluation paths include formatting inside the budget', async t => {
  for (const kind of ['scalar', 'researchQuestions', 'outcomes']) await t.test(kind, async t => {
    const p = provider((call, n) => wire(n === 1 ? malformed(kind) : valid(kind), call.body.tools[0].name));
    const url = await endpoint(t, p.options);
    const response = await post(url, payload(kind));
    assert.equal(response.status, 200);
    assert.ok((await response.json()).metrics.length > 0);
    assert.equal(p.calls.length, 2);
  });
});

test('invalid request bodies/rubrics/entries reject before any provider attempt', async t => {
  const p = provider(() => { throw new Error('Must not call provider'); });
  const url = await endpoint(t, p.options);
  for (const body of [null, [], {}, { ...payload(), text: '' }, { ...payload(), rubric: [] },
    { ...payload(), rubric: [null] }, { ...payload(), rubric: [RUBRIC[0], RUBRIC[0]] },
    { ...payload('outcomes'), entries: [] }, { ...payload('researchQuestions'), entries: [ENTRIES[0], ENTRIES[0]] }]) {
    assert.equal((await post(url, body)).status, 400);
  }
  assert.equal((await fetch(url, { method: 'POST', body: '{' })).status, 400);
  assert.equal(p.calls.length, 0);
});

test('disconnect during provider work aborts the actual SDK fetch with no retry or late response', async t => {
  const p = provider(call => new Promise((resolve, reject) => {
    call.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const url = await endpoint(t, p.options);
  const parent = new AbortController();
  const pending = post(url, payload(), parent.signal);
  await waitFor(() => p.calls.length === 1);
  parent.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await waitFor(() => p.calls[0].signal.aborted);
  await waitFor(() => p.events.length === 1);
  assert.equal(p.events[0].category, 'cancelled');
  assert.equal(p.calls.length, 1);
});

const field = (app, key) => app.document.querySelector(`[data-field="${key}"]`);
const controls = (app, key) => field(app, key).closest('.field').querySelector('.eval-controls');
const section = app => app.document.querySelector('[data-evaluate-section="context"]');
async function connectedApp(t, p) {
  const url = await endpoint(t, p.options);
  const app = await bootApp({ evaluate: async (body, request) => {
    // Node fetch requires a native signal; mirror jsdom's browser cancellation.
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    try {
      const response = await post(url, body, controller.signal);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } finally {
      request.signal.removeEventListener('abort', cancel);
    }
  } });
  t.after(() => app.close());
  return app;
}
function dynamicValid(call) {
  const schema = call.body.tools[0].input_schema;
  const names = schema.properties.recommendations.items.properties.criterionName.enum;
  return { metrics: metrics(names.map(name => ({ name }))), recommendations: [] };
}

test('click budgets, duplicate prevention, readable exhaustion, manual recovery and retained sibling/results/draft', async t => {
  let remainingFailures = 0;
  const p = provider(call => wire(call.body.messages[0].content.includes('"Goal"') && remainingFailures-- > 0
    ? { metrics: MALFORMED } : dynamicValid(call), call.body.tools[0].name));
  const app = await connectedApp(t, p);
  setValue(app.window, field(app, 'background'), 'Retain background');
  setValue(app.window, field(app, 'goal'), 'Retain goal');
  section(app).click(); await waitFor(() => !section(app).disabled);
  assert.equal(p.calls.length, 2, Array.from(app.document.querySelectorAll('.eval-error:not([hidden])'), e => e.textContent).join('\n'));
  const good = controls(app, 'background'), bad = controls(app, 'goal');
  const oldMetrics = bad.querySelector('.eval-metrics').textContent;
  bad.querySelector('.eval-result-btn').click();
  remainingFailures = 3;
  section(app).click(); section(app).click();
  bad.querySelector('.eval-quick-reevaluate-btn').click();
  await waitFor(() => !section(app).disabled);
  assert.equal(p.calls.length, 6, 'one sibling success plus exactly three Goal attempts');
  assert.equal(app.evaluationRequests.length, 4, 'each field has one HTTP request per click');
  assert.equal(bad.querySelector('.eval-error').textContent,
    'Evaluation request failed: No valid evaluation was received after 3 attempts. Retry Goal below.');
  assert.equal(bad.querySelector('.eval-error').textContent.match(/Evaluation request failed/g).length, 1);
  assert.equal(good.querySelector('.eval-error').hidden, true);
  assert.equal(bad.querySelector('.eval-metrics').textContent, oldMetrics);
  assert.equal(bad.querySelector('.eval-panel').hidden, false);
  for (const selector of ['.eval-save-btn', '.eval-like-btn', '.eval-dislike-btn']) {
    assert.equal(bad.querySelector(selector).disabled, false);
  }
  await waitFor(() => app.window.localStorage.getItem(DRAFT_KEY)?.includes('Retain goal'));
  assert.equal(field(app, 'goal').value, 'Retain goal');
  remainingFailures = 2;
  const retry = bad.querySelector('.eval-btn'); retry.focus(); retry.click();
  await waitFor(() => !retry.disabled);
  assert.equal(p.calls.length, 9, 'a fresh manual click may use all three attempts again');
  assert.equal(app.evaluationRequests.length, 5);
  assert.equal(bad.querySelector('.eval-error').hidden, true);
  assert.equal(app.document.getElementById('evaluation-progress-context').textContent, '2 of 2 fields finished.');
});

test('Clear Form aborts retrying HTTP work and drops queued fields; fresh writing can evaluate', async t => {
  let hang = true;
  const p = provider(call => hang ? new Promise((resolve, reject) => {
    call.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) : wire(dynamicValid(call), call.body.tools[0].name));
  const app = await connectedApp(t, p);
  for (const key of ['background', 'goal', 'problemStatement']) setValue(app.window, field(app, key), key);
  section(app).click(); await waitFor(() => p.calls.length === 2);
  app.document.getElementById('clear-btn').click();
  await waitFor(() => p.calls.every(c => c.signal.aborted));
  assert.equal(app.evaluationRequests.length, 2, 'queued third field never starts');
  for (const key of ['background', 'goal', 'problemStatement']) {
    assert.equal(field(app, key).value, '');
    assert.equal(controls(app, key).querySelector('.eval-error').hidden, true);
    assert.equal(controls(app, key).querySelector('.eval-result-summary').hidden, true);
  }
  hang = false;
  setValue(app.window, field(app, 'background'), 'New plan');
  section(app).click(); await waitFor(() => !section(app).disabled);
  assert.equal(p.calls.length, 3);
  assert.equal(controls(app, 'background').querySelector('.eval-result-summary').hidden, false);
});
