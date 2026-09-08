'use strict';

// Local, deterministic browser QA. No real API calls or credentials.
// $env:PORT='8947'; node test/manual/rpa-67-browser-fixture.js
// Open /?scenario=exhaust (first Goal click fails, manual retry recovers),
// /?scenario=recover (each field succeeds on attempt 3), or /?scenario=slow.
process.env.ANTHROPIC_API_KEY = 'offline-browser-fixture';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { handleEvaluate } = require('../../server');
const root = path.resolve(__dirname, '../..');
let goalClicks = 0;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.md': 'text/plain' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/evaluate') {
    const scenario = new URL(req.headers.referer || 'http://localhost').searchParams.get('scenario') || 'recover';
    let attempt = 0, exhaust = false;
    const client = { messages: { create: async (body, options) => {
      const goal = body.messages[0].content.includes('"Goal"');
      if (++attempt === 1 && goal) exhaust = scenario === 'exhaust' && ++goalClicks === 1;
      await delay(scenario === 'slow' ? 15000 : 200, undefined, { signal: options.signal });
      const tool = body.tools[0];
      const names = tool.input_schema.properties.recommendations.items.properties.criterionName.enum;
      const input = exhaust || (attempt < 3 && (scenario !== 'exhaust' || goal))
        ? { metrics: '[{"name":"Clarity"}], "recommendations": [{"criterionName":' }
        : { metrics: names.map(name => ({ name, score: 3, desc: 'Deterministic browser fixture.' })), recommendations: [] };
      return { content: [{ type: 'tool_use', name: tool.name, input }] };
    } } };
    handleEvaluate(req, res, { client });
    return;
  }
  if (req.url === '/api/config') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ jiraEnabled: false, googleClientId: '', googleApiKey: '' }));
    return;
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (req.method !== 'GET' || !file.startsWith(root + path.sep) || !mime[path.extname(file)] || !fs.existsSync(file)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] + '; charset=utf-8');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT || 8947), '127.0.0.1', () => {
  console.log('Offline RPA-67 fixture: http://127.0.0.1:' + (process.env.PORT || 8947) + '/?scenario=exhaust');
});
