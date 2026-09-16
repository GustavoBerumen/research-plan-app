'use strict';

// RPA-138. The transitions of the sign-off state machine, over HTTP. Thin
// by design: every rule lives in plan-workflow.js, and a route's job is to
// read the body, find the plan, hand the transition to the module and
// answer with what it says. Nothing here decides who may do what.
//
// The link decides the role. A request never says which role it is acting
// as: it presents a token, and the record says whose that is. Off unless
// RPA_SIGN_OFF_ENABLED is exactly "true", the way submissions are, because
// a plan people have signed cannot live on a disk that forgets (RPA-136).

const crypto = require('crypto');
const workflow = require('./plan-workflow');

const MAX_BODY_BYTES = 256 * 1024;
const BODY_TIMEOUT_MS = 15000;
// Applied by the author on behalf of a party, so the request names whose
// link it is about rather than acting as them.
const TRANSITIONS = new Set(['sign', 'requestChanges', 'edit', 'reopen', 'withdraw', 'issueLink', 'revokeLink']);
const STATUS_FOR = { 'version-conflict': 409, 'no-link': 404 };

// A bad link says exactly what went wrong. Gus decided this on 16 September
// 2026, choosing plain answers over hiding which plans exist: a plan address
// is 32 random hex characters, so it cannot be guessed, and a person holding
// a link that stopped working deserves to be told why. A withdrawn link is
// "gone" in HTTP's own word, because it once worked and now does not.
const NO_PLAN = { status: 404, error: 'There is no plan at this address.', code: 'no-plan' };
const UNKNOWN_LINK = { status: 404, error: 'This link is not one this plan recognises.', code: 'unknown-link' };
const LINK_WITHDRAWN = { status: 410, error: 'This link was withdrawn. Ask the plan\u2019s author for a new one.', code: 'link-withdrawn' };
function whoIsAsking(record, token) {
  if (!record) return { problem: NO_PLAN };
  const found = workflow.roleForToken(record, token);
  if (!found) return { problem: UNKNOWN_LINK };
  if (found.revoked) return { problem: LINK_WITHDRAWN };
  return { found };
}

function readBody(req, timeoutMs = BODY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(Object.assign(new Error('Request body timed out'), { status: 408 })), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) { finish(Object.assign(new Error('Request body is too large'), { status: 413 })); return; }
    req.on('data', (chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) { finish(Object.assign(new Error('Request body is too large'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    req.on('error', (err) => finish(err));
    req.on('end', () => {
      if (settled) return;
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (err) { finish(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
  });
}

function createSignOff({ env, pilot, store, now = () => new Date().toISOString(), newToken = () => crypto.randomBytes(24).toString('hex'), newId = () => crypto.randomUUID().replace(/-/g, '') }) {
  const setting = env.RPA_SIGN_OFF_ENABLED;
  if (setting !== undefined && !['true', 'false'].includes(setting)) throw new Error('RPA_SIGN_OFF_ENABLED must be true or false.');
  if (setting !== 'true') return { enabled: false, handle: null };
  // The same first slice as submissions: protected pilot access only, so a
  // plan cannot be opened by anybody who guesses an address.
  if (!pilot) throw new Error('Sign-off over HTTP requires protected pilot access.');
  if (!store) throw new Error('A store for plan records is required.');

  const reply = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const refuse = (res, result) => reply(res, STATUS_FOR[result.code] || 403, { error: result.message, code: result.code, version: result.version, revision: result.revision });
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  // What a reader is allowed to see. Both parties read the plan and its
  // ledger; a link is a capability, so only the person holding one sees it,
  // and the author sees the other person's because sending it is their job.
  const projection = (record, role) => ({
    ...record,
    parties: Object.fromEntries(workflow.ROLES.map((r) => {
      const party = record.parties[r];
      const maySee = r === role || role === record.authorRole;
      return [r, { ...party, token: maySee ? party.token : null }];
    })),
  });

  async function handle(req, res) {
    const url = new URL(req.url, 'http://plan.invalid');
    if (req.method === 'GET') {
      const id = text(url.searchParams.get('id'));
      const token = text(url.searchParams.get('as'));
      if (!id || !token) return reply(res, 400, { error: 'A plan and a link are needed to read one.' });
      let record;
      try { record = await store.read(id); } catch (err) { return reply(res, 400, { error: 'That plan could not be read.' }); }
      const { found, problem } = whoIsAsking(record, token);
      if (problem) return reply(res, problem.status, { error: problem.error, code: problem.code });
      return reply(res, 200, { plan: projection(record, found.role), role: found.role });
    }

    let body;
    try { body = await readBody(req); } catch (err) { return reply(res, err.status || 400, { error: err.message }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(res, 400, { error: 'Invalid JSON body' });
    const at = now();

    if (body.transition === 'create') {
      const tokens = { leadResearcher: newToken(), projectRequester: newToken() };
      const created = workflow.createPlan({ id: newId(), at, authorRole: body.authorRole, parties: body.parties, tokens });
      if (!created.ok) return refuse(res, created);
      try { await store.write(created.plan.id, created.plan); } catch (err) { return reply(res, 500, { error: 'That plan could not be kept.' }); }
      return reply(res, 201, { plan: projection(created.plan, created.plan.authorRole), role: created.plan.authorRole });
    }

    if (!TRANSITIONS.has(body.transition)) return reply(res, 400, { error: 'That action is not one this plan accepts.', code: 'unknown-transition' });
    const id = text(body.id);
    const token = text(body.token);
    if (!id || !token) return reply(res, 400, { error: 'A plan and a link are needed to change one.' });
    let record;
    try { record = await store.read(id); } catch (err) { return reply(res, 400, { error: 'That plan could not be read.' }); }
    const { found, problem } = whoIsAsking(record, token);
    if (problem) return reply(res, problem.status, { error: problem.error, code: problem.code });

    // The role comes from the link, never from the request. Everything else
    // the body carries is the person's own answer, and the module judges it.
    const result = workflow.apply(record, {
      transition: body.transition,
      role: found.role,
      forRole: body.forRole,
      at,
      version: body.version,
      contentHash: body.contentHash,
      declaration: body.declaration,
      note: body.note,
      revision: body.revision,
      token: body.transition === 'issueLink' ? newToken() : undefined,
    });
    if (!result.ok) return refuse(res, result);
    if (result.unchanged) return reply(res, 200, { plan: projection(record, found.role), role: found.role, unchanged: true });
    try { await store.write(id, result.plan); } catch (err) { return reply(res, 500, { error: 'That change could not be kept.' }); }
    return reply(res, 200, { plan: projection(result.plan, found.role), role: found.role });
  }

  return { enabled: true, handle };
}

module.exports = { createSignOff, readBody, MAX_BODY_BYTES, TRANSITIONS };
