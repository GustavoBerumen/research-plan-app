'use strict';

// RPA-135. Two people sign a plan, one at a time: whoever wrote it signs
// first and sends a link to the other, who either signs or asks for
// changes. Approved means both signatures name the latest revision with no
// change request open on it. Option A of the three weighed on 15 September
// 2026: an explicit status, guards in one table, signatures bound to a
// revision, and an append-only ledger in the same record. Pure functions,
// so every rule is tested here without a server, a browser or a file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('../plan-workflow');

const SOURCE = path.join(__dirname, '..', 'plan-workflow.js');
const RESEARCHER = 'I confirm this plan is complete and current, and I will conduct the research as it describes.';
const REQUESTER = 'I confirm this plan meets the needs of the project I am responsible for, and I approve it.';

const parties = {
  leadResearcher: { email: 'priya@example.com', displayName: 'Priya Nair' },
  projectRequester: { email: 'tom@example.com', displayName: 'Tom Okafor' },
};
function fresh(authorRole = 'leadResearcher') {
  const result = W.createPlan({ id: 'plan-1', at: '2026-10-01T09:00:00Z', authorRole, parties });
  assert.equal(result.ok, true);
  return result.plan;
}
// Applies a transition that is expected to succeed, keeping the version in
// step the way a caller who read the record would.
function ok(plan, action) {
  const result = W.apply(plan, Object.assign({ version: plan.version }, action));
  assert.equal(result.ok, true, result.message || action.transition);
  return result.plan;
}
function no(plan, action) {
  const result = W.apply(plan, Object.assign({ version: plan.version }, action));
  assert.equal(result.ok, false, action.transition + ' should have been refused');
  return result;
}
const authorSign = (plan, hash, at = 'a1') => ok(plan, { transition: 'sign', role: plan.authorRole, at, contentHash: hash, declaration: RESEARCHER });
const otherSign = (plan, at = 'c1') => ok(plan, { transition: 'sign', role: W.counterpartyRole(plan), at, revision: W.currentRevisionNumber(plan), declaration: REQUESTER });
const requestChanges = (plan, note, at = 'c2') => ok(plan, { transition: 'requestChanges', role: W.counterpartyRole(plan), at, revision: W.currentRevisionNumber(plan), note });
const edit = (plan, hash, at = 'e1') => ok(plan, { transition: 'edit', role: plan.authorRole, at, contentHash: hash });

test('the happy path: the author signs and sends, the other signs, and the plan is approved on the same revision', () => {
  const created = fresh();
  assert.equal(created.status, 'draft');
  assert.equal(created.version, 1);
  assert.deepEqual(created.revisions, [], 'the working copy is not a revision until it is signed');
  assert.equal(W.isApproved(created), false);

  const sent = authorSign(created, 'hash-1');
  assert.equal(sent.status, 'awaitingCounterparty');
  assert.equal(W.currentRevisionNumber(sent), 1, 'signing minted revision 1');
  assert.deepEqual(sent.revisions[0], { number: 1, contentHash: 'hash-1', mintedAt: 'a1' });
  assert.deepEqual(sent.signatures.leadResearcher, { revision: 1, at: 'a1', declaration: RESEARCHER });
  assert.equal(sent.signatures.projectRequester, null);
  assert.equal(W.isApproved(sent), false, 'one signature is not approval');

  const done = otherSign(sent);
  assert.equal(done.status, 'approved');
  assert.equal(W.isApproved(done), true);
  assert.equal(done.signatures.projectRequester.revision, 1, 'both signatures name the same revision');
  assert.equal(done.signatures.projectRequester.declaration, REQUESTER, 'the wording as shown is stored with the signature');
  assert.equal(done.version, 3, 'one bump per accepted transition');
});

test('either role can be the author, and the counterparty is whoever is left', () => {
  const byRequester = fresh('projectRequester');
  assert.equal(W.counterpartyRole(byRequester), 'leadResearcher');
  const approved = otherSign(authorSign(byRequester, 'hash-1'));
  assert.equal(approved.status, 'approved');
  assert.equal(approved.signatures.projectRequester.revision, 1, 'the author signed first');
  assert.equal(approved.signatures.leadResearcher.revision, 1);
});

