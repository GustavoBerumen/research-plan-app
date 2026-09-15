# Release verification record

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

This is a checklist for the exact approved release, not permission to deploy or
evidence that its unchecked rows passed. Max owns technical release/rollback;
Gustavo owns sessions and notice. Follow the [release proposal](release-proposal-2026-09-15.md).

## Preparation already completed

Approved fixes at `429c7297837bb312974b5de2d98e7573cd613f93` passed 672/672
local automated tests; [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104).
The browser observed retained methods and honest local-review/feedback UI.
Verify CI, final main SHA and the actual hosted release separately.

### Original audit

Pinned main `f3273269d58893e9e4f6004267175c54b4d6d4ff` passed 654/654 tests on
Node v24.19.0, using its exact 71-file manifest with concurrency 2. Focused checks
found dead-link autosave/download method loss in eight cases and a submission-mode
restore error. Browser observation reproduced the missing methods and inspected
both review modes. Ordinary saved partial JSON restoration passed. These results
do not accept unchanged f327326 for participants; see [verification](candidate-verification-2026-09-15.md).

Earlier 644/644 and 44 local production checks refer to d1802db. Earlier hosted
16/16 refers to `6818628` / `dep-dak32sbl550s73brjv1g`. Live hosting/provider
configuration was not rechecked here. Do not use these old passes for a new SHA.

## Record before rollout

| Value | Actual approved value |
| --- | --- |
| Full source SHA and selected mode | ___ |
| Fix PRs/reviews and exact-source test evidence | ___ |
| Deployment approval, owner and timestamp | ___ |
| Render deploy ID, service and time | ___ |
| Canonical origin and every other exposed hostname | ___ |
| Runtime/build, pilot true, one instance, auto-deploy Off | ___ |
| Submissions capability and feedback capability, independently | ___ |
| AI workspace/model/key identity, cap/credits/reload (no secrets) | ___ |
| Notice, session date/contact, permitted data and notes owner | ___ |
| Existing-record preservation and due-date record | ___ |

## Bounded acceptance

Use one operator and synthetic data. Record **Pass / Fail / Not run / Not applicable
with reason**, timestamp, full SHA, origin and evidence type. Stop on unexpected
collection, a protection failure or lost writing. Do not exhaust credits or repeat
the full suite for documentation-only changes.

| Gate | Required evidence |
| --- | --- |
| Candidate | Approved fixes present in the selected main SHA; normal release tests and focused regression evidence. Draft PRs are not automatic dependencies |
| HTTPS and access | Both origins: health GET/HEAD, absent/wrong credentials for page/config, valid page/config, private-source rejection. Record exact deployed source, not only footer |
| Capability controls | Pilot true; calibration/uploads/library-write/Jira/Google false. Submissions and feedback match separate approvals. Malformed requests to disabled endpoints rejected before processing |
| Dead links and local recovery | Unknown and revoked links reject plan display; clicking message, queued autosave and download/restore/clear controls cannot lose data. Return to normal address restores all fields, lists, methods, tables, hidden data and review history. Check ON/OFF and early/late configuration through affected automated tests plus one visible hosted path |
| Visible mode and wording | OFF presents the local sequential demonstration and honest email/delivery wording; ON presents the declarations/Send and no per-person link block. Pending/failed config also makes no email promise |
| Actual files and browser | Agent checks synthetic partial edit/reload, cancellation/invalid restore and saved-file readback. The remaining user check is one short intended-device/keyboard walk with an actual browser-created JSON download and restore; no new PDF round |
| Feedback | Gate option: disabled capability plus direct POST refusal and no append, with matching UI. Enabled option: approved participant notice, reader/destination/retention/export/deletion and explicit ephemeral-file limitation, verified before existing password holders see the update |
| Optional AI probes | First verify current cap/credits. Only with separate approval: at most one small evaluation and one request per suggestion path within the approved allowance. Use offline tests for rate/failure stress; preserve writing. Historical provider evidence is not a new hosted pass |
| Restart/rollback | Only after approval, one same-build restart/redeploy and protection/config/recovery check. Preserve any existing server feedback before planned restart. Verify retained protected fallback; retain v9 backups before old code |
| Session readiness | Confirm selected mode, honest final guide, acknowledgement and notes handling, actual session time, and explicit go/no-go |

## Conditional gates — only if that mode is selected

- **Live completed-plan collection:** approve actual private R2 jurisdiction,
  cohort/versioned notice, access, costs/response, independent backup/passphrase
  custody, deletion contact/deputy and purge date. Rehearse the actual hosted
  Send/receipt/read/hash, duplicate retry/conflict, restart persistence, encrypted
  backup plus latest journal, recovery, deletion and nonresurrection under
  [SUBMISSIONS.md](../../SUBMISSIONS.md). No test-bucket credentials for participants.
- **Live shared review:** decide and verify durable mutable records, version
  conflicts, role access, revocation, signed-revision retention, backup/deletion
  and delivery. Completed-snapshot R2 storage does not satisfy this automatically.
- **Explicit private exchange contingency:** verify identities, isolated folders,
  real upload/receipt/return/restore and deletion using the
  [operator checklist](private-file-exchange.md). This is not a gate for a
  browser-local demonstration that does not exchange plans.

## Final record

- Technical verification: ___ (Max, date/time).
- Named source/deploy and mode: ___; go/no-go and remaining limitations: ___.
- Session readiness: ___ (Gustavo, notice version and session time).
- Remaining action, owner and evidence: ___.

Keep RPA-1/RPA-6 open until actual acceptance is complete. Preserve historical
evidence and the earlier local-session exception as historical only. This checklist
does not authorise publication, service changes, paid requests or real collection.
