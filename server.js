'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { setTimeout: delay } = require('node:timers/promises');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 8934;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const pilotSetting = process.env.RPA_PILOT_MODE;
if (pilotSetting !== undefined && pilotSetting !== 'true' && pilotSetting !== 'false') {
  throw new Error('RPA_PILOT_MODE must be true or false');
}
const PILOT_MODE = pilotSetting === 'true';

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
const JIRA_ENABLED = !PILOT_MODE && !!(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN);
const CAPABILITIES = Object.freeze({
  calibration: !PILOT_MODE,
  uploads: !PILOT_MODE,
  addFramework: !PILOT_MODE,
  jira: JIRA_ENABLED,
  googleDrive: !PILOT_MODE && !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_API_KEY),
});

// Only these exact public files may be read, in every mode. Never derive a
// filesystem path from request text (including Windows separators/drive names).
const PUBLIC_ASSETS = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/style.css', 'style.css'],
  ['/app.js', 'app.js'],
  ['/score-classification.js', 'score-classification.js'],
  ['/textarea-autosize.js', 'textarea-autosize.js'],
  ['/test-profiles.js', 'test-profiles.js'],
  ['/research-plan-template.md', 'research-plan-template.md'],
  ['/research-plan-rubric.md', 'research-plan-rubric.md'],
  ['/research-methods.md', 'research-methods.md'],
]);

function requestPath(url) {
  // Check the raw target before URL parsers can normalise traversal away.
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') ||
      /[\\\s#\x00-\x1f\x7f]/.test(url)) return null;
  try { decodeURIComponent(url); } catch (_) { return null; }
  const pathname = url.split('?')[0];
  // Public/API paths are ASCII literals: encoded aliases are not supported.
  if (pathname.includes('%') || pathname.split('/').some(p => p === '.' || p === '..')) return null;
  return pathname;
}

function routeError(res, status, message, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify({ error: message }));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function serveStatic(req, res, urlPath) {
  const asset = PUBLIC_ASSETS.get(urlPath);
  if (!asset) return routeError(res, 404, 'Not found');
  const filePath = path.join(ROOT, asset);
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
        minItems: 0,
        maxItems: 2,
        description: 'Zero to two concrete recommendations. Return an empty array when no lower-scoring criterion supports an improvement.',
        items: {
          type: 'object',
          properties: {
            criterionName: { type: 'string', description: 'Exact name of a criterion that scored 1 or 2.' },
            text: { type: 'string', maxLength: 100, description: 'One concrete sentence (15 words max).' },
          },
          required: ['criterionName', 'text'],
        },
      },
    },
    required: ['metrics', 'recommendations'],
  },
};

const LIST_ENTRY_METRIC_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    score: { type: 'integer', minimum: 1, maximum: 3 },
    desc: {
      type: 'string',
      maxLength: 90,
      description: 'One short sentence (12 words max) justifying the score, grounded in this numbered entry.',
    },
  },
  required: ['name', 'score', 'desc'],
};

const RESEARCH_QUESTIONS_EVAL_TOOL = {
  name: 'submit_research_questions_evaluation',
  description: 'Submit individual evaluations for each research question and an evaluation of the question set.',
  input_schema: {
    type: 'object',
    properties: {
      entryEvaluations: {
        type: 'array',
        minItems: 1,
        description: 'One evaluation per supplied research question, in the same order and using its supplied number.',
        items: {
          type: 'object',
          properties: {
            number: { type: 'integer', minimum: 1 },
            metrics: {
              type: 'array',
              minItems: 1,
              description: 'One entry per supplied rubric criterion, in the same order and with the same name.',
              items: LIST_ENTRY_METRIC_SCHEMA,
            },
          },
          required: ['number', 'metrics'],
        },
      },
      setMetrics: {
        type: 'array',
        minItems: 0,
        maxItems: 4,
        description: 'Empty when only one question is supplied; otherwise exactly four metrics, in this order: Duplication, Coherence, Alignment, Overall Scope.',
        items: LIST_ENTRY_METRIC_SCHEMA,
      },
      recommendations: {
        type: 'array',
        minItems: 0,
        maxItems: 2,
        description: 'Zero to two improvements supported by a criterion scoring 1 or 2. Use questionNumber=0 for a set-level recommendation.',
        items: {
          type: 'object',
          properties: {
            questionNumber: { type: 'integer', minimum: 0 },
            criterionName: { type: 'string', description: 'Exact name of a lower-scoring criterion for this question or the question set.' },
            text: { type: 'string', maxLength: 110, description: 'One concrete sentence (15 words max).' },
          },
          required: ['questionNumber', 'criterionName', 'text'],
        },
      },
    },
    required: ['entryEvaluations', 'setMetrics', 'recommendations'],
  },
};