test('the change-request loop: the request comes back, the author edits and signs revision 2, and only then can it be approved', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const returned = requestChanges(sent, 'The sample size does not match the questions.');
  assert.equal(returned.status, 'changesRequested');
  assert.deepEqual(returned.changeRequest, { by: 'projectRequester', revision: 1, note: 'The sample size does not match the questions.', at: 'c2' });
  assert.equal(W.isApproved(returned), false);

  const edited = edit(returned, 'hash-2');
  assert.equal(edited.status, 'changesRequested', 'the request stays open until the author signs');
  const resent = authorSign(edited, 'hash-2', 'a2');
  assert.equal(resent.status, 'awaitingCounterparty');
  assert.equal(W.currentRevisionNumber(resent), 2, 'the edit made a new revision when it was signed');
  assert.equal(resent.changeRequest, null, 'signing answers the request');
  assert.equal(resent.signatures.leadResearcher.revision, 2);

  assert.equal(W.isApproved(otherSign(resent)), true);
});

test('a signature names a revision and never moves to a later one', () => {
  const approved = otherSign(authorSign(fresh(), 'hash-1'));
  const reopened = ok(approved, { transition: 'reopen', role: 'leadResearcher', at: 'r1' });
  const edited = edit(reopened, 'hash-2');
  const resent = authorSign(edited, 'hash-2', 'a2');
  assert.equal(W.currentRevisionNumber(resent), 2);
  assert.equal(resent.signatures.projectRequester, null, 'the other signature did not follow the plan to revision 2');
  assert.equal(W.isApproved(resent), false, 'approval needs both signatures on the revision that stands');
});

test('an edit reported twice says nothing the second time: no version, no ledger entry', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const again = W.apply(sent, { transition: 'edit', role: 'leadResearcher', at: 'e1', version: sent.version, contentHash: 'hash-1' });
  assert.equal(again.ok, true);
  assert.equal(again.unchanged, true);
  assert.equal(again.plan, sent, 'the very same record comes back');
  assert.equal(again.plan.version, sent.version, 'nothing to record, nothing to bump');
  assert.equal(again.plan.history.length, sent.history.length);
});

test('typing something and undoing it puts the plan back, signatures intact: the hash is what counts, not that an edit happened', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const away = edit(sent, 'hash-2');
  assert.equal(away.status, 'draft', 'the plan no longer matches what was sent');
  assert.equal(away.workingHash, 'hash-2');
  assert.equal(away.signatures.leadResearcher.revision, 1, 'the signature is untouched: no revision was minted by editing');

  const back = edit(away, 'hash-1', 'e2');
  assert.equal(back.status, 'awaitingCounterparty', 'the plan matches the signed revision again');
  assert.equal(back.workingHash, null);
  assert.equal(W.currentRevisionNumber(back), 1, 'and still one revision');
  assert.equal(W.isApproved(otherSign(back)), true, 'so the other person can still sign it');
  assert.deepEqual(back.history.slice(-2).map((h) => h.to), ['draft', 'awaitingCounterparty'], 'the ledger tells the whole story, both ways');
});

test('signing again with nothing changed is refused; after a change request or a reopen it is allowed and mints no revision', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const refused = no(sent, { transition: 'sign', role: 'leadResearcher', at: 'a2', contentHash: 'hash-1', declaration: RESEARCHER });
  assert.equal(refused.code, 'nothing-changed');
  assert.equal(refused.message, 'You have already signed this version, and nothing has changed since.');

  const answered = authorSign(requestChanges(sent, 'Please reconsider the dates.'), 'hash-1', 'a3');
  assert.equal(answered.status, 'awaitingCounterparty');
  assert.equal(W.currentRevisionNumber(answered), 1, 'answering without editing signs the revision that stands');
  assert.equal(answered.changeRequest, null);

  const reopened = ok(otherSign(answered), { transition: 'reopen', role: 'projectRequester', at: 'r1' });
  const resigned = authorSign(reopened, 'hash-1', 'a4');
  assert.equal(resigned.status, 'awaitingCounterparty', 'a reopened plan can be signed again unchanged');
  assert.equal(W.currentRevisionNumber(resigned), 1);
});

