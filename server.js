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
    if (!Array.isArray(toolUse.input.metrics) || toolUse.input.metrics.length === 0) {
      throw new Error('Model returned an unexpected evaluation shape — please try again');
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(toolUse.input));
  } catch (err) {
    console.error('Evaluation request failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Evaluation request failed: ' + err.message }));
  }
}

// ---------- theoretical framework suggestion ----------
const FRAMEWORKS_FILE = path.join(ROOT, 'research-theoretical-frameworks.md');

const FRAMEWORK_MATCH_TOOL = {
  name: 'submit_framework_match',
  description: 'Report whether an existing framework in the library is a strong match for this research.',
  input_schema: {
    type: 'object',
    properties: {
      matched: { type: 'boolean', description: 'True only if an existing framework is a strong, specific match — not just tangentially related.' },
      name: { type: 'string', description: 'Exact "### " heading text of the matched framework. Only meaningful if matched=true.' },
      rationale: {
        type: 'string',
        maxLength: 240,
        description: 'If matched=true: why it fits, grounded in specifics of this research (2 sentences max). If matched=false: what kind of theoretical lens is missing.',
      },
    },
    required: ['matched', 'rationale'],
  },
};

const FRAMEWORK_DRAFT_TOOL = {
  name: 'submit_framework_draft',
  description: "Draft one new theoretical framework entry, formatted to match the library's existing entries exactly.",
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Exact existing "## " category heading text this belongs under, copied verbatim from the library, including the "## N." prefix.' },
      name: { type: 'string', description: 'The framework/theory name, as it would appear in a "### " heading.' },
      coreFocus: { type: 'string', maxLength: 400, description: '1-2 sentences, matching the style of the library\'s existing "Core Focus" entries.' },
      uxrApplication: { type: 'string', maxLength: 400, description: '1-2 sentences on how it applies to UX research, ideally tied to specifics of this study.' },
      references: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: { type: 'string', maxLength: 320 },
        description: "Real, verifiable academic citations, matching the library's existing citation style (author, year, title, source, DOI/URL where applicable).",
      },
      rationale: { type: 'string', maxLength: 240, description: 'Why this framework specifically helps this research (1-2 sentences).' },
    },
    required: ['category', 'name', 'coreFocus', 'uxrApplication', 'references', 'rationale'],
  },
};

const FRAMEWORK_FIELD_ORDER = [
  ['Background', 'background'],
  ['Goal', 'goal'],
  ['Problem', 'problem'],
  ['Objective', 'objective'],
  ['Hypothesis', 'hypothesis'],
  ['Research Questions', 'researchQuestions'],
];

