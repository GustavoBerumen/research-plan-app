'use strict';

// RPA-138. The transitions of the sign-off state machine over HTTP, thin
// over plan-workflow.js: the route reads the body, finds the plan, hands
// the transition to the module and answers with what it says. The link
// decides the role — a request never names one — and a refusal changes
// nothing and carries the module's own words.
//
// Off unless RPA_SIGN_OFF_ENABLED is exactly "true", and then only behind
// protected pilot access, because a plan people have signed cannot live on
// a disk that forgets (RPA-136). Max's MVP keeps the sign-off in the
// browser, so nothing here is switched on by shipping it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadServer } = require('./rpa-89-server-harness.cjs');
const { createSignOff } = require('../sign-off-server');
const { createPlanStore } = require('../plan-store');
const W = require('../plan-workflow');

const RESEARCHER = 'I confirm this plan is complete and current, and I will conduct the research as it describes.';
const REQUESTER = 'I confirm this plan meets the needs of the project I am responsible for, and I approve it.';
const PARTIES = { leadResearcher: { email: 'priya@example.com', displayName: 'Priya Nair' }, projectRequester: { email: 'tom@example.com', displayName: 'Tom Okafor' } };
const ON = { RPA_SIGN_OFF_ENABLED: 'true' };

function memoryStore() {
  const files = new Map();
  return {
    files,
    async read(id) { const text = files.get(id); return text ? JSON.parse(text) : null; },
    async write(id, record) { files.set(id, JSON.stringify(record)); },
  };
}
// One server for the whole file. Running server.js in a fresh context is
// the expensive part of these tests, and every test makes its own plan, so
// they do not need one each: sharing keeps the suite from thrashing when
// every file runs at once.
let shared = null;
const fixture = () => {
  if (!shared) {
    const store = memoryStore();
    shared = { store, server: loadServer({ env: ON, planStore: store }) };
  }
  return shared;
};
const post = (server, body) => server.request('/api/sign-off', 'POST', typeof body === 'string' ? body : JSON.stringify(body));
const read = (server, query) => server.request('/api/sign-off/read?' + query, 'GET');
const json = (result) => JSON.parse(result.body);
// A plan created through the route, and the links it came back with.
async function created(server) {
  const result = await post(server, { transition: 'create', authorRole: 'leadResearcher', parties: PARTIES });
  assert.equal(result.status, 201, result.body);
  const plan = json(result).plan;
  return { plan, id: plan.id, mine: plan.parties.leadResearcher.token, theirs: plan.parties.projectRequester.token };
}

test('off unless it is asked for, and then only behind protected pilot access', async () => {
  const off = loadServer({ planStore: memoryStore() });
  const denied = await post(off, { transition: 'create', authorRole: 'leadResearcher', parties: PARTIES });
  assert.equal(denied.status, 403, 'the capability gate refuses before any handler runs');
  assert.deepEqual(denied.listeners, [], 'and before any body is listened for');
  assert.equal(JSON.parse((await off.request('/api/config')).body).capabilities.signOff, false);

  assert.equal(JSON.parse((await fixture().server.request('/api/config')).body).capabilities.signOff, true);
  assert.throws(() => createSignOff({ env: { RPA_SIGN_OFF_ENABLED: 'yes' }, pilot: true, store: memoryStore() }), /must be true or false/);
  assert.throws(() => createSignOff({ env: ON, pilot: false, store: memoryStore() }), /protected pilot access/);
  assert.throws(() => createSignOff({ env: ON, pilot: true }), /store for plan records is required/);
  assert.equal(createSignOff({ env: {}, pilot: true }).enabled, false, 'and with nothing set it simply does not exist');
});

test('creating a plan mints a link for each party and keeps the record', async () => {
  const { server, store } = fixture();
  const { plan, id, mine, theirs } = await created(server);
  assert.equal(plan.status, 'draft');
  assert.equal(plan.version, 1);
  assert.match(id, /^[a-f0-9]{32}$/);
  assert.ok(mine && theirs && mine !== theirs, 'one link each, not one between them');
  assert.equal(JSON.parse(store.files.get(id)).parties.projectRequester.token, theirs, 'and the record is kept');

  const kept = store.files.size;
  const refused = await post(server, { transition: 'create', authorRole: 'leadResearcher', parties: { leadResearcher: { email: 'a@x.com' }, projectRequester: { email: 'a@x.com' } } });
  assert.equal(refused.status, 403);
  assert.equal(json(refused).code, 'same-person');
  assert.equal(json(refused).error, 'Enter a different email address for the other person. One person cannot sign for both.');
  assert.equal(store.files.size, kept, 'a refusal keeps nothing');
});