test('an approved plan is locked: editing is refused and reopening is the only way, which clears both signatures', () => {
  const approved = otherSign(authorSign(fresh(), 'hash-1'));
  for (const action of [
    { transition: 'edit', role: 'leadResearcher', at: 'x', contentHash: 'hash-2' },
    { transition: 'sign', role: 'leadResearcher', at: 'x', contentHash: 'hash-2', declaration: RESEARCHER },
    { transition: 'withdraw', role: 'leadResearcher', at: 'x' },
  ]) assert.equal(no(approved, action).code, 'already-approved', action.transition);

  const reopened = ok(approved, { transition: 'reopen', role: 'projectRequester', at: 'r1' });
  assert.equal(reopened.status, 'draft');
  assert.deepEqual(reopened.signatures, { leadResearcher: null, projectRequester: null }, 'approval does not quietly survive');
  assert.equal(W.isApproved(reopened), false);
  assert.equal(reopened.history.filter((h) => h.transition === 'sign').length, 2, 'the signatures stay in the ledger');
  assert.equal(no(reopened, { transition: 'reopen', role: 'leadResearcher', at: 'r2' }).code, 'not-approved');
});

test('one at a time: the counterparty cannot edit, the author cannot request changes, and nobody signs out of turn', () => {
  const draft = fresh();
  assert.equal(no(draft, { transition: 'edit', role: 'projectRequester', at: 'x', contentHash: 'hash-2' }).code, 'not-author');
  assert.equal(no(draft, { transition: 'withdraw', role: 'projectRequester', at: 'x' }).code, 'not-author');
  assert.equal(no(draft, { transition: 'sign', role: 'projectRequester', at: 'x', revision: 0, declaration: REQUESTER }).code, 'not-awaiting',
    'the other person cannot sign a plan its author has not sent');

  const sent = authorSign(draft, 'hash-1');
  assert.equal(no(sent, { transition: 'requestChanges', role: 'leadResearcher', at: 'x', revision: 1, note: 'Hmm.' }).code, 'not-counterparty');

  const returned = requestChanges(sent, 'Please change the goal.');
  assert.equal(no(returned, { transition: 'sign', role: 'projectRequester', at: 'x', revision: 1, declaration: REQUESTER }).code, 'not-awaiting',
    'the plan is back with its author, so it is not the other person\'s turn');
  assert.equal(no(returned, { transition: 'requestChanges', role: 'projectRequester', at: 'x', revision: 1, note: 'And the dates.' }).code, 'not-awaiting');
});

test('a sign-off or a request naming an older revision is refused, and says which revision stands', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const resent = authorSign(edit(sent, 'hash-2'), 'hash-2', 'a2');
  assert.equal(W.currentRevisionNumber(resent), 2);
  for (const action of [
    { transition: 'sign', role: 'projectRequester', at: 'x', revision: 1, declaration: REQUESTER },
    { transition: 'requestChanges', role: 'projectRequester', at: 'x', revision: 1, note: 'Too long.' },
  ]) {
    const refused = no(resent, action);
    assert.equal(refused.code, 'stale-revision', action.transition);
    assert.equal(refused.revision, 2, 'it names the revision that stands');
    assert.equal(refused.message, 'This plan changed since it was sent to you. Read it again before signing.');
  }
});

test('two people acting at the same moment: the second write is refused as a conflict and names the version it found', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const won = otherSign(sent);
  const lost = W.apply(sent, { transition: 'requestChanges', role: 'projectRequester', at: 'x', version: sent.version, revision: 1, note: 'Wait.' });
  assert.equal(won.version, sent.version + 1);
  const stale = W.apply(won, { transition: 'requestChanges', role: 'projectRequester', at: 'x', version: sent.version, revision: 1, note: 'Wait.' });
  assert.equal(lost.ok, true, 'the first write against the version it read succeeds');
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'version-conflict');
  assert.equal(stale.version, won.version, 'and hands back the version that stands');
  assert.equal(stale.message, 'This plan changed while you were working on it. Refresh the page and try again.');
});

