/* Delivery state is separate from the editable draft and downloadable backups. */
(function () {
  'use strict';
  const contract = window.RPA_SUBMISSION;
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  window.createSubmissionUI = function ({ doc, config, collect, showErrors, resetDeclarations, prepare = () => {}, isRestoring = () => false }) {
    // Keep the original browser key so an upgrade can find and retry a frozen
    // v1 request byte-for-byte. The record version distinguishes new v2 state.
    const key = 'research-plan-app:submission:v1:' + config.deployment + ':' + config.cohort;
    const root = document.createElement('section');
    root.className = 'submission-panel';
    root.setAttribute('aria-labelledby', 'submission-heading');
    const heading = document.createElement('h2');
    heading.id = 'submission-heading'; heading.textContent = 'Send your research plan';
    const notice = document.createElement('p'); notice.className = 'submission-notice'; notice.textContent = config.notice;
    const scope = document.createElement('p');
    scope.textContent = 'Send the active plan, its studies, named researchers and declarations to the organisers. Older answers that are no longer in the form stay in your browser and backup. Reference files are not sent; any saved file names or links are included. Your browser email address and draft review history are not sent. This does not send an email.';
    const status = document.createElement('p'); status.className = 'submission-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const send = document.createElement('button'); send.type = 'button'; send.className = 'btn btn-dark submission-send'; send.textContent = 'Send plan';
    root.append(heading, notice, scope, status, send);
    let record = null, blocked = false, busy = false, epoch = 0, message = '', reviewedContent = null;
    function read() {
      try {
        const raw = window.localStorage.getItem(key);
        record = raw ? JSON.parse(raw) : null;
        if (record && (![1, 2].includes(record.version) || !['pending', 'stored', 'rejected', 'deleted'].includes(record.state) ||
            !UUID.test(record.request?.submissionId || '') || typeof record.fingerprint !== 'string' ||
            !contract.structureForSchema(record.request.formSchemaVersion, record.request.plan) || !record.request.collectionPolicyVersion ||
            (record.request.formSchemaVersion === contract.SCHEMA && record.request.supersedesSubmissionId !== null && !UUID.test(record.request.supersedesSubmissionId || '')) ||
            (record.state === 'stored' && (record.receipt?.submissionId !== record.request.submissionId || !/^[a-f0-9]{64}$/.test(record.receipt?.contentSha256 || '') ||
              (record.request.formSchemaVersion === contract.SCHEMA && (record.receipt?.planId !== record.request.plan.planId || record.receipt?.formSchemaVersion !== contract.SCHEMA)))))) throw new Error('Unsupported local receipt');
        // Historical receipts and frozen retries survive stricter completion rules.
        // New/updated plans still pass current validation in submit and on the server.
        blocked = false;
      } catch (_) { blocked = true; }
    }
    function save(next) {
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      if (window.localStorage.getItem(key) !== raw) throw new Error('Retry snapshot could not be verified');
      record = next;
    }
    function currentFingerprint() { try { return contract.fingerprint(collect()); } catch (_) { return null; } }
    function reviewContent() {
      try {
        const plan = collect(); delete plan.fields.declarationResearcher; delete plan.fields.declarationRequester;
        return contract.fingerprint(plan);
      } catch (_) { return null; }
    }
    function refresh() {
      if (!root.isConnected) return;
      send.disabled = busy || blocked;
      if (busy) { send.textContent = 'Sending…'; status.textContent = 'Sending the saved snapshot. Keep this page open for the receipt.'; return; }
      if (blocked) { status.textContent = 'The saved submission state could not be read. Keep a plan backup and contact the organiser before sending.'; return; }
      const same = record && record.fingerprint === currentFingerprint();
      if (record?.state === 'pending') {
        send.textContent = 'Retry saved snapshot';
        status.textContent = message || ('Receipt unconfirmed for reference ' + record.request.submissionId + '. Retry the same saved snapshot before sending an update.' + (same ? '' : ' Your current edits are separate from that snapshot.'));
      } else if (record?.state === 'stored') {
        send.textContent = same ? 'Plan received' : record.prepared ? 'Send updated plan' : 'Prepare updated submission';
        send.disabled = same;
        status.textContent = message || ('Plan received and privately saved. Reference ' + record.receipt.submissionId + ', ' + record.receipt.submittedAt + '.' + (same ? '' : ' This receipt applies to an earlier snapshot. Your current edits have not been sent.'));
      } else {
        send.textContent = 'Send plan';
        status.textContent = message || (record?.state === 'deleted' ? 'The earlier submission was deleted. It will not be restored by retrying.' : 'Your draft stays in this browser until you send it.');
      }
    }
    async function attempt(snapshot) {
      const startedEpoch = epoch, before = currentFingerprint();
      busy = true; message = ''; refresh();
      const abort = new AbortController();
      const timer = window.setTimeout(() => abort.abort(), 30000);
      try {
        const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify(snapshot.request), signal: abort.signal });
        const body = await response.json();
        // Never accept a vague 2xx response as a durable receipt.
        const v2Receipt = snapshot.request.formSchemaVersion !== contract.SCHEMA ||
          (body.planId === snapshot.request.plan.planId && body.formSchemaVersion === contract.SCHEMA);
        if ([200, 201].includes(response.status) && body.status === 'stored' && body.submissionId === snapshot.request.submissionId && v2Receipt &&
            /^[a-f0-9]{64}$/.test(body.contentSha256 || '') && typeof body.submittedAt === 'string' && Number.isFinite(Date.parse(body.submittedAt))) {
          const completed = { ...snapshot, state: 'stored', receipt: body, prepared: false };
          try { save(completed); } catch (_) { record = completed; message = 'Plan received and privately saved. Reference ' + body.submissionId + ', ' + body.submittedAt + '. The receipt could not be saved in this browser; keep this reference. Reloading can safely retry the saved snapshot.'; }
        } else if (response.status === 422 && body.code === 'incomplete_plan') {
          save({ ...snapshot, state: 'rejected' });
          message = 'The snapshot was not stored. Check the plan before sending again.';
          if (startedEpoch === epoch && root.isConnected && before === currentFingerprint()) showErrors(contract.validate(collect()), true);
        } else if (response.status === 410 && body.code === 'submission_deleted') {
          save({ ...snapshot, state: 'deleted' });
        } else if (response.status === 409 && body.code === 'version_conflict') {
          // The old ID may already exist under an earlier policy. Keep it for reconciliation.
          message = 'The collection version has changed. Keep your draft and reference ' + snapshot.request.submissionId + ', and contact the organiser to reconcile this snapshot.';
        } else if (response.status === 409) {
          message = 'This reference could not be reconciled. Keep your draft and reference ' + snapshot.request.submissionId + ', and contact the organiser.';
        } else if (response.status === 429) {
          message = 'The saved snapshot is waiting. Wait one minute, then retry with the same reference.';
        } else if (response.status === 403 && body.code === 'collection_closed') {
          message = 'This collection is closed. Keep your draft and reference ' + snapshot.request.submissionId + ', and contact the organiser to reconcile any earlier attempt.';
        } else {
          message = 'Receipt unconfirmed. Your saved snapshot and reference are kept; retry to check whether it was received.';
        }
      } catch (_) { message = 'Receipt unconfirmed. Your saved snapshot and reference are kept; retry to check whether it was received.'; }
      finally {
        window.clearTimeout(timer); busy = false;
        if (startedEpoch !== epoch) message = (record?.state === 'stored' ? 'The earlier snapshot was received. ' : 'The earlier snapshot still needs reconciliation. ') + 'Its reference is ' + snapshot.request.submissionId + '. This does not confirm the replacement plan.';
        window.dispatchEvent(new Event('rpa-submission-state'));
        refresh();
      }
    }
    async function submit() {
      if (busy || blocked) return;
      read(); if (blocked) { refresh(); return; }
      if (record?.state === 'pending') return attempt(record);
      if (record?.state === 'stored') {
        if (record.fingerprint === currentFingerprint()) { refresh(); return; }
        if (!record.prepared) {
          try { save({ ...record, prepared: true }); } catch (_) { message = 'The review state could not be saved. Allow browser storage and try again.'; refresh(); return; }
          resetDeclarations();
          reviewedContent = reviewContent();
          message = 'Review the updated plan and confirm both declarations again.';
          showErrors(contract.validate(collect()), true); refresh(); return;
        }
      }
      let plan;
      try { prepare(); plan = collect(); } catch (_) {
        message = 'The active form has changed. Keep a backup and contact the organiser before sending.';
        showErrors([{ key: null, code: 'schema', message }], true); refresh(); return;
      }
      const errors = contract.validate(plan);
      if (errors.length) { showErrors(errors, true); return; }
      const snapshot = { version: 2, state: 'pending', fingerprint: contract.fingerprint(plan), request: {
        submissionId: window.crypto.randomUUID(), formSchemaVersion: config.formSchemaVersion,
        collectionPolicyVersion: config.collectionPolicyVersion,
        supersedesSubmissionId: record?.state === 'stored' ? record.receipt.submissionId : null, plan } };
      if (new Blob([JSON.stringify(snapshot.request)]).size > contract.MAX_BYTES) {
        message = 'This plan is too large to send. Keep a backup and contact the organiser.'; refresh(); return;
      }
      try { save(snapshot); } catch (_) { message = 'The retry snapshot could not be saved in this browser. Nothing was sent. Allow browser storage and try again.'; refresh(); return; }
      return attempt(snapshot);
    }
    send.addEventListener('click', () => {
      // Chrome serialises sending tabs before either allocates a new ID.
      if (navigator.locks) navigator.locks.request(key, { ifAvailable: true }, lock => {
        if (lock) return submit();
        message = 'Another tab is sending this plan. Wait for its receipt, then try again.'; refresh();
      }).catch(() => { message = 'The submission could not start. Keep this tab open and try again.'; refresh(); });
      else submit().catch(() => { message = 'The submission could not start. Nothing new was sent.'; refresh(); });
    });
    const changed = event => {
      if (root.contains(event.target) || isRestoring()) return;
      if (record?.state === 'stored' && record.prepared) {
        const current = reviewContent();
        if (current !== reviewedContent) resetDeclarations();
        reviewedContent = current;
      }
      message = ''; refresh();
    };
    doc.addEventListener('input', changed); doc.addEventListener('change', changed); doc.addEventListener('click', changed);
    const stored = event => { if (event.key === key && !busy) { read(); message = ''; refresh(); } };
    window.addEventListener('storage', stored);
    const reconcile = () => { if (!busy && root.isConnected) { read(); refresh(); } };
    window.addEventListener('rpa-submission-state', reconcile);
    read(); window.setTimeout(() => { reviewedContent = reviewContent(); refresh(); }, 0);
    return { root, refresh, replaced() {
      epoch++; message = '';
      if (record?.state === 'stored' && record.prepared) {
        try { save({ ...record, prepared: false }); } catch (_) { blocked = true; }
      }
      refresh();
    }, dispose() { epoch++; window.removeEventListener('storage', stored); window.removeEventListener('rpa-submission-state', reconcile); doc.removeEventListener('input', changed); doc.removeEventListener('change', changed); doc.removeEventListener('click', changed); } };
  };
})();