test('the link decides the role: a request never says which one it is acting as', async () => {
  const { server, store } = fixture();
  const { id, mine, theirs } = await created(server);

  // The author's link signs as the author, whatever the body claims.
  const signed = await post(server, { id, token: mine, version: 1, transition: 'sign', contentHash: 'hash-1', declaration: RESEARCHER, role: 'projectRequester' });
  assert.equal(signed.status, 200);
  const plan = json(signed).plan;
  assert.equal(plan.status, 'awaitingCounterparty');
  assert.equal(plan.signatures.leadResearcher.revision, 1, 'signed as the link says, not as the body asked');
  assert.equal(plan.signatures.projectRequester, null);
  assert.equal(json(signed).role, 'leadResearcher');

  // And the other person's link signs as them.
  const theirSignature = await post(server, { id, token: theirs, version: plan.version, transition: 'sign', revision: 1, declaration: REQUESTER });
  assert.equal(theirSignature.status, 200);
  assert.equal(json(theirSignature).plan.status, 'approved');
  assert.equal(W.isApproved(JSON.parse(store.files.get(id))), true);
});

test('a refusal carries the module’s own words, the version that stands, and changes nothing', async () => {
  const { server, store } = fixture();
  const { id, mine, theirs } = await created(server);
  await post(server, { id, token: mine, version: 1, transition: 'sign', contentHash: 'hash-1', declaration: RESEARCHER });
  const before = store.files.get(id);

  const stale = await post(server, { id, token: theirs, version: 1, transition: 'sign', revision: 1, declaration: REQUESTER });
  assert.equal(stale.status, 409, 'two people at once is a conflict, not a failure');
  assert.equal(json(stale).code, 'version-conflict');
  assert.equal(json(stale).error, 'This plan changed while you were working on it. Refresh the page and try again.');
  assert.equal(json(stale).version, 2, 'and it says which version stands');

  const outOfTurn = await post(server, { id, token: mine, version: 2, transition: 'requestChanges', revision: 1, note: 'Hmm.' });
  assert.equal(outOfTurn.status, 403);
  assert.equal(json(outOfTurn).code, 'not-counterparty');

  const older = await post(server, { id, token: theirs, version: 2, transition: 'sign', revision: 99, declaration: REQUESTER });
  assert.equal(json(older).code, 'stale-revision');
  assert.equal(json(older).revision, 1, 'and which revision stands');
  assert.equal(store.files.get(id), before, 'none of them wrote anything');
});

test('an edit that says nothing is not written, and one that says something is', async () => {
  const { server, store } = fixture();
  const { id, mine } = await created(server);
  const sent = json(await post(server, { id, token: mine, version: 1, transition: 'sign', contentHash: 'hash-1', declaration: RESEARCHER })).plan;
  const before = store.files.get(id);

  const same = await post(server, { id, token: mine, version: sent.version, transition: 'edit', contentHash: 'hash-1' });
  assert.equal(same.status, 200);
  assert.equal(json(same).unchanged, true);
  assert.equal(store.files.get(id), before, 'the same hash twice writes nothing at all');

  const moved = await post(server, { id, token: mine, version: sent.version, transition: 'edit', contentHash: 'hash-2' });
  assert.equal(json(moved).plan.status, 'draft', 'and a real change says the plan has moved');
  assert.notEqual(store.files.get(id), before);
});

test('reading a plan needs a link, and shows the links the reader is allowed to have', async () => {
  const { server } = fixture();
  const { id, mine, theirs } = await created(server);

  const asAuthor = json(await read(server, 'id=' + id + '&as=' + mine));
  assert.equal(asAuthor.role, 'leadResearcher');
  assert.equal(asAuthor.plan.parties.leadResearcher.token, mine);
  assert.equal(asAuthor.plan.parties.projectRequester.token, theirs, 'the author holds the link to send');
  assert.ok(Array.isArray(asAuthor.plan.history), 'and the ledger reads too');

  const asOther = json(await read(server, 'id=' + id + '&as=' + theirs));
  assert.equal(asOther.role, 'projectRequester');
  assert.equal(asOther.plan.parties.projectRequester.token, theirs);
  assert.equal(asOther.plan.parties.leadResearcher.token, null, 'a link is a capability, and not theirs to hold');

  assert.equal((await read(server, 'id=' + id)).status, 400, 'a plan cannot be read without one');
  assert.equal((await read(server, 'as=' + mine)).status, 400);
});