test('withdrawing ends it: nothing is accepted afterwards', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const gone = ok(sent, { transition: 'withdraw', role: 'leadResearcher', at: 'w1' });
  assert.equal(gone.status, 'withdrawn');
  for (const action of [
    { transition: 'sign', role: 'projectRequester', at: 'x', revision: 1, declaration: REQUESTER },
    { transition: 'edit', role: 'leadResearcher', at: 'x', contentHash: 'hash-2' },
    { transition: 'reopen', role: 'leadResearcher', at: 'x' },
    { transition: 'withdraw', role: 'leadResearcher', at: 'x' },
  ]) assert.equal(no(gone, action).code, 'withdrawn', action.transition);
});

test('a plan cannot be created for one person wearing both hats, or without both addresses, or without a role', () => {
  const same = W.createPlan({ id: 'p', at: 't', authorRole: 'leadResearcher', parties: { leadResearcher: { email: ' Priya@Example.com ' }, projectRequester: { email: 'priya@example.com' } } });
  assert.equal(same.ok, false);
  assert.equal(same.code, 'same-person', 'the same address in either case is the same person');
  assert.equal(same.message, 'Enter a different email address for the other person. One person cannot sign for both.');
  assert.equal(W.createPlan({ id: 'p', at: 't', authorRole: 'leadResearcher', parties: { leadResearcher: { email: 'a@x.com' }, projectRequester: {} } }).code, 'missing-party');
  assert.equal(W.createPlan({ id: 'p', at: 't', authorRole: 'both', parties }).code, 'unknown-role');
  const created = W.createPlan({ id: 'p', at: 't', authorRole: 'leadResearcher', parties: { leadResearcher: { email: '  priya@example.com  ' }, projectRequester: { email: 'tom@example.com' } } });
  assert.equal(created.plan.parties.leadResearcher.email, 'priya@example.com', 'addresses are trimmed');
});

test('signing needs the declaration, and the author needs content to sign', () => {
  const draft = fresh();
  assert.equal(no(draft, { transition: 'sign', role: 'leadResearcher', at: 'x', contentHash: 'hash-1', declaration: '   ' }).code, 'missing-declaration');
  assert.equal(no(draft, { transition: 'sign', role: 'leadResearcher', at: 'x', declaration: RESEARCHER }).code, 'missing-hash');
  const sent = authorSign(draft, 'hash-1');
  assert.equal(no(sent, { transition: 'requestChanges', role: 'projectRequester', at: 'x', revision: 1, note: '  ' }).code, 'empty-note');
  assert.equal(no(sent, { transition: 'approve', role: 'projectRequester', at: 'x' }).code, 'unknown-transition');
  assert.equal(no(sent, { transition: 'sign', role: 'nobody', at: 'x', declaration: RESEARCHER }).code, 'unknown-role');
});

