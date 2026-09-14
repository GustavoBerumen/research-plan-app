'use strict';

const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');

// These are service-wide safety ceilings for one pilot instance, not quotas
// assigned to participants. The provider's workspace budget is the money cap.
const AI_CALLS_PER_MINUTE = 60;
const AI_CONCURRENCY = 4;
const AI_TIMEOUT_MS = 30_000;
const PILOT_BODY_BYTES = 64 * 1024;

class PilotAIError extends Error {
  constructor(message, status = 429, retryAfter = 60) {
    super(message);
    this.name = 'PilotAIError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function createPilotGuard({ pilot, env, now = Date.now, timeoutMs = AI_TIMEOUT_MS }) {
  if (env.RENDER === 'true' && !pilot) {
    throw new Error('Render deployment requires RPA_PILOT_MODE=true');
  }
  if (!pilot) return { allowRequest: () => true, wrapClient: client => client, runRequest: (req, res, handler) => handler(req, res) };

  const password = env.RPA_PILOT_PASSWORD;
  if (typeof password !== 'string' || !/^[\x21-\x7e]{20,200}$/.test(password)) {
    throw new Error('RPA_PILOT_PASSWORD must be 20-200 printable ASCII characters without spaces');
  }
  if (env.RPA_AI_ENABLED !== undefined && !['true', 'false'].includes(env.RPA_AI_ENABLED)) {
    throw new Error('RPA_AI_ENABLED must be true or false');
  }
  // Fail closed until the operator explicitly enables AI after checking billing.
  const aiEnabled = env.RPA_AI_ENABLED === 'true';
  const digest = text => crypto.createHash('sha256').update(text).digest();
  const expected = digest('pilot:' + password);
  const attempts = [];
  const requests = [];
  let active = 0;
  const failedLogins = [];
  const requestContext = new AsyncLocalStorage();
  const trim = (list, time) => { while (list.length && list[0] <= time - 60_000) list.shift(); };
  const reply = (res, status, error, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify({ error }));
    return false;
  };

  function allowRequest(req, res, pathname) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Health probes disclose no configuration, writing or provider information.
    if (pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) return true;
    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string' && /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
    const decoded = match && Buffer.from(match[1], 'base64');
    const valid = decoded && decoded.toString('base64') === match[1] &&
      crypto.timingSafeEqual(digest(decoded), expected);
    if (!valid) {
      const time = now();
      trim(failedLogins, time);
      if (failedLogins.length >= 30) return reply(res, 429, 'Too many sign-in attempts. Try again in a minute.', { 'Retry-After': '60' });
      failedLogins.push(time);
      return reply(res, 401, 'Pilot sign-in required.', { 'WWW-Authenticate': 'Basic realm="Research Plan pilot", charset="UTF-8"' });
    }
    // Browsers can attach Basic credentials automatically. Reject cross-site
    // submissions, including text/plain forms, before reading their bodies.
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      let sameOrigin = true;
      if (origin !== undefined) {
        try {
          const url = new URL(origin);
          sameOrigin = ['http:', 'https:'].includes(url.protocol) && url.origin === origin &&
            url.host === req.headers.host && (env.RENDER !== 'true' || url.protocol === 'https:');
        } catch (_) { sameOrigin = false; }
      }
      if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
        return reply(res, 403, 'Open the app directly to use this feature.');
      }
    }
    if (req.method === 'POST' && ['/api/evaluate', '/api/suggest-framework', '/api/suggest-methods'].includes(pathname)) {
      const time = now();
      trim(requests, time);
      if (!aiEnabled) return reply(res, 503, 'AI is paused for this pilot. Your writing is safe; contact the session organiser.');
      if (requests.length >= 30) return reply(res, 429, 'Too many AI requests. Your writing is safe; try again in a minute.', { 'Retry-After': '60' });
      requests.push(time);
    }
    return true;
  }

  function wrapClient(client) {
    return { messages: { create: async (request, options = {}) => {
      if (!aiEnabled) throw new PilotAIError('AI is paused for this pilot. Your writing is safe; contact the session organiser.', 503, 0);
      const parentSignals = [options.signal, requestContext.getStore()].filter(Boolean);
      for (const signal of parentSignals) signal.throwIfAborted();
      const time = now();
      trim(attempts, time);
      if (attempts.length >= AI_CALLS_PER_MINUTE) {
        throw new PilotAIError('The pilot has reached its AI request limit. Your writing is safe; try again in a minute.');
      }
      if (active >= AI_CONCURRENCY) {
        throw new PilotAIError('AI is busy with other pilot requests. Your writing is safe; try again shortly.', 429, 5);
      }
      attempts.push(time);
      active++;
      const controller = new AbortController();
      const signal = AbortSignal.any([...parentSignals, controller.signal]);
      const timeout = Math.min(options.timeout || AI_TIMEOUT_MS, timeoutMs, AI_TIMEOUT_MS);
      const timer = setTimeout(() => controller.abort(Object.assign(new Error('AI request timed out'), { category: 'timeout' })), timeout);
      let onAbort;
      try {
        // Keep a slot until the underlying call settles, even if a transport
        // ignores cancellation. Timeouts never create extra concurrent calls.
        const work = new Promise(resolve => {
          signal.throwIfAborted();
          resolve(client.messages.create(request, { ...options, signal, maxRetries: 0, timeout }));
        }).finally(() => { active--; });
        const aborted = new Promise((resolve, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener('abort', onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
        return await Promise.race([work, aborted]);
      } catch (err) {
        // Provider billing denials are configuration stops, not retryable outages.
        const message = String(err.message || '');
        if ([400, 402, 429].includes(err.status) &&
            /credit balance|specified (workspace )?API usage limits|monthly API usage threshold|enforced_spend_limit_reached/i.test(message)) {
          throw new PilotAIError('The pilot AI budget or credits are exhausted. Your writing is safe; contact the session organiser.', 503, 0);
        }
        throw err;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      }
    } } };
  }
  async function runRequest(req, res, handler) {
    const controller = new AbortController();
    const cancel = () => controller.abort(new PilotAIError('The request ended. Your writing is safe; try again.', 503, 0));
    const timer = setTimeout(cancel, 95_000);
    res.once('close', cancel);
    try { return await requestContext.run(controller.signal, () => handler(req, res)); }
    finally { clearTimeout(timer); res.removeListener('close', cancel); }
  }
  return { allowRequest, wrapClient, runRequest };
}

module.exports = { createPilotGuard, PilotAIError, PILOT_BODY_BYTES };
