(function exposePlanWorkflow(root, factory) {
  const workflow = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = workflow;
  } else {
    root.RPA_PLAN_WORKFLOW = workflow;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // RPA-135. Two people sign a plan, one at a time. Whoever wrote it signs
  // first and sends a link to the other, who either signs or asks for
  // changes. The plan is approved only when both signatures name the
  // latest revision and no change request is open on it.
  //
  // This is Option A of the three weighed on 15 September 2026: an explicit
  // status, transitions guarded in one table, signatures bound to a
  // revision, and an append-only ledger of every transition in the same
  // record. Two borrowings. From the event-log option, the discipline that
  // the ledger is append-only and every accepted transition writes to it,
  // so the audit is written as the state changes rather than reconstructed
  // afterwards. From the flags option, the shape of the line a plan prints:
  // "Signed by Priya Nair on 3 October 2026, revision 3".
  //
  // Pure: no storage, no HTTP, no clock, no randomness. The caller supplies
  // the id, the time and the content hash; every function returns a new
  // record and never touches the one it was given. That is what lets every
  // rule in the epic be tested without a server or a browser, and what lets
  // the later review pages ask the same questions without a round trip.

  const ROLES = ['leadResearcher', 'projectRequester'];
  const STATUSES = ['draft', 'awaitingCounterparty', 'changesRequested', 'approved', 'withdrawn'];
  const TRANSITIONS = ['sign', 'requestChanges', 'edit', 'reopen', 'withdraw'];

  // Every refusal is written for a person, in the form's own voice, ready
  // for the error summary (RPA-102). A code travels with it for the routes.
  const MESSAGES = {
    'version-conflict': 'This plan changed while you were working on it. Refresh the page and try again.',
    'unknown-role': 'Choose whether you are the lead researcher or the project requester.',
    'unknown-transition': 'That action is not one this plan accepts.',
    'missing-party': 'Enter an email address for both people.',
    'same-person': 'Enter a different email address for the other person. One person cannot sign for both.',
    'missing-hash': 'The plan could not be prepared for signing. Try again.',
    'missing-declaration': 'Confirm the declaration before signing.',
    'empty-note': 'Enter what needs to change.',
    'stale-revision': 'This plan changed since it was sent to you. Read it again before signing.',
    'nothing-changed': 'You have already signed this version, and nothing has changed since.',
    'not-author': 'Only the person who wrote this plan can do that.',
    'not-counterparty': 'Only the other person can do that.',
    'already-approved': 'This plan is approved. Reopen it before making changes.',
    'not-approved': 'This plan is not approved, so there is nothing to reopen.',
    'withdrawn': 'This plan has been withdrawn.',
    'not-awaiting': 'This plan is not waiting for your sign-off.',
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fail = (code, extra) => Object.assign({ ok: false, code, message: MESSAGES[code] || 'That cannot be done.' }, extra || {});
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const isRole = (role) => ROLES.indexOf(role) !== -1;

  function otherRole(role) { return role === 'leadResearcher' ? 'projectRequester' : 'leadResearcher'; }
  function counterpartyRole(plan) { return otherRole(plan.authorRole); }
  function currentRevision(plan) { return plan.revisions.length ? plan.revisions[plan.revisions.length - 1] : null; }
  function currentRevisionNumber(plan) { const r = currentRevision(plan); return r ? r.number : 0; }
  function currentRevisionHash(plan) { const r = currentRevision(plan); return r ? r.contentHash : null; }

  // What the author's copy hashes to right now: the hash they last reported
  // through an edit, or the signed revision's when they have not diverged.
  function effectiveHash(plan) { return plan.workingHash === null ? currentRevisionHash(plan) : plan.workingHash; }
  function signedCurrent(plan, role) {
    const signature = plan.signatures[role];
    return Boolean(signature) && signature.revision === currentRevisionNumber(plan) && currentRevisionNumber(plan) > 0;
  }

  // The one definition of done, asked rather than stored, so it cannot
  // disagree with the signatures it is about.
  function isApproved(plan) {
    return ROLES.every((role) => signedCurrent(plan, role)) && plan.changeRequest === null;
  }

  // The author may sign unless they have already signed this very revision
  // with nothing changed since and no request of the other person waiting to
  // be answered. Signing after a reopen is allowed with nothing changed:
  // the signatures were cleared, so there is something to say again.
  function authorMaySign(plan) {
    if (plan.status === 'approved' || plan.status === 'withdrawn') return false;
    if (plan.changeRequest !== null) return true;
    if (!signedCurrent(plan, plan.authorRole)) return true;
    return effectiveHash(plan) !== currentRevisionHash(plan);
  }

  // The permissions table of the epic, as a function of the record and a
  // role. Anything it forbids, the guards below refuse; the tests hold the
  // two together. Changing the parties and managing links have no
  // transitions here yet — the links arrive with their own ticket — but
  // they are stated so the table is whole.
  function permissionsFor(plan, role) {
    const author = role === plan.authorRole;
    const live = plan.status !== 'withdrawn';
    return {
      canEdit: author && live && plan.status !== 'approved',
      canSign: author ? authorMaySign(plan) : plan.status === 'awaitingCounterparty',
      canRequestChanges: !author && plan.status === 'awaitingCounterparty',
      canChangeParties: author && plan.status === 'draft' && !ROLES.some((r) => signedCurrent(plan, r)),
      canManageLinks: author && live,
      canReopen: plan.status === 'approved',
      canWithdraw: author && live && plan.status !== 'approved',
      canReadHistory: true,
    };
  }

  function entry(plan, action, extra) {
    return Object.assign({
      at: action.at,
      transition: action.transition,
      role: action.role,
      email: plan.parties[action.role] ? plan.parties[action.role].email : '',
    }, extra);
  }

  function createPlan(options) {
    const parties = options.parties || {};
    if (!isRole(options.authorRole)) return fail('unknown-role');
    const emails = {};
    for (const role of ROLES) {
      const party = parties[role] || {};
      const email = text(party.email);
      if (!email) return fail('missing-party');
      emails[role] = email;
    }
    if (emails.leadResearcher.toLowerCase() === emails.projectRequester.toLowerCase()) return fail('same-person');
    const plan = {
      id: options.id,
      version: 1,
      status: 'draft',
      createdAt: options.at,
      authorRole: options.authorRole,
      parties: {
        leadResearcher: { email: emails.leadResearcher, displayName: text((parties.leadResearcher || {}).displayName) },
        projectRequester: { email: emails.projectRequester, displayName: text((parties.projectRequester || {}).displayName) },
      },
      revisions: [],
      workingHash: null,
      signatures: { leadResearcher: null, projectRequester: null },
      changeRequest: null,
      history: [{ at: options.at, transition: 'create', role: options.authorRole, email: emails[options.authorRole], from: null, to: 'draft' }],
    };
    return { ok: true, plan };
  }

  // Every transition goes through here. A refusal changes nothing at all,
  // the ledger included; an acceptance bumps the version and appends one
  // entry. The version the caller read is checked first, so two people
  // acting at the same moment cannot both win.
  function apply(plan, action) {
    if (TRANSITIONS.indexOf(action.transition) === -1) return fail('unknown-transition');
    if (!isRole(action.role)) return fail('unknown-role');
    if (action.version !== plan.version) return fail('version-conflict', { version: plan.version });
    if (plan.status === 'withdrawn') return fail('withdrawn');

    const author = action.role === plan.authorRole;
    const next = clone(plan);
    const from = plan.status;
    let record;

    if (action.transition === 'sign') {
      const declaration = text(action.declaration);
      if (!declaration) return fail('missing-declaration');
      if (author) {
        if (plan.status === 'approved') return fail('already-approved');
        const hash = text(action.contentHash);
        if (!hash) return fail('missing-hash');
        if (!authorMaySign(plan)) return fail('nothing-changed');
        // A revision is minted only when the content differs from the one
        // that stands. Answering a change request or a reopen without
        // editing signs the revision already there, which is the honest
        // record of what happened.
        if (hash !== currentRevisionHash(plan)) {
          next.revisions.push({ number: currentRevisionNumber(plan) + 1, contentHash: hash, mintedAt: action.at });
        }
        next.workingHash = null;
        next.changeRequest = null;
        next.signatures[action.role] = { revision: currentRevisionNumber(next), at: action.at, declaration };
        next.status = 'awaitingCounterparty';
        record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(next), hash: currentRevisionHash(next) });
      } else {
        if (plan.status !== 'awaitingCounterparty') return fail('not-awaiting');
        if (action.revision !== currentRevisionNumber(plan)) return fail('stale-revision', { revision: currentRevisionNumber(plan) });
        next.signatures[action.role] = { revision: currentRevisionNumber(plan), at: action.at, declaration };
        next.status = 'approved';
        record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(plan), hash: currentRevisionHash(plan) });
      }
    } else if (action.transition === 'requestChanges') {
      if (author) return fail('not-counterparty');
      if (plan.status !== 'awaitingCounterparty') return fail('not-awaiting');
      const note = text(action.note);
      if (!note) return fail('empty-note');
      if (action.revision !== currentRevisionNumber(plan)) return fail('stale-revision', { revision: currentRevisionNumber(plan) });
      next.changeRequest = { by: action.role, revision: currentRevisionNumber(plan), note, at: action.at };
      next.status = 'changesRequested';
      record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(plan), note });
    } else if (action.transition === 'edit') {
      if (!author) return fail('not-author');
      if (plan.status === 'approved') return fail('already-approved');
      const hash = text(action.contentHash);
      if (!hash) return fail('missing-hash');
      // Reporting the hash the plan already stands at says nothing, so it
      // writes nothing: no version, no ledger entry. Typing something and
      // undoing it is two reports, and the second puts the plan back where
      // it was, signatures intact, because no revision was ever minted.
      if (hash === effectiveHash(plan)) return { ok: true, plan, unchanged: true };
      next.workingHash = hash === currentRevisionHash(plan) ? null : hash;
      if (plan.status !== 'changesRequested') {
        next.status = next.workingHash === null && signedCurrent(next, next.authorRole) ? 'awaitingCounterparty' : 'draft';
      }
      record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(plan), hash });
    } else if (action.transition === 'reopen') {
      if (plan.status !== 'approved') return fail('not-approved');
      // The signatures go, the ledger keeps them. Approval never quietly
      // evaporates: losing it is an act, and this is the act.
      next.signatures = { leadResearcher: null, projectRequester: null };
      next.status = 'draft';
      record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(plan) });
    } else {
      if (!author) return fail('not-author');
      if (plan.status === 'approved') return fail('already-approved');
      next.status = 'withdrawn';
      record = entry(plan, action, { from, to: next.status, revision: currentRevisionNumber(plan) });
    }

    next.version = plan.version + 1;
    next.history.push(record);
    return { ok: true, plan: next };
  }

  return {
    ROLES, STATUSES, TRANSITIONS, MESSAGES,
    createPlan, apply, permissionsFor, isApproved,
    otherRole, counterpartyRole, currentRevision, currentRevisionNumber, signedCurrent,
  };
});