// The permissions table of the epic, held against the guards: anything the
// table forbids, the transition refuses. One plan per state, both roles.
test('the permissions table and the guards agree, in every state and for both roles', () => {
  const draft = fresh();
  const sent = authorSign(draft, 'hash-1');
  const plans = {
    draft,
    draftAfterEdit: edit(sent, 'hash-2'),
    awaitingCounterparty: sent,
    changesRequested: requestChanges(sent, 'Please change the goal.'),
    approved: otherSign(sent),
    withdrawn: ok(draft, { transition: 'withdraw', role: 'leadResearcher', at: 'w' }),
  };
  plans.draftAfterReopen = ok(plans.approved, { transition: 'reopen', role: 'leadResearcher', at: 'r' });
  const actionFor = (plan, role, transition) => ({
    transition, role, at: 'x', version: plan.version,
    contentHash: 'hash-9', declaration: role === 'leadResearcher' ? RESEARCHER : REQUESTER,
    note: 'Please change the goal.', revision: W.currentRevisionNumber(plan),
  });
  const pairs = [['canEdit', 'edit'], ['canSign', 'sign'], ['canRequestChanges', 'requestChanges'], ['canReopen', 'reopen'], ['canWithdraw', 'withdraw']];
  for (const [name, plan] of Object.entries(plans)) {
    for (const role of W.ROLES) {
      const allowed = W.permissionsFor(plan, role);
      for (const [permission, transition] of pairs) {
        const result = W.apply(plan, actionFor(plan, role, transition));
        const where = name + '/' + role + '/' + transition;
        if (!allowed[permission]) assert.equal(result.ok, false, where + ' is forbidden by the table, so it must be refused');
        // The other direction is not a promise the table makes: signing is
        // permitted for the author of an awaiting plan, yet refused until
        // the author reports an edit, because the record, not the request,
        // says whether anything changed.
        if (result.ok && !result.unchanged) assert.equal(allowed[permission], true, where + ' succeeded, so the table must allow it');
      }
      assert.equal(allowed.canReadHistory, true, name + '/' + role + ': both parties can always read the ledger');
    }
  }
  assert.equal(W.permissionsFor(plans.draft, 'leadResearcher').canChangeParties, true, 'the parties can be changed while nothing is signed');
  assert.equal(W.permissionsFor(plans.awaitingCounterparty, 'leadResearcher').canChangeParties, false, 'and not once a signature stands');
  assert.equal(W.permissionsFor(plans.withdrawn, 'leadResearcher').canManageLinks, false, 'a withdrawn plan has no links to manage');
});

test('the ledger only ever grows: one entry per accepted transition, none for a refusal, and earlier entries never change', () => {
  const draft = fresh();
  assert.deepEqual(draft.history, [{ at: '2026-10-01T09:00:00Z', transition: 'create', role: 'leadResearcher', email: 'priya@example.com', from: null, to: 'draft' }]);

  const steps = [];
  let plan = draft;
  const step = (action) => { const before = plan; plan = ok(before, action); steps.push({ before, after: plan }); };
  step({ transition: 'sign', role: 'leadResearcher', at: 'a1', contentHash: 'hash-1', declaration: RESEARCHER });
  step({ transition: 'requestChanges', role: 'projectRequester', at: 'c1', revision: 1, note: 'The sample size is too small.' });
  step({ transition: 'edit', role: 'leadResearcher', at: 'e1', contentHash: 'hash-2' });
  step({ transition: 'sign', role: 'leadResearcher', at: 'a2', contentHash: 'hash-2', declaration: RESEARCHER });
  step({ transition: 'sign', role: 'projectRequester', at: 'c2', revision: 2, declaration: REQUESTER });

  for (const { before, after } of steps) {
    assert.equal(after.history.length, before.history.length + 1, 'exactly one entry per transition');
    assert.deepEqual(after.history.slice(0, before.history.length), before.history, 'and nothing before it is touched');
  }
  assert.deepEqual(plan.history.map((h) => h.transition), ['create', 'sign', 'requestChanges', 'edit', 'sign', 'sign']);
  assert.deepEqual(plan.history.map((h) => h.to), ['draft', 'awaitingCounterparty', 'changesRequested', 'changesRequested', 'awaitingCounterparty', 'approved']);
  assert.deepEqual(plan.history.map((h) => h.role), ['leadResearcher', 'leadResearcher', 'projectRequester', 'leadResearcher', 'leadResearcher', 'projectRequester']);
  assert.equal(plan.history[2].note, 'The sample size is too small.', 'what was asked for is on the record');
  assert.deepEqual(plan.history[1], { at: 'a1', transition: 'sign', role: 'leadResearcher', email: 'priya@example.com', from: 'draft', to: 'awaitingCounterparty', revision: 1, hash: 'hash-1' },
    'who, when, from where to where, and on which revision');

  const refused = W.apply(plan, { transition: 'edit', role: 'leadResearcher', at: 'x', version: plan.version, contentHash: 'hash-3' });
  assert.equal(refused.ok, false);
  assert.equal(plan.history.length, 6, 'a refusal writes nothing');
});