test('a bad link says exactly what went wrong: no such plan, a link the plan does not know, and a withdrawn link each answer in their own words', async () => {
  // Gus's decision of 16 September 2026: plain answers over hiding which
  // plans exist. A plan address is 32 random hex characters and cannot be
  // guessed, so saying "no plan here" gives nothing away.
  const { server } = fixture();
  const { id, mine } = await created(server);
  const unknownPlan = await read(server, 'id=' + 'f'.repeat(32) + '&as=' + mine);
  assert.equal(unknownPlan.status, 404);
  assert.deepEqual(json(unknownPlan), { error: 'There is no plan at this address.', code: 'no-plan' });

  const unknownLink = await read(server, 'id=' + id + '&as=' + 'f'.repeat(48));
  assert.equal(unknownLink.status, 404);
  assert.deepEqual(json(unknownLink), { error: 'This link is not one this plan recognises.', code: 'unknown-link' });

  const withdrawn = await post(server, { id, token: mine, version: 1, transition: 'revokeLink', forRole: 'projectRequester' });
  assert.equal(withdrawn.status, 200);
  const gone = json(withdrawn).plan.parties.projectRequester;
  assert.ok(gone.revokedAt, 'the link is withdrawn on the record');
  const tried = await read(server, 'id=' + id + '&as=' + gone.token);
  assert.equal(tried.status, 410, 'a withdrawn link is gone, in HTTP\u2019s own word: it once worked and now does not');
  assert.deepEqual(json(tried), { error: 'This link was withdrawn. Ask the plan\u2019s author for a new one.', code: 'link-withdrawn' });
  const triedToAct = await post(server, { id, token: gone.token, version: 2, transition: 'sign', revision: 1, declaration: 'I confirm.' });
  assert.equal(triedToAct.status, 410, 'and it cannot act, with the same answer');
  assert.equal(json(triedToAct).code, 'link-withdrawn');

  const fresh = await post(server, { id, token: mine, version: 2, transition: 'issueLink', forRole: 'projectRequester' });
  const next = json(fresh).plan.parties.projectRequester.token;
  assert.notEqual(next, gone.token, 'the server mints the new one; a request cannot choose it');
  assert.equal((await read(server, 'id=' + id + '&as=' + next)).status, 200);
});

test('nothing from a request reaches the record unchecked', async () => {
  const { server, store } = fixture();
  const { id, mine } = await created(server);
  const kept = store.files.size;
  assert.equal((await post(server, 'not json')).status, 400);
  assert.equal((await post(server, '[]')).status, 400);
  assert.equal(json(await post(server, { id, token: mine, version: 1, transition: 'vanish' })).code, 'unknown-transition');
  assert.equal((await post(server, { transition: 'sign', version: 1 })).status, 400, 'a plan and a link are needed to change one');
  assert.equal((await server.request('/api/sign-off', 'GET')).status, 405, 'and each address takes the one method');
  assert.equal((await server.request('/api/sign-off/read', 'POST', '{}')).status, 405);

  const big = 'x'.repeat(300 * 1024);
  const tooLarge = await server.request('/api/sign-off', 'POST', JSON.stringify({ id, token: mine, version: 1, transition: 'sign', declaration: big, contentHash: 'h' }), { 'content-length': String(400 * 1024) });
  assert.equal(tooLarge.status, 413);
  assert.equal(store.files.size, kept, 'and none of it was kept');
});

// ---------- the store the routes write to (the core of RPA-136) ----------
test('a plan is written whole or not at all, and a failed write leaves the one before it', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpa-138-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createPlanStore({ dir });
  assert.equal(await store.read('nothing-here'), null, 'a plan that was never written reads as nothing');

  const plan = W.createPlan({ id: 'plan-1', at: 'day-1', authorRole: 'leadResearcher', parties: PARTIES, tokens: { leadResearcher: 'a', projectRequester: 'b' } }).plan;
  await store.write('plan-1', plan);
  assert.deepEqual(await store.read('plan-1'), plan);
  assert.deepEqual(fs.readdirSync(dir), ['plan-1.json'], 'and nothing is left lying beside it');

  const signed = W.apply(plan, { transition: 'sign', role: 'leadResearcher', at: 'day-2', version: 1, contentHash: 'h1', declaration: RESEARCHER }).plan;
  await store.write('plan-1', signed);
  assert.equal((await store.read('plan-1')).version, 2, 'a second write replaces the first');

  await assert.rejects(store.write('../escape', plan), /Invalid plan id/, 'an id cannot walk out of the directory');
  await assert.rejects(store.read('plan 1'), /Invalid plan id/);
  await assert.rejects(store.write('plan-1', { huge: 'x'.repeat(600 * 1024) }), /too large/);
  assert.equal((await store.read('plan-1')).version, 2, 'and a refused write leaves what was there');
  assert.equal(fs.readdirSync(dir).length, 1, 'with no half-written file beside it');
});