function toolWithRecommendationCriteria(tool, criterionNames) {
  const recommendations = tool.input_schema.properties.recommendations;
  const recommendationItem = recommendations.items;
  return {
    ...tool,
    input_schema: {
      ...tool.input_schema,
      properties: {
        ...tool.input_schema.properties,
        recommendations: {
          ...recommendations,
          items: {
            ...recommendationItem,
            properties: {
              ...recommendationItem.properties,
              criterionName: {
                ...recommendationItem.properties.criterionName,
                enum: [...new Set(criterionNames)],
              },
            },
          },
        },
      },
    },
  };
}

function scalarEvalTool(rubric) {
  return toolWithRecommendationCriteria(EVAL_TOOL, rubric.map((criterion) => criterion.name));
}

function researchQuestionsEvalTool(entryCount, rubric) {
  const hasQuestionSet = entryCount > 1;
  const setMetricCount = hasQuestionSet ? QUESTION_SET_CRITERIA.length : 0;
  const criteria = rubric.map((criterion) => criterion.name);
  if (hasQuestionSet) criteria.push(...QUESTION_SET_CRITERIA.map((criterion) => criterion.name));
  const tool = toolWithRecommendationCriteria(RESEARCH_QUESTIONS_EVAL_TOOL, criteria);
  const setMetrics = tool.input_schema.properties.setMetrics;
  const recommendations = tool.input_schema.properties.recommendations;
  const recommendationItem = recommendations.items;
  return {
    ...tool,
    input_schema: {
      ...tool.input_schema,
      properties: {
        ...tool.input_schema.properties,
        setMetrics: {
          ...setMetrics,
          minItems: setMetricCount,
          maxItems: setMetricCount,
        },
        recommendations: {
          ...recommendations,
          items: {
            ...recommendationItem,
            properties: {
              ...recommendationItem.properties,
              questionNumber: {
                ...recommendationItem.properties.questionNumber,
                minimum: hasQuestionSet ? 0 : 1,
              },
            },
          },
        },
      },
    },
  };
}

const OUTCOMES_EVAL_TOOL = {
  name: 'submit_outcomes_evaluation',
  description: 'Submit individual evaluations for each outcome against its positionally corresponding research question.',
  input_schema: {
    type: 'object',
    properties: {
      entryEvaluations: {
        type: 'array',
        minItems: 1,
        description: 'One evaluation per supplied outcome, in the same order and using its supplied number.',
        items: {
          type: 'object',
          properties: {
            number: { type: 'integer', minimum: 1 },
            metrics: {
              type: 'array',
              minItems: 1,
              description: 'One entry per supplied rubric criterion, in the same order and with the same name.',
              items: LIST_ENTRY_METRIC_SCHEMA,
            },
          },
          required: ['number', 'metrics'],
        },
      },
      recommendations: {
        type: 'array',
        minItems: 0,
        maxItems: 2,
        description: 'Zero to two improvements supported by a lower-scoring criterion and assigned to a supplied outcome number.',
        items: {
          type: 'object',
          properties: {
            outcomeNumber: { type: 'integer', minimum: 1 },
            criterionName: { type: 'string', description: 'Exact name of a lower-scoring criterion for this outcome.' },
            text: { type: 'string', maxLength: 110, description: 'One concrete sentence (15 words max).' },
          },
          required: ['outcomeNumber', 'criterionName', 'text'],
        },
      },
    },
    required: ['entryEvaluations', 'recommendations'],
  },
};

