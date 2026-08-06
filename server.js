'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 8934;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set.\n' +
    'Copy .env.example to .env, add your key, then run:\n' +
    '  npm start'
  );
  process.exit(1);
}

const anthropic = new Anthropic();

const JIRA_BASE_URL = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
const JIRA_ENABLED = !!(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN);

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
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function readJsonBody(req, maxBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) req.destroy(new Error('Request body too large'));
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
            score: { type: 'integer', minimum: 1, maximum: 3 },
            desc: {
              type: 'string',
              maxLength: 70,
              description: 'One short sentence (10 words max) justifying the score, grounded in the actual text.',
            },
          },
          required: ['name', 'score', 'desc'],
        },
      },
      recommendations: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        description: 'Exactly 2 concrete, specific recommendations, each tied to a specific criterion that scored low.',
        items: { type: 'string', maxLength: 100, description: 'One sentence (15 words max).' },
      },
    },
    required: ['metrics', 'recommendations'],
  },
};

// Calibrates the model's bar for specific criteria, keyed by criterion name.
// Not every criterion needs one — only add where the literal rubric wording
// alone tends to over- or under-score real answers.
const CRITERION_EXAMPLES = {
  'User Understanding': {
    weak: 'Validate our new checkout button design.',
    strong: 'Understand why users drop off at the payment step during checkout.',
  },
  'Actionable': {
    weak: 'Gather user opinions on our dashboard.',
    strong: 'Identify which data visualization errors cause users to misinterpret their monthly report, so we can refine the Q3 dashboard redesign.',
  },
  'Feasible': {
    weak: "Understand our users' entire financial workflow.",
    strong: 'Understand how new users categorize their first expense during onboarding.',
  },
};

function buildPrompt(fieldLabel, text, rubric) {
  const rubricList = rubric.map((r, i) => {
    const ex = CRITERION_EXAMPLES[r.name];
    const exampleText = ex ? ` (Weak: "${ex.weak}" | Strong: "${ex.strong}")` : '';
    return `${i + 1}. ${r.name}: ${r.desc}${exampleText}`;
  }).join('\n');
  return `You are evaluating a "${fieldLabel}" statement written for a UX research plan.\n\n` +
    `Statement:\n"""\n${text}\n"""\n\n` +
    `Score it against exactly these criteria (return one metric per criterion, same order, same name):\n${rubricList}\n\n` +
    `For each criterion, give an integer score from 1-3 and a short justification (10 words max) grounded in the ` +
    `actual statement (reference specifics from it, don't just restate the rubric). Then give exactly 2 concrete ` +
    `recommendations (one sentence each, 15 words max) for improving the statement, each tied to whichever criteria ` +
    `scored lowest. Use British English spelling throughout (e.g. "prioritise", "colour", "analyse").`;
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

const CALIBRATION_FILE = path.join(ROOT, 'calibration-data.jsonl');

async function handleSaveCalibration(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const field = typeof payload.field === 'string' ? payload.field.trim() : '';
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  const feedback = payload.feedback === 'like' || payload.feedback === 'dislike' ? payload.feedback : null;

  if (!field || !text) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'field and text are required' }));
    return;
  }

  const record = { field, text, metrics, recommendations, feedback, savedAt: new Date().toISOString() };

  try {
    await fs.promises.appendFile(CALIBRATION_FILE, JSON.stringify(record) + '\n');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Saving calibration record failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Saving calibration record failed: ' + err.message }));
  }
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

async function handleUpload(req, res) {
  let payload;
  try {
    // base64 inflates size ~33%, so allow headroom over the raw file cap
    payload = await readJsonBody(req, MAX_UPLOAD_BYTES * 1.4);
  } catch (e) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or oversized request body' }));
    return;
  }

  const filename = typeof payload.filename === 'string' ? payload.filename.trim() : '';
  const dataBase64 = typeof payload.dataBase64 === 'string' ? payload.dataBase64 : '';

  if (!filename || !dataBase64) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'filename and dataBase64 are required' }));
    return;
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'dataBase64 is not valid base64' }));
    return;
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File exceeds the 15MB limit' }));
    return;
  }

  const ext = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
  const storedName = crypto.randomBytes(8).toString('hex') + ext;

  try {
    await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), buffer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: '/uploads/' + storedName, filename }));
  } catch (err) {
    console.error('Saving uploaded file failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Saving uploaded file failed: ' + err.message }));
  }
}

function handleConfig(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleApiKey: process.env.GOOGLE_API_KEY || '',
    jiraEnabled: JIRA_ENABLED,
  }));
}

// Proxies to Jira's issue picker (a lightweight autocomplete endpoint built
// for exactly this) so the browser never sees the Jira API token — only the
// server holds it, via Basic auth.
async function handleJiraSearch(req, res) {
  if (!JIRA_ENABLED) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Jira is not configured (set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env)' }));
    return;
  }

  const query = new URL(req.url, 'http://localhost').searchParams.get('q') || '';
  if (!query.trim()) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ issues: [] }));
    return;
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const url = `${JIRA_BASE_URL}/rest/api/3/issue/picker?query=${encodeURIComponent(query)}`;

  try {
    const jiraRes = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!jiraRes.ok) {
      const body = await jiraRes.text();
      throw new Error(`Jira responded ${jiraRes.status}: ${body.slice(0, 200)}`);
    }
    const data = await jiraRes.json();
    const issues = (data.sections || [])
      .flatMap((s) => s.issues || [])
      .map((i) => ({ key: i.key, summary: i.summaryText || '' }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ issues }));
  } catch (err) {
    console.error('Jira search failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Jira search failed: ' + err.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/evaluate') {
    handleEvaluate(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/calibration') {
    handleSaveCalibration(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/upload') {
    handleUpload(req, res);
    return;
  }
  if (req.method === 'GET' && req.url === '/api/config') {
    handleConfig(req, res);
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/api/jira/search')) {
    handleJiraSearch(req, res);
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