function buildFieldsText(fields) {
  return FRAMEWORK_FIELD_ORDER
    .map(([label, key]) => [label, typeof fields[key] === 'string' ? fields[key].trim() : ''])
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}:\n${v}`)
    .join('\n\n');
}

function buildFrameworkMatchPrompt(fieldsText, frameworksText) {
  return 'You are helping a UX researcher find a theoretical framework from an existing curated library to ground their study.\n\n' +
    `Research plan details:\n"""\n${fieldsText}\n"""\n\n` +
    `Existing framework library:\n"""\n${frameworksText}\n"""\n\n` +
    'Decide if exactly one existing framework in the library is a strong, specific match for this research — not just ' +
    'tangentially related, but something that would genuinely help ground the study\'s design or analysis. If so, report ' +
    'matched=true with its exact name as it appears in a "### " heading, and a short rationale (2 sentences max) tied to ' +
    'specifics of this research. If no existing framework is a strong fit, report matched=false and briefly note what ' +
    'kind of theoretical lens is missing. Use British English spelling throughout (e.g. "prioritise", "colour", "analyse").';
}

function buildFrameworkDraftPrompt(fieldsText, frameworksText) {
  return 'You are helping a UX researcher ground their study in an established academic theory or framework. None of the ' +
    'frameworks already in the library below are a strong fit for this research, so propose ONE new framework entry to ' +
    'add to the library.\n\n' +
    `Research plan details:\n"""\n${fieldsText}\n"""\n\n` +
    `Existing framework library (context and formatting reference — do not repeat any of these):\n"""\n${frameworksText}\n"""\n\n` +
    'Propose a real, established theory or framework from HCI, cognitive psychology, sociology, or pedagogy — not already ' +
    'in the library — that would genuinely help ground this specific research. Requirements:\n' +
    '- category: copy the exact heading text of whichever existing "## " category section above best fits (verbatim, including the "## N." prefix).\n' +
    '- name: the framework\'s name, as it would appear in a "### " heading.\n' +
    '- coreFocus: 1-2 sentences, matching the style of the library\'s existing "Core Focus" entries.\n' +
    '- uxrApplication: 1-2 sentences on how it applies to UX research, ideally referencing specifics of this study.\n' +
    '- references: 1-3 REAL, verifiable, published academic citations matching the library\'s existing citation style ' +
    '(author, year, title, source, and a DOI or URL where applicable). Only cite works you are confident actually exist; ' +
    'prefer a well-known foundational citation you are sure of over an obscure or invented one.\n' +
    '- rationale: 1-2 sentences on why this framework specifically helps this research.\n\n' +
    'Use British English spelling throughout (e.g. "prioritise", "colour", "analyse") outside of direct citations.';
}

// Category ("## ") and entry ("### ") headings both live on their own line —
// matched together (2-or-3-hash) so extractFrameworkEntry can stop at
// whichever comes first, and separately (2-hash only) for
// parseFrameworkCategories, which only ever needs to reason about sections.
function parseFrameworkCategories(text) {
  return [...text.matchAll(/^## .+$/gm)].map((m) => ({ text: m[0], index: m.index }));
}

function extractFrameworkEntry(text, name) {
  const headings = [...text.matchAll(/^#{2,3} .+$/gm)].map((m) => ({ text: m[0], index: m.index }));
  const target = (name || '').trim().toLowerCase();
  const idx = headings.findIndex((h) => h.text.startsWith('### ') && h.text.slice(4).trim().toLowerCase() === target);
  if (idx === -1) return null;
  const start = headings[idx].index;
  const end = idx + 1 < headings.length ? headings[idx + 1].index : text.length;
  return text.slice(start, end).trim();
}

async function handleSuggestFramework(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const fields = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const fieldsText = buildFieldsText(fields);
  if (!fieldsText) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'At least one of Background, Goal, Problem, Objective, Hypothesis, or Research Questions is required' }));
    return;
  }

  let frameworksText;
  try {
    frameworksText = await fs.promises.readFile(FRAMEWORKS_FILE, 'utf8');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not read research-theoretical-frameworks.md: ' + err.message }));
    return;
  }

  try {
    const matchMessage = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [FRAMEWORK_MATCH_TOOL],
      tool_choice: { type: 'tool', name: 'submit_framework_match' },
      messages: [{ role: 'user', content: buildFrameworkMatchPrompt(fieldsText, frameworksText) }],
    });
    const matchTool = matchMessage.content.find((b) => b.type === 'tool_use');
    if (!matchTool) throw new Error('Model did not return a structured match result');

    if (matchTool.input.matched) {
      const entryText = extractFrameworkEntry(frameworksText, matchTool.input.name);
      if (!entryText) throw new Error('Model matched a framework not found in the library — please try again');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ matched: true, name: matchTool.input.name, rationale: matchTool.input.rationale, entry: entryText }));
      return;
    }

    const draftMessage = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [FRAMEWORK_DRAFT_TOOL],
      tool_choice: { type: 'tool', name: 'submit_framework_draft' },
      messages: [{ role: 'user', content: buildFrameworkDraftPrompt(fieldsText, frameworksText) }],
    });
    const draftTool = draftMessage.content.find((b) => b.type === 'tool_use');
    if (!draftTool) throw new Error('Model did not return a structured draft');

    const draft = draftTool.input;
    if (!draft.category || !draft.name || !draft.coreFocus || !draft.uxrApplication || !Array.isArray(draft.references) || draft.references.length === 0) {
      throw new Error('Model returned an incomplete draft — please try again');
    }

    const categories = parseFrameworkCategories(frameworksText);
    const normalizedCategory = draft.category.trim();
    const stripNumber = (s) => s.replace(/^##\s*\d+\.\s*/, '').trim().toLowerCase();
    const matchedCategory =
      categories.find((c) => c.text.trim() === normalizedCategory) ||
      categories.find((c) => stripNumber(c.text) === stripNumber(normalizedCategory));
    if (!matchedCategory) throw new Error('Model chose a category not found in the library — please try again');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      matched: false,
      draft: {
        category: matchedCategory.text,
        name: draft.name,
        coreFocus: draft.coreFocus,
        uxrApplication: draft.uxrApplication,
        references: draft.references,
        rationale: draft.rationale,
      },
    }));
  } catch (err) {
    console.error('Framework suggestion failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Framework suggestion failed: ' + err.message }));
  }
}

function formatFrameworkEntry({ name, coreFocus, uxrApplication, references }) {
  const refLines = references.map((r) => '  * ' + r.trim()).join('\n');
  return `### ${name.trim()}\n* **Core Focus:** ${coreFocus.trim()}\n* **UXR Application:** ${uxrApplication.trim()}\n* **Key References:**\n${refLines}`;
}

