'use strict';

// Opt-in only: this makes paid API requests using the existing environment.
// node --env-file=<existing .env path> test/manual/rpa-67-live-smoke.js
const fs = require('node:fs');
const path = require('node:path');
const Anthropic = require('@anthropic-ai/sdk');
const { evaluateWithRetries, scalarEvalTool, buildPrompt, formatScalarResult } = require('../../server');
const text = 'Users do not like the checkout and it is causing problems for the business.';
const source = fs.readFileSync(path.join(__dirname, '../../research-plan-rubric.md'), 'utf8').replace(/\r\n?/g, '\n');
const section = source.split('# Problem Statement\n')[1].split('\n# ')[0];
const rubric = Array.from(section.matchAll(/^- ([^:]+): (.+)$/gm), m => ({ name: m[1], desc: m[2] }));
if (rubric.length !== 4) throw new Error('Expected the four current Problem Statement criteria');
let providerRequests = 0;
const client = new Anthropic({ logLevel: 'off', fetch: (...args) => {
  providerRequests++;
  return fetch(...args);
} });

(async () => {
  const runs = [];
  for (let click = 1; click <= 20; click++) {
    const events = [];
    const before = providerRequests;
    const started = Date.now();
    let success = false, error;
    try {
      await evaluateWithRetries(scalarEvalTool(rubric), buildPrompt('Problem Statement', text, rubric), 1024,
        input => formatScalarResult(input, rubric), { client, log: event => events.push(event) });
      success = true;
    } catch (err) { error = err.message; }
    const run = { click, success, providerAttempts: providerRequests - before, durationMs: Date.now() - started,
      events: events.map(({ attempt, category, rule, status }) => ({ attempt, category, rule, status })),
      ...(error ? { error } : {}) };
    runs.push(run);
    console.log(JSON.stringify(run));
    if (!success && events.some(e => ['authentication', 'provider_error'].includes(e.category))) break;
  }
  const summary = { date: new Date().toISOString(), model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    evaluations: runs.length, providerRequests, successes: runs.filter(r => r.success).length,
    failures: runs.filter(r => !r.success).length, recovered: runs.filter(r => r.success && r.providerAttempts > 1).length,
    runs };
  console.log('SUMMARY ' + JSON.stringify(summary));
  if (summary.failures || summary.evaluations < 20) process.exitCode = 1;
})().catch(() => { console.error('Smoke runner failed before completion.'); process.exitCode = 1; });