function outcomesEvalTool(rubric) {
  return toolWithRecommendationCriteria(OUTCOMES_EVAL_TOOL, rubric.map((criterion) => criterion.name));
}

const QUESTION_SET_CRITERIA = [
  { name: 'Duplication', desc: 'Questions make distinct contributions without materially repeating one another.' },
  { name: 'Coherence', desc: 'Questions work together as a complementary and logically connected set.' },
  { name: 'Alignment', desc: 'The set collectively addresses the stated research objective when one is supplied.' },
  { name: 'Overall Scope', desc: 'The combined set is appropriately bounded for one research effort.' },
];

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
    strong: 'Identify which data visualisation errors cause users to misinterpret their monthly report, so we can refine the Q3 dashboard redesign.',
  },
  'Feasible': {
    weak: "Understand our users' entire financial workflow.",
    strong: 'Understand how new users categorise their first expense during onboarding.',
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
    `actual statement (reference specifics from it, don't just restate the rubric). Return zero, one, or two concrete ` +
    `recommendations (one sentence each, 15 words max). Every recommendation must name criterionName exactly and ` +
    `address a material issue in that criterion, which must have scored 1 or 2. Return an empty recommendations array ` +
    `when every criterion scores 3 or no material issue supports advice; never invent advice to fill a quota. Use ` +
    `British English spelling throughout (e.g. "prioritise", "colour", "analyse").`;
}

function parseNumberedEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    if (typeof entry === 'string') return { number: index + 1, text: entry.trim() };
    if (!entry || typeof entry !== 'object') return { number: index + 1, text: '' };
    const number = Number.isInteger(entry.number) && entry.number > 0 ? entry.number : index + 1;
    return { number, text: typeof entry.text === 'string' ? entry.text.trim() : '' };
  }).filter((entry) => entry.text);
}

function formatNumberedEntries(entries, label) {
  return entries.map((entry) => `${label} ${entry.number}:\n${entry.text}`).join('\n\n');
}

function buildResearchQuestionsPrompt(entries, rubric, objective) {
  const rubricList = rubric.map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`).join('\n');
  const setList = QUESTION_SET_CRITERIA.map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`).join('\n');
  const hasQuestionSet = entries.length > 1;
  const onlyQuestionNumber = entries[0] ? entries[0].number : 1;
  const objectiveText = objective
    ? `Research objective:\n"""\n${objective}\n"""\n\n`
    : 'No research objective was supplied; judge Alignment from the questions\' shared direction.\n\n';
  const setInstructions = hasQuestionSet
    ? `Then evaluate the complete question set against exactly these four criteria, in this order:\n${setList}\n\n`
    : 'Only one question was supplied, so there is no question set to evaluate. Return setMetrics as an empty array. ' +
      'Do not assess set-level duplication, coherence, alignment or overall scope, and do not recommend adding another question.\n\n';
  const recommendationTarget = hasQuestionSet
    ? 'targeted to a specific question number, or use questionNumber=0 for the whole set. '
    : `targeted to Question ${onlyQuestionNumber}; do not use questionNumber=0. `;

  return 'You are evaluating a structured list of Research Questions for a UX research plan. Each numbered item is ' +
    'an intentionally separate question. Multiple distinct, complementary questions are expected: do not lower a score ' +
    'merely because the questions differ, and do not recommend merging them solely because more than one exists.\n\n' +
    objectiveText +
    `Research questions:\n"""\n${formatNumberedEntries(entries, 'Question')}\n"""\n\n` +
    `Evaluate EACH question independently against every criterion below, preserving its supplied number:\n${rubricList}\n\n` +
    setInstructions +
    'For every metric, give an integer score from 1-3 and a short justification grounded in the relevant question or ' +
    'set. Return zero, one, or two concrete recommendations ' + recommendationTarget +
    'Every recommendation must name criterionName exactly and address a material issue in that criterion for its target, ' +
    'which must have scored 1 or 2. Return an empty recommendations array when all applicable criteria score 3 or no ' +
    'material issue supports advice; never invent advice to fill a quota. ' +
    'Distinct questions are a problem only when they are duplicative, incoherent, misaligned, or ' +
    'collectively too broad. Use British English spelling throughout.';
}