// Only called once a human clicks "Add this to my framework library" in the
// UI — never invoked automatically off the back of handleSuggestFramework,
// since the draft's citations may be AI-fabricated and need a human look
// before they become a permanent part of a file with real sources in it.
async function handleAddFramework(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const category = typeof payload.category === 'string' ? payload.category.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const coreFocus = typeof payload.coreFocus === 'string' ? payload.coreFocus.trim() : '';
  const uxrApplication = typeof payload.uxrApplication === 'string' ? payload.uxrApplication.trim() : '';
  const references = Array.isArray(payload.references) ? payload.references.filter((r) => typeof r === 'string' && r.trim()) : [];

  if (!category || !name || !coreFocus || !uxrApplication || references.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'category, name, coreFocus, uxrApplication, and at least one reference are required' }));
    return;
  }

  let frameworksText;
  try {
    frameworksText = await fs.promises.readFile(FRAMEWORKS_FILE, 'utf8');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not read research-theoretical-frameworks.md: ' + err.message }));
    return;
  }

  const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('^### ' + nameEscaped + '\\s*$', 'im').test(frameworksText)) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `A framework named "${name}" already exists in the library` }));
    return;
  }

  const categories = parseFrameworkCategories(frameworksText);
  const catIdx = categories.findIndex((c) => c.text.trim() === category);
  if (catIdx === -1) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown category "${category}"` }));
    return;
  }

  const sectionStart = categories[catIdx].index + categories[catIdx].text.length;
  const sectionEnd = catIdx + 1 < categories.length ? categories[catIdx + 1].index : frameworksText.length;
  const sectionSlice = frameworksText.slice(sectionStart, sectionEnd);

  // Sections end either with "\n\n---\n\n" before the next category, or (for
  // the last category) just the file's own trailing newline — strip
  // whichever tail is present, then rebuild it around the new entry so
  // spacing matches the rest of the file regardless of which case this is.
  const sepMatch = sectionSlice.match(/\n*---\s*$/);
  const rawBody = sepMatch ? sectionSlice.slice(0, sepMatch.index) : sectionSlice;
  const sectionBody = rawBody.replace(/\s+$/, '');
  // The new entry block (added below) already supplies its own trailing
  // "\n" — one more "\n" here reproduces the file's single blank line
  // before "---", not two.
  const separator = sepMatch ? '\n---\n\n' : '';

  const entryBlock = formatFrameworkEntry({ name, coreFocus, uxrApplication, references });
  const newSection = sectionBody + '\n\n' + entryBlock + '\n' + separator;
  const newContent = frameworksText.slice(0, sectionStart) + newSection + frameworksText.slice(sectionEnd);

  try {
    await fs.promises.writeFile(FRAMEWORKS_FILE, newContent);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Saving framework entry failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Saving framework entry failed: ' + err.message }));
  }
}

// ---------- methods suggestion ----------
const METHODS_FILE = path.join(ROOT, 'research-methods.md');

function parseMethodsList(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.match(/^-\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[1]);
}

const METHODS_COVERAGE_TOOL = {
  name: 'submit_methods_coverage',
  description: 'For each research question, list at most 3 existing methods that are a strong fit — the 2 closest-fitting, plus (optionally) one deliberately different in approach.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Exactly one entry per research question, in the exact same order as the numbered list given in the prompt.',
        items: {
          type: 'object',
          properties: {
            methods: {
              type: 'array',
              maxItems: 3,
              description: 'At most 3 existing methods (exact names, copied verbatim from the provided list), in this order: (1) the single closest-fitting method, (2) the second-closest-fitting method, (3) OPTIONAL — only if it genuinely adds value — one more method chosen for taking a deliberately different investigative approach from the first two (e.g. qualitative vs quantitative), not just the next-most-similar option. Leave empty if none are a good fit — do not force a weak match, and do not pad to 3 if fewer are genuinely useful.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  reason: { type: 'string', maxLength: 160, description: 'One sentence: why this method answers this specific question.' },
                  approach: {
                    type: 'string',
                    maxLength: 40,
                    description: 'This method\'s general approach in a couple of words (e.g. "quantitative", "qualitative", "behavioural/observational", "self-report", "generative", "evaluative"). Not shown to the user — used to check the optional 3rd pick is a genuinely different approach from the first two, not just another one of the same kind.',
                  },
                },
                required: ['name', 'reason', 'approach'],
              },
            },
            needsSearch: { type: 'boolean', description: 'True if none of the existing methods are a good fit and a web search for a new method is needed instead.' },
          },
          required: ['methods', 'needsSearch'],
        },
      },
    },
    required: ['questions'],
  },
};

const GAP_METHOD_TOOL = {
  name: 'submit_gap_method',
  description: 'Submit the researched method recommendation for this specific research question.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The method's real, established name." },
      description: { type: 'string', maxLength: 300, description: '1-2 sentences: what the method is and why it fits this specific question.' },
      source: { type: 'string', maxLength: 300, description: 'A specific source (publication, article, or practitioner resource) found via search that supports this recommendation — title and/or URL.' },
    },
    required: ['name', 'description', 'source'],
  },
};

const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

function buildCoveragePrompt(objective, questions, methodNames) {
  return 'You are a UX research methods advisor helping a researcher choose methods to answer their research questions.\n\n' +
    `Objective:\n"""\n${objective}\n"""\n\n` +
    'Research Questions (numbered — keep your answer in this exact order):\n' +
    questions.map((q, i) => `${i + 1}. ${q}`).join('\n') + '\n\n' +
    'Available methods (choose ONLY from this exact list when matching an existing method — copy names verbatim):\n' +
    methodNames.map((m) => '- ' + m).join('\n') + '\n\n' +
    'For EACH research question, in the same order as numbered above, list AT MOST 3 methods from the available list ' +
    '(a method can be reused across multiple questions if it fits more than one). Choose them in this order:\n' +
    '1. The single closest-fitting method for this question.\n' +
    '2. The second-closest-fitting method.\n' +
    "3. OPTIONAL — only include a third if it genuinely adds value, and make it deliberately different in approach " +
    "from the first two rather than just the next-most-similar option (e.g. if the first two are both quantitative, " +
    "the third should be qualitative, or vice versa — a genuinely different angle on the question, not more of the same).\n\n" +
    'Tag each method with its "approach" (e.g. "quantitative", "qualitative", "behavioural/observational", ' +
    '"self-report") and use that tag to actually check the 3rd pick differs from the first two before including it — ' +
    'if all your candidates share the same approach, it is better to list only 2 methods than to force a same-approach third.\n\n' +
    'For each pairing, give a one-sentence reason grounded in the specific question. Do NOT force a weak or generic ' +
    'match just to fill the array — if none of the available methods are a good fit for a question, leave its methods ' +
    'array empty and set needsSearch=true for that question instead; if only 1 or 2 are genuinely useful, list only ' +
    'those rather than padding to 3. Use British English spelling throughout (e.g. "prioritise", "colour", "analyse").';
}

function buildGapSearchPrompt(objective, question, methodNames) {
  return 'You are a UX research methods advisor. None of the methods already in our library are a strong fit for the ' +
    'following research question, so use web search to find a real, established UX/design research method — not ' +
    'already in the list below — that would genuinely help answer it.\n\n' +
    `Objective:\n"""\n${objective}\n"""\n\n` +
    `Research Question:\n"""\n${question}\n"""\n\n` +
    'Methods already considered and ruled out (do not suggest any of these):\n' +
    methodNames.map((m) => '- ' + m).join('\n') + '\n\n' +
    "Search the web to find a specific, real, methodologically sound research method that fits this question well — " +
    "do not rely on memory alone, and do not invent a method name. Once you've found a good, well-sourced fit, call " +
    'submit_gap_method with its name, a 1-2 sentence description of what it is and why it fits this specific question, ' +
    'and a source (a specific publication, article, or practitioner resource you found) that supports it. Use British ' +
    'English spelling throughout (e.g. "prioritise", "colour", "analyse").';
}

async function searchGapMethod(objective, question, methodNames) {
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools: [WEB_SEARCH_TOOL, GAP_METHOD_TOOL],
      messages: [{ role: 'user', content: buildGapSearchPrompt(objective, question, methodNames) }],
    });
    // Require actual evidence the web_search tool ran, not just an
    // instruction-following submit_gap_method call from memory — the whole
    // point of the search fallback is a real, sourced search, not a guess.
    const searchedForReal = message.content.some((b) => b.type === 'web_search_tool_result');
    const submit = message.content.find((b) => b.type === 'tool_use' && b.name === 'submit_gap_method');
    if (searchedForReal && submit && submit.input.name && submit.input.description) {
      return [{ name: submit.input.name, reason: submit.input.description, source: submit.input.source || null, viaSearch: true }];
    }
    const fallbackText = message.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    return [{
      name: null,
      reason: fallbackText || 'Web search did not return a confident recommendation for this question.',
      source: null,
      viaSearch: true,
      unresolved: true,
    }];
  } catch (err) {
    console.error('Gap method search failed:', err);
    return [{ name: null, reason: 'Web search failed: ' + err.message, source: null, viaSearch: true, unresolved: true }];
  }
}

async function handleSuggestMethods(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const objective = typeof payload.objective === 'string' ? payload.objective.trim() : '';
  const researchQuestions = Array.isArray(payload.researchQuestions)
    ? payload.researchQuestions.map((q) => (typeof q === 'string' ? q.trim() : '')).filter(Boolean)
    : [];

  if (!objective || researchQuestions.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'objective and at least one research question are required' }));
    return;
  }

  let methodsText;
  try {
    methodsText = await fs.promises.readFile(METHODS_FILE, 'utf8');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not read research-methods.md: ' + err.message }));
    return;
  }
  const methodNames = parseMethodsList(methodsText);

  try {
    const coverageMessage = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools: [METHODS_COVERAGE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_methods_coverage' },
      messages: [{ role: 'user', content: buildCoveragePrompt(objective, researchQuestions, methodNames) }],
    });
    const coverageTool = coverageMessage.content.find((b) => b.type === 'tool_use');
    if (!coverageTool) throw new Error('Model did not return a structured coverage result');

    const coverage = coverageTool.input.questions;
    if (!Array.isArray(coverage) || coverage.length !== researchQuestions.length) {
      throw new Error('Model returned an unexpected coverage shape — please try again');
    }

    const methodNameSet = new Map(methodNames.map((m) => [m.toLowerCase(), m]));

    // The model's own needsSearch flag isn't trusted on its own — every
    // question must end up covered by at least one method (requirement #3),
    // so any question left with zero *validated* existing methods is forced
    // into the search fallback regardless of what the model reported.
    const perQuestion = coverage.map((q) => {
      const methods = Array.isArray(q.methods)
        ? q.methods
            .filter((m) => m && typeof m.name === 'string' && methodNameSet.has(m.name.trim().toLowerCase()))
            .map((m) => ({ name: methodNameSet.get(m.name.trim().toLowerCase()), reason: m.reason, viaSearch: false }))
            // Cap of 3 (2 closest fits + 1 deliberately different angle) is
            // asked for in the prompt/schema, but not guaranteed by either —
            // enforce it here rather than trust the model's count.
            .slice(0, 3)
        : [];
      return { methods, needsSearch: methods.length === 0 };
    });

    const gapIndexes = perQuestion.map((q, i) => (q.needsSearch ? i : -1)).filter((i) => i !== -1);
    if (gapIndexes.length > 0) {
      const searchResults = await Promise.all(
        gapIndexes.map((i) => searchGapMethod(objective, researchQuestions[i], methodNames))
      );
      gapIndexes.forEach((i, j) => {
        perQuestion[i].methods = searchResults[j];
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ perQuestion: perQuestion.map((q) => ({ methods: q.methods })) }));
  } catch (err) {
    console.error('Methods suggestion failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Methods suggestion failed: ' + err.message }));
  }
}

// ---------- dynamic placeholder suggestion (Characteristics / User Groups) ----------
const PARTICIPANT_PLACEHOLDER_TOOL = {
  name: 'submit_participant_placeholders',
  description: 'Suggest short example phrases for the Characteristics and User Groups fields, grounded in the research context provided.',
  input_schema: {
    type: 'object',
    properties: {
      characteristics: {
        type: 'string',
        maxLength: 60,
        description: 'A noun phrase describing a KIND OF PERSON to recruit for THIS specific research — an adjective/behaviour plus a plural noun for the people themselves (e.g. "Frequent mobile shoppers", "Budget-conscious first-time buyers"), not a description of the problem or event. Just the phrase itself — no "e.g." prefix, no trailing period, under 8 words.',
      },
      userGroups: {
        type: 'string',
        maxLength: 60,
        description: 'A specific user segment relevant to THIS specific research (e.g. "New customers"). Just the phrase itself — no "e.g." prefix, no trailing period, under 8 words.',
      },
    },
    required: ['characteristics', 'userGroups'],
  },
};

function buildParticipantPlaceholderPrompt(ctx) {
  const parts = [];
  if (ctx.background) parts.push(`Background:\n"""\n${ctx.background}\n"""`);
  if (ctx.goal) parts.push(`Goal:\n"""\n${ctx.goal}\n"""`);
  if (ctx.objective) parts.push(`Objective:\n"""\n${ctx.objective}\n"""`);
  if (ctx.researchQuestions) parts.push(`Research Questions:\n"""\n${ctx.researchQuestions}\n"""`);
  return 'You are writing example placeholder text (grey hint text shown before the user types anything — not real ' +
    'answers) for two fields in a UX research plan form: "Characteristics" (participant traits/behaviours) and ' +
    '"User Groups" (user segments).\n\n' +
    parts.join('\n\n') + '\n\n' +
    'Based on this context, write one short, concrete example for each field — specific to THIS research, not a ' +
    'generic placeholder. Capitalise the first word. Use British English spelling throughout (e.g. "prioritise", ' +
    '"colour", "analyse").';
}

function capitalizeFirst(s) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function handleSuggestParticipantPlaceholders(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const ctx = {
    background: typeof payload.background === 'string' ? payload.background.trim() : '',
    goal: typeof payload.goal === 'string' ? payload.goal.trim() : '',
    objective: typeof payload.objective === 'string' ? payload.objective.trim() : '',
    researchQuestions: typeof payload.researchQuestions === 'string' ? payload.researchQuestions.trim() : '',
  };

  // The client already gates this behind a "does this look like enough to
  // work from" check before ever calling this endpoint — this is just a
  // defensive backstop against an empty/near-empty request slipping through.
  if (!(ctx.background + ctx.goal + ctx.objective + ctx.researchQuestions).trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not enough context to generate placeholders' }));
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      tools: [PARTICIPANT_PLACEHOLDER_TOOL],
      tool_choice: { type: 'tool', name: 'submit_participant_placeholders' },
      messages: [{ role: 'user', content: buildParticipantPlaceholderPrompt(ctx) }],
    });
    const toolUse = message.content.find((b) => b.type === 'tool_use');
    if (!toolUse) throw new Error('Model did not return structured placeholders');

    const characteristics = typeof toolUse.input.characteristics === 'string' ? toolUse.input.characteristics.trim() : '';
    const userGroups = typeof toolUse.input.userGroups === 'string' ? toolUse.input.userGroups.trim() : '';
    if (!characteristics || !userGroups) throw new Error('Model returned incomplete placeholders — please try again');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    // "e.g. " prefix is added here, not trusted from the model, so the
    // format always exactly matches the static placeholders it's replacing.
    res.end(JSON.stringify({
      characteristics: 'e.g. ' + capitalizeFirst(characteristics),
      userGroups: 'e.g. ' + capitalizeFirst(userGroups),
    }));
  } catch (err) {
    console.error('Participant placeholder suggestion failed:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Placeholder generation failed: ' + err.message }));
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
  if (req.method === 'POST' && req.url === '/api/suggest-framework') {
    handleSuggestFramework(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/add-framework') {
    handleAddFramework(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/suggest-methods') {
    handleSuggestMethods(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/suggest-participant-placeholders') {
    handleSuggestParticipantPlaceholders(req, res);
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
