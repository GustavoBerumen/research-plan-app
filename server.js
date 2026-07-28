'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 8934;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ROOT = __dirname;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set.\n' +
    'Copy .env.example to .env, add your key, then run:\n' +
    '  npm start'
  );
  process.exit(1);
}

const anthropic = new Anthropic();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Forces a structured response so we don't have to parse free-form model
// text — the model must call this "tool" with exactly this shape.
const EVAL_TOOL = {
  name: 'submit_evaluation',
  description: 'Submit the rubric-based evaluation of the given text.',
  input_schema: {
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        description: 'One entry per rubric criterion, in the same order given, same name.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            score: { type: 'integer', minimum: 1, maximum: 5 },
            desc: { type: 'string', description: 'One sentence justifying the score, grounded in the actual text.' },
          },
          required: ['name', 'score', 'desc'],
        },
      },
      recommendations: {
        type: 'array',
        description: '2-3 concrete, specific recommendations, each tied to a specific criterion that scored low.',
        items: { type: 'string' },
      },
    },
    required: ['metrics', 'recommendations'],
  },
};

function buildPrompt(fieldLabel, text, rubric) {
  const rubricList = rubric.map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`).join('\n');
  return `You are evaluating a "${fieldLabel}" statement written for a UX research plan.\n\n` +
    `Statement:\n"""\n${text}\n"""\n\n` +
    `Score it against exactly these criteria (return one metric per criterion, same order, same name):\n${rubricList}\n\n` +
    `For each criterion, give an integer score from 1-5 and a one-sentence justification grounded in the actual ` +
    `statement (reference specifics from it, don't just restate the rubric). Then give 2-3 concrete recommendations ` +
    `for improving the statement, each tied to whichever criteria scored lowest.`;
}

async function handleEvaluate(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const rubric = Array.isArray(payload.rubric) ? payload.rubric : [];
  const fieldLabel = typeof payload.fieldLabel === 'string' && payload.fieldLabel ? payload.fieldLabel : 'Field';

  if (!text) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'text is required' }));
    return;
  }
  if (rubric.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No rubric criteria configured for "' + fieldLabel + '" in research-plan-rubric.md' }));
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [EVAL_TOOL],
      tool_choice: { type: 'tool', name: 'submit_evaluation' },
      messages: [{ role: 'user', content: buildPrompt(fieldLabel, text, rubric) }],
    });

    const toolUse = message.content.find((b) => b.type === 'tool_use');
    if (!toolUse) throw new Error('Model did not return a structured evaluation');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(toolUse.input));
  } catch (err) {
    console.error('Evaluation request failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Evaluation request failed: ' + err.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/evaluate') {
    handleEvaluate(req, res);
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Research Plan app running at http://localhost:${PORT}/  (model: ${MODEL})`);
});