function buildOutcomesPrompt(entries, researchQuestions, rubric, objective) {
  const rubricList = rubric.map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`).join('\n');
  const questionByNumber = new Map(researchQuestions.map((entry) => [entry.number, entry.text]));
  const pairs = entries.map((entry) => {
    const question = questionByNumber.get(entry.number);
    return `Outcome ${entry.number}:\n${entry.text}\n\n` +
      (question ? `Corresponding Research Question ${entry.number}:\n${question}` : `Corresponding Research Question ${entry.number}:\n[Not supplied]`);
  }).join('\n\n---\n\n');
  const objectiveText = objective ? `Research objective:\n"""\n${objective}\n"""\n\n` : '';

  return 'You are evaluating a structured list of Outcomes for a UX research plan. Evaluate EACH numbered outcome ' +
    'independently against every rubric criterion below. For Alignment, compare Outcome N only with Research Question N; ' +
    'never pair it with a different question. If that corresponding question was not supplied, identify the missing pair ' +
    'and score Alignment accordingly.\n\n' +
    objectiveText +
    `Outcome-question pairs:\n"""\n${pairs}\n"""\n\n` +
    `Rubric criteria, in the order required for every outcome:\n${rubricList}\n\n` +
    'For every metric, give an integer score from 1-3 and a short justification grounded in that numbered outcome and, ' +
    'where relevant, its same-numbered question. Return zero, one, or two concrete recommendations, each assigned to a ' +
    'supplied outcome number. Every recommendation must name criterionName exactly and address a material issue in that ' +
    'criterion for its target, which must have scored 1 or 2. Return an empty recommendations array when all applicable ' +
    'criteria score 3 or no material issue supports advice; never invent advice to fill a quota. Use British English ' +
    'spelling throughout.';
}

async function requestEvaluation(tool, prompt, maxTokens, { client, signal, attemptTimeoutMs }) {
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: prompt }],
    }, { maxRetries: 0, timeout: attemptTimeoutMs, signal });
  } catch (err) {
    // A truncated/non-JSON provider response fails while the SDK reads the body.
    if (err instanceof SyntaxError) throw unexpectedEvaluationShape('response.json');
    if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_BODY_TIMEOUT']
      .includes(err.cause?.code || err.code)) {
      throw new Anthropic.APIConnectionError({ cause: err });
    }
    throw err;
  }
  const toolUse = Array.isArray(message?.content)
    ? message.content.find((block) => block?.type === 'tool_use' && block.name === tool.name) : null;
  if (!toolUse) throw unexpectedEvaluationShape('tool_use.missing');
  validateEvaluationInput(toolUse.input);
  return toolUse.input;
}

const EVALUATION_ATTEMPTS = 3;
const EVALUATION_ATTEMPT_TIMEOUT_MS = 30000;
const EVALUATION_RETRY_DELAYS_MS = [500, 1000];

function unexpectedEvaluationShape(rule) {
  return Object.assign(new Error('Model returned an unexpected evaluation shape'), {
    category: 'invalid_evaluation', rule,
  });
}

function validateEvaluationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw unexpectedEvaluationShape('tool_input.object');
  }
}

function evaluationFailureCategory(err) {
  if (err.category === 'invalid_evaluation' || err.category === 'timeout') return err.category;
  if (err instanceof Anthropic.APIUserAbortError || err.name === 'AbortError') return 'cancelled';
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'timeout';
  if (err instanceof Anthropic.APIConnectionError) return 'connection';
  if (err.status === 401 || err.status === 403) return 'authentication';
  if ([408, 409, 429].includes(err.status) || (err.status >= 500 && err.status <= 599)) return 'transient_http';
  return 'provider_error';
}

// The only retry owner for evaluations. Injectable SDK client and short durations
// let offline tests exercise real request/validation/cancellation paths without
// changing production environment variables or waiting 30 seconds per attempt.
async function evaluateWithRetries(tool, prompt, maxTokens, format, {
  signal,
  client = anthropic,
  attemptTimeoutMs = EVALUATION_ATTEMPT_TIMEOUT_MS,
  retryDelaysMs = EVALUATION_RETRY_DELAYS_MS,
  log = (event) => console.info('Evaluation attempt:', JSON.stringify(event)),
} = {}) {
  const evaluationId = crypto.randomUUID();
  for (let attempt = 1; attempt <= EVALUATION_ATTEMPTS; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(Object.assign(new Error('Evaluation timed out'), {
      category: 'timeout',
    })), attemptTimeoutMs);
    let onAbort;
    try {
      const aborted = new Promise((resolve, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      // The outer deadline also covers response-body reads, beyond the SDK's
      // header timeout. Aborting propagates to its actual fetch, not just our wait.
      const result = await Promise.race([
        requestEvaluation(tool, prompt, maxTokens, { client, signal: controller.signal, attemptTimeoutMs })
          .then(format),
        aborted,
      ]);
      controller.signal.throwIfAborted();
      log({ evaluationId, attempt, category: 'success' });
      return result;
    } catch (err) {
      const category = signal?.aborted ? 'cancelled' : evaluationFailureCategory(err);
      log({ evaluationId, attempt, category, ...(err.rule ? { rule: err.rule } : {}),
        ...(Number.isInteger(err.status) ? { status: err.status } : {}) });
      if (category === 'cancelled') throw err;
      const retryable = ['invalid_evaluation', 'timeout', 'connection', 'transient_http'].includes(category);
      if (!retryable || attempt === EVALUATION_ATTEMPTS) {
        // Never send raw SDK errors (which can contain request content) to the UI.
        const message = retryable ? 'No valid evaluation was received after 3 attempts.'
          : category === 'authentication' ? 'The evaluation service could not authenticate. Check its configuration.'
          : 'The evaluation service could not complete this request. Check its configuration and input.';
        throw new Error(message);
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', onAbort);
    }
    await delay(retryDelaysMs[attempt - 1], undefined, { signal });
  }
}

function validateMetrics(metrics, rubric) {
  if (!Array.isArray(metrics) || metrics.length !== rubric.length) {
    throw unexpectedEvaluationShape('metrics.array_length');
  }
  rubric.forEach((criterion, index) => {
    const metric = metrics[index];
    if (!metric || typeof metric !== 'object' || metric.name !== criterion.name ||
        !Number.isInteger(metric.score) || metric.score < 1 || metric.score > 3 ||
        typeof metric.desc !== 'string' || !metric.desc.trim()) {
      throw unexpectedEvaluationShape('metrics[' + index + '].name_score_description');
    }
  });
  return metrics;
}

function lowerScoringCriteria(metrics, rubric) {
  return new Set(rubric
    .filter((criterion, index) => metrics[index].score < 3)
    .map((criterion) => criterion.name));
}

function validateRecommendations(recommendations, validateRecommendation) {
  if (!Array.isArray(recommendations) || recommendations.length > 2) {
    throw unexpectedEvaluationShape('recommendations.array_length');
  }
  return recommendations.map((recommendation) => {
    if (!recommendation || typeof recommendation !== 'object' ||
        typeof recommendation.criterionName !== 'string' ||
        typeof recommendation.text !== 'string' || !recommendation.text.trim() ||
        !validateRecommendation(recommendation)) {
      throw unexpectedEvaluationShape('recommendations.criterion_target_text');
    }
    return { ...recommendation, text: recommendation.text.trim() };
  });
}

function formatScalarResult(input, rubric) {
  validateEvaluationInput(input);
  const metrics = validateMetrics(input.metrics, rubric);
  const lowerCriteria = lowerScoringCriteria(metrics, rubric);
  const recommendations = validateRecommendations(
    input.recommendations,
    (recommendation) => lowerCriteria.has(recommendation.criterionName)
  );
  return {
    metrics,
    recommendations: recommendations.map((recommendation) =>
      `${recommendation.criterionName}: ${recommendation.text}`
    ),
  };
}

function entryEvaluationsByNumber(input, entries, rubric) {
  validateEvaluationInput(input);
  if (!Array.isArray(input.entryEvaluations) || input.entryEvaluations.length !== entries.length) {
    throw unexpectedEvaluationShape('entryEvaluations.array_length');
  }
  const validNumbers = new Set(entries.map((entry) => entry.number));
  const byNumber = new Map();
  input.entryEvaluations.forEach((evaluation) => {
    if (!evaluation || typeof evaluation !== 'object' ||
        !validNumbers.has(evaluation.number) || byNumber.has(evaluation.number)) {
      throw unexpectedEvaluationShape('entryEvaluations.unique_supplied_number');
    }
    validateMetrics(evaluation.metrics, rubric);
    byNumber.set(evaluation.number, evaluation);
  });
  return byNumber;
}

function flattenEntryMetrics(entries, rubric, label, byNumber) {
  return entries.flatMap((entry) => {
    const evaluation = byNumber.get(entry.number);
    return rubric.map((criterion, index) => {
      const metric = evaluation.metrics[index];
      const isOutcomeAlignment = label === 'Outcome' && criterion.name.toLowerCase() === 'alignment';
      return {
        name: isOutcomeAlignment
          ? `Outcome ${entry.number} ↔ Question ${entry.number} — ${criterion.name}`
          : `${label} ${entry.number} — ${criterion.name}`,
        scope: isOutcomeAlignment ? 'alignment' : 'entry-quality',
        score: metric.score,
        desc: metric.desc,
      };
    });
  });
}

function formatResearchQuestionResult(input, entries, rubric) {
  const byNumber = entryEvaluationsByNumber(input, entries, rubric);
  const metrics = flattenEntryMetrics(entries, rubric, 'Question', byNumber);
  const hasQuestionSet = entries.length > 1;
  const setRubric = hasQuestionSet ? QUESTION_SET_CRITERIA : [];
  const setMetrics = validateMetrics(input.setMetrics, setRubric);
  if (hasQuestionSet) {
    QUESTION_SET_CRITERIA.forEach((criterion, index) => {
      metrics.push({
        name: `Question set — ${criterion.name}`,
        scope: criterion.name === 'Alignment' ? 'alignment' : 'set-quality',
        score: setMetrics[index].score,
        desc: setMetrics[index].desc,
      });
    });
  }

  const validNumbers = new Set(entries.map((entry) => entry.number));
  if (hasQuestionSet) validNumbers.add(0);
  const recommendations = validateRecommendations(input.recommendations, (recommendation) => {
    if (!Number.isInteger(recommendation.questionNumber) ||
        !validNumbers.has(recommendation.questionNumber)) return false;
    const targetMetrics = recommendation.questionNumber === 0
      ? setMetrics
      : byNumber.get(recommendation.questionNumber).metrics;
    const targetRubric = recommendation.questionNumber === 0 ? QUESTION_SET_CRITERIA : rubric;
    return lowerScoringCriteria(targetMetrics, targetRubric).has(recommendation.criterionName);
  });
  return {
    metrics,
    recommendations: recommendations.map((recommendation) =>
      `${recommendation.questionNumber === 0 ? 'Question set' : 'Question ' + recommendation.questionNumber}` +
      ` — ${recommendation.criterionName}: ${recommendation.text}`
    ),
  };
}

function formatOutcomesResult(input, entries, rubric) {
  const byNumber = entryEvaluationsByNumber(input, entries, rubric);
  const metrics = flattenEntryMetrics(entries, rubric, 'Outcome', byNumber);
  const validNumbers = new Set(entries.map((entry) => entry.number));
  const recommendations = validateRecommendations(input.recommendations, (recommendation) => {
    if (!Number.isInteger(recommendation.outcomeNumber) ||
        !validNumbers.has(recommendation.outcomeNumber)) return false;
    const targetMetrics = byNumber.get(recommendation.outcomeNumber).metrics;
    return lowerScoringCriteria(targetMetrics, rubric).has(recommendation.criterionName);
  });
  return {
    metrics,
    recommendations: recommendations.map((recommendation) =>
      `Outcome ${recommendation.outcomeNumber} — ${recommendation.criterionName}: ${recommendation.text}`
    ),
  };
}

async function handleEvaluate(req, res, evaluationOptions = {}) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'An evaluation object is required.' }));
    return;
  }
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const rubric = Array.isArray(payload.rubric) ? payload.rubric : [];
  const fieldLabel = typeof payload.fieldLabel === 'string' && payload.fieldLabel ? payload.fieldLabel : 'Field';
  const fieldKey = typeof payload.fieldKey === 'string' ? payload.fieldKey : '';
  const entries = parseNumberedEntries(payload.entries);
  const researchQuestions = parseNumberedEntries(payload.researchQuestions);
  const objective = payload.context && typeof payload.context.objective === 'string'
    ? payload.context.objective.trim()
    : '';

  const structured = fieldKey === 'researchQuestions' || fieldKey === 'outcomes';
  if (structured ? entries.length === 0 : !text) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: fieldKey === 'researchQuestions' || fieldKey === 'outcomes' ? 'entries are required' : 'text is required' }));
    return;
  }
  if (rubric.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No rubric criteria configured for "' + fieldLabel + '" in research-plan-rubric.md' }));
    return;
  }
  if (rubric.some((criterion) => !criterion || typeof criterion.name !== 'string' || !criterion.name.trim() ||
      typeof criterion.desc !== 'string' || !criterion.desc.trim()) ||
      new Set(rubric.map((criterion) => criterion.name)).size !== rubric.length ||
      (structured && new Set(entries.map((entry) => entry.number)).size !== entries.length)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid rubric criteria or duplicate entry numbers.' }));
    return;
  }

  const controller = new AbortController();
  const cancel = () => controller.abort();
  // IncomingMessage's 'close' also fires after a normal request body. Observe
  // the response instead so only a disconnected browser cancels provider work.
  res.on('close', cancel);
  if (res.destroyed) cancel();
  try {
    const options = { ...evaluationOptions, signal: controller.signal };
    let result;
    if (fieldKey === 'researchQuestions') {
      result = await evaluateWithRetries(
        researchQuestionsEvalTool(entries.length, rubric),
        buildResearchQuestionsPrompt(entries, rubric, objective),
        2048,
        (input) => formatResearchQuestionResult(input, entries, rubric), options
      );
    } else if (fieldKey === 'outcomes') {
      result = await evaluateWithRetries(
        outcomesEvalTool(rubric),
        buildOutcomesPrompt(entries, researchQuestions, rubric, objective),
        2048,
        (input) => formatOutcomesResult(input, entries, rubric), options
      );
    } else {
      result = await evaluateWithRetries(scalarEvalTool(rubric), buildPrompt(fieldLabel, text, rubric), 1024,
        (input) => formatScalarResult(input, rubric), options);
    }
    if (controller.signal.aborted) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    if (controller.signal.aborted) return;
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  } finally {
    res.removeListener('close', cancel);
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
      // Three fixed slots rather than a prose field, and each one bounded.
      // The rationale is capped at two sentences and reliably uses both; a
      // free paragraph here would do the same, and the two would merge back
      // into the one long field this ticket set out to split (RPA-62).
      guidance: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string', maxLength: 140 },
        description: 'Only if matched=true. Exactly three short, concrete instructions for applying this framework to THIS study, in this order: (1) what to look for, (2) what to ask participants, (3) what to attend to in analysis. Each under 120 characters, each an instruction the researcher can act on — not a description of the theory.',
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
  ['Problem Statement', 'problemStatement'],
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
    'specifics of this research. When matched=true, also give guidance: exactly three short instructions for applying the ' +
    'framework to this particular study — what to look for, what to ask participants, and what to attend to in analysis, ' +
    'in that order. Each under 120 characters, each something the researcher can act on, and none beginning with the ' +
    'words "look for", "ask" or "in analysis" — the panel labels each slot. Do not describe the theory: the ' +
    'library entry already does that. If no existing framework is a strong fit, report matched=false and briefly note what ' +
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
    res.end(JSON.stringify({ error: 'At least one of Background, Goal, Problem Statement, Objective, Hypothesis, or Research Questions is required' }));
    return;
  }

  let frameworksText;
  try {
    frameworksText = await fs.promises.readFile(FRAMEWORKS_FILE, 'utf8');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Framework library is unavailable' }));
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
      // Defensive on the way out: the schema asks for three, but a model can
      // still return fewer or empty strings, and the panel treats absence as
      // "nothing to show" rather than rendering a hollow list.
      const guidance = Array.isArray(matchTool.input.guidance)
        ? matchTool.input.guidance.map((g) => String(g || '').trim()).filter(Boolean).slice(0, 3)
        : [];
      res.end(JSON.stringify({
        matched: true,
        name: matchTool.input.name,
        rationale: matchTool.input.rationale,
        guidance: guidance.length === 3 ? guidance : [],
        entry: entryText,
      }));
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
    res.end(JSON.stringify({ error: 'Framework library is unavailable' }));
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
    res.end(JSON.stringify({ error: 'Saving framework entry failed' }));
  }
}

// ---------- methods suggestion ----------
const METHODS_FILE = path.join(ROOT, 'research-methods.md');

function parseMethodsList(text) {
  // CRLF-safe: the same normalisation the client parsers do.
  return text.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '')
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
    res.end(JSON.stringify({ error: 'Methods library is unavailable' }));
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
    res.end(JSON.stringify({ error: 'Saving calibration record failed' }));
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
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), buffer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: '/uploads/' + storedName, filename }));
  } catch (err) {
    console.error('Saving uploaded file failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Saving uploaded file failed' }));
  }
}

function handleConfig(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    pilotMode: PILOT_MODE,
    capabilities: CAPABILITIES,
    ...(CAPABILITIES.googleDrive ? {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleApiKey: process.env.GOOGLE_API_KEY,
    } : {}),
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

const API_ROUTES = new Map([
  ['/api/evaluate', ['POST', handleEvaluate]],
  ['/api/calibration', ['POST', handleSaveCalibration, 'calibration']],
  ['/api/suggest-framework', ['POST', handleSuggestFramework]],
  ['/api/add-framework', ['POST', handleAddFramework, 'addFramework']],
  ['/api/suggest-methods', ['POST', handleSuggestMethods]],
  ['/api/upload', ['POST', handleUpload, 'uploads']],
  ['/api/config', ['GET', handleConfig]],
  ['/api/jira/search', ['GET', handleJiraSearch, 'jira']],
]);

const server = http.createServer((req, res) => {
  const pathname = requestPath(req.url);
  if (pathname === null) return routeError(res, 400, 'Invalid request path');
  const route = API_ROUTES.get(pathname);
  if (route) {
    const [method, handler, capability] = route;
    // This gate runs before any handler or body listeners, regardless of
    // method, query parameters, request body or browser capability state.
    if (capability && !CAPABILITIES[capability]) return routeError(res, 403, 'This feature is unavailable');
    if (req.method !== method) return routeError(res, 405, 'Method not allowed', { Allow: method });
    handler(req, res);
    return;
  }
  if (req.method !== 'GET') return routeError(res, 405, 'Method not allowed', { Allow: 'GET' });
  serveStatic(req, res, pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Research Plan app running at http://localhost:${PORT}/  (model: ${MODEL})`);
  });
}

module.exports = {
  evaluateWithRetries,
  handleEvaluate,
  EVAL_TOOL,
  OUTCOMES_EVAL_TOOL,
  QUESTION_SET_CRITERIA,
  RESEARCH_QUESTIONS_EVAL_TOOL,
  buildOutcomesPrompt,
  buildPrompt,
  buildResearchQuestionsPrompt,
  formatOutcomesResult,
  formatResearchQuestionResult,
  formatScalarResult,
  outcomesEvalTool,
  parseMethodsList,
  researchQuestionsEvalTool,
  scalarEvalTool,
  // Exported so RPA-62's guidance shape can be tested without calling the API.
  FRAMEWORK_MATCH_TOOL,
  buildFrameworkMatchPrompt,
};