// isApproved and signedCurrent are the definition of done, and they are
// exported: the store and the routes that follow will ask them about
// records read from a file, which the transitions here did not build. A
// record in a shape this machine cannot currently reach must still be
// judged by the rule, not by whether a signature merely exists.
test('the approval rule judges a record as it finds it, whatever shape it arrives in', () => {
  const approved = otherSign(authorSign(fresh(), 'hash-1'));
  assert.equal(W.isApproved(approved), true);

  const withRequestStillOpen = JSON.parse(JSON.stringify(approved));
  withRequestStillOpen.changeRequest = { by: 'projectRequester', revision: 1, note: 'Not yet.', at: 'c9' };
  assert.equal(W.isApproved(withRequestStillOpen), false, 'two signatures do not approve a plan with a request outstanding');

  const signedAnOlderRevision = JSON.parse(JSON.stringify(approved));
  signedAnOlderRevision.revisions.push({ number: 2, contentHash: 'hash-2', mintedAt: 'a9' });
  assert.equal(W.signedCurrent(signedAnOlderRevision, 'leadResearcher'), false, 'a signature on revision 1 is not a signature on revision 2');
  assert.equal(W.signedCurrent(signedAnOlderRevision, 'projectRequester'), false);
  assert.equal(W.isApproved(signedAnOlderRevision), false, 'a signature never follows a plan to a later revision');

  const oneSideOnly = JSON.parse(JSON.stringify(approved));
  oneSideOnly.signatures.projectRequester = null;
  assert.equal(W.isApproved(oneSideOnly), false);

  const nothingSignedYet = fresh();
  nothingSignedYet.signatures.leadResearcher = { revision: 0, at: 't', declaration: RESEARCHER };
  assert.equal(W.signedCurrent(nothingSignedYet, 'leadResearcher'), false, 'there is no revision 0 to have signed');
  assert.equal(W.isApproved(nothingSignedYet), false);
});

test('a record is never changed in place: the plan handed in comes back untouched, accepted or refused', () => {
  const sent = authorSign(fresh(), 'hash-1');
  const before = JSON.stringify(sent);
  const accepted = W.apply(sent, { transition: 'sign', role: 'projectRequester', at: 'c1', version: sent.version, revision: 1, declaration: REQUESTER });
  assert.equal(JSON.stringify(sent), before, 'an accepted transition leaves the old record alone');
  assert.notEqual(accepted.plan, sent);
  assert.notEqual(accepted.plan.history, sent.history, 'the ledger is copied, not shared');
  W.apply(sent, { transition: 'edit', role: 'projectRequester', at: 'x', version: sent.version, contentHash: 'hash-2' });
  assert.equal(JSON.stringify(sent), before, 'and so does a refused one');
});

test('every refusal carries a code and a message written for a person', () => {
  for (const [code, message] of Object.entries(W.MESSAGES)) {
    assert.equal(typeof message, 'string', code);
    assert.match(message, /^[A-Z]/, code + ': starts as a sentence');
    assert.match(message, /[.?]$/, code + ': ends as one');
    assert.doesNotMatch(message, /null|undefined|error|invalid|failed/i, code + ': no machine words');
  }
  assert.equal(W.MESSAGES['not-awaiting'], 'This plan is not waiting for your sign-off.');
});

test('it runs in a browser too, the way score-classification.js does', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), context, { filename: 'plan-workflow.js' });
  const browser = context.RPA_PLAN_WORKFLOW;
  assert.ok(browser, 'it puts itself on the page when there is no module to export to');
  // Copied into this realm before comparing: an array built inside the vm
  // has that context's own Array, which strict deepEqual counts as different.
  assert.deepEqual([...browser.ROLES], ['leadResearcher', 'projectRequester']);
  assert.deepEqual([...browser.STATUSES], ['draft', 'awaitingCounterparty', 'changesRequested', 'approved', 'withdrawn']);
  const plan = browser.createPlan({ id: 'p', at: 't', authorRole: 'projectRequester', parties }).plan;
  assert.equal(browser.counterpartyRole(plan), 'leadResearcher', 'and answers the same questions without a round trip');
});
