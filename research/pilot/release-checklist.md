# Release verification record

Copy and complete for the actual release. Max owns technical verification,
deployment and rollback; Gustavo owns sessions and AI-stop authority. Use the
[deployment runbook](../../DEPLOYMENT.md) for exact service settings, request
controls, stop/resume and rollback. The checklist does not authorise payment or
establish that an unrun check passed.

## Current starting point — 15 September 2026

Tested candidate: `d1802db5c9aea44eebf68eb6d34a3070f2ed9f4e` (RPA-64 PR #99 merged).
Main subsequently moved to `f3273269d58893e9e4f6004267175c54b4d6d4ff` (RPA-137
PR #98). Selecting that build requires its own test and review-link verification;
the recorded candidate results do not automatically cover it.
Render still serves `6818628280b87dd5eeb2989b60cc3f7487c66d4f`, live deploy
`dep-dak32sbl550s73brjv1g`. The current proposal, rollback target, source-specific
evidence and bounded checks are in the [release proposal](release-proposal-2026-09-15.md).
Use it instead of repeating completed account/payment/merge setup. Keep the
US$3/month AI workspace cap and auto-reload Off. Completed-plan Send is disabled
until separately approved. Tool feedback remains enabled and has a separate
local-file collection/retention issue to resolve before participant use.

The exact new hosted build, final notice, operating decisions and final acceptance
remain open. Earlier manual and real-provider results retain their original scope.
Do not request another broad manual test round; use the single final walkthrough
and automate technical checks. New PDF checks are not required in this round.

## Historical starting point — 11 September 2026

Protected code candidate: `e78e8659d20ff68270794a13d7169d782f2a1bd5` (PR #64).
The app is not yet verified online. Max has entered the Render configuration and
reports adding the key/password privately; their values were not inspected.
Card selection/payment remains pending. Dedicated provider workspace, budget and
credits remain to verify. Keep `RPA_AI_ENABLED=false` for the first deployment.
The server still requires `ANTHROPIC_API_KEY` at startup even while AI is paused.

## Record privately, publish only non-secret results

| Required value | Actual value |
| --- | --- |
| Tested/deployed full SHA, deploy ID and date/time/timezone | |
| Render service, account owner and region | Max's workspace; prepared region Oregon; actual service: ___ |
| Canonical participant HTTPS URL; all other exposed origins | |
| One instance; auto-deploy Off; health path | Verify actual settings; `/healthz` |
| Runtime/build/start and pilot configuration | Compare with runbook and `render.yaml` |
| Dedicated API workspace and key identity (never the key value) | |
| Actual provider billing currency, monthly cap, credits and auto-reload Off | Preserve US$3/month; refreshed balance and verified by/date: ___ |
| Card/billing decision | Agreed by Max + Gus; no card details in the record |
| Private folder, tested identities, access and exchange evidence | Private record reference only |
| Guide, notice, session dates, deletion date/contact and operator | Private record reference only |

Record each gate as **Pass / Fail / Not run / Not applicable with reason**, with
tester, timestamp, SHA/origin, evidence and limits. Local/mock evidence cannot
silently fill a deployed row. Use synthetic data for technical verification.

| Gate | Required evidence |
| --- | --- |
| 1. Identity and HTTPS | Record Render's exact deployed SHA/ID; HTTPS works on canonical and every other exposed hostname. Record footer marker separately; it may read `dev`. |
| 2. Access with AI paused | Missing/wrong credentials reject page and API access with no paid calls. Valid `pilot` login loads the form/assets. Public GET/HEAD `/healthz` reveals only health. Verify password rotation invalidates old credentials on all hostnames. |
| 3. Pilot capabilities | Signed-in `/api/config` reports pilot mode and disabled calibration/uploads/library-write/Jira/Google capabilities. Check submissions against the approved release mode and feedback separately. Private paths and encoded/traversal variants reject. Disabled endpoints reject before parsing, including malformed input. Read-only framework lookup works for a known name; unknown names return 404. |
| 4. Budget and bounded AI | Verify dedicated provider budget/credits before enabling AI. Make one small real evaluation and exercise both suggestion paths; inspect provider usage. Check failure recovery, pause/stop and busy/rate feedback with a bounded method. Use automated evidence for high-volume limits rather than deliberately exhausting credit. No claim that request limits are a monetary cap. |
| 5. Browser and real files | Agent checks the actual HTTPS origin at desktop/1280px: keyboard/navigation, writing/reload, actual JSON save, backup-first replacement, cancel/invalid-file preservation, separate-profile restore and edit/re-download. Include dates, sparse pairs, tables, defaults and custom/hidden values. Label browser engine/OS and saved-file evidence precisely. Max has one short final walkthrough; retain earlier reported PDF evidence. |
| 6. Private exchange | Complete the synthetic upload/receipt/review/return/restore sequence; verify cross-participant denial and restricted notes. Record actual file/receipt evidence, not just download status. See the exchange checklist. |
| 7. Restart, recovery and deletion | Approved restart/redeploy; confirm settings/protection, same-origin browser draft recovery, saved-backup recovery and retained private Drive files. If Send enabled, verify exact hosted R2 receipt/retry/readback and independent recovery/deletion. Apply SUBMISSIONS.md maintenance/drain/journal rules. Feedback's local file needs separate export/retention verification. |
| 8. Session readiness | Confirm the participant notice and give each participant only their own verified link. Record remaining limitations and final go/no-go. |
| 9. Operating custody | Approve actual R2 jurisdiction/destination, full versioned notice, readers, cost response, independent backup/passphrase custodians, deletion contact and purge/deputy. Do not use the synthetic test bucket or test keys as implicit trial approval. |

Retain reference filenames as metadata; attachment bytes and AI results are not
in backups. Back up before switching origins. Shared-password access is not an
individual account or cross-device draft service. Existing narrow Execution date
handling is instructions-only unless a tester encounters a real problem; this is
not permission to waive a failure that prevents the planned laptop task.

Gus's local session 1 on `b9138d0` is an explicit RPA-7 exception and does not pass
any deployed row here. Keep RPA-1 and RPA-6 open until their acceptance is complete.
Do not roll back to an unprotected pre-RPA-1 build; if no safe previous deployment
exists, suspend the service and revoke the pilot key as described in the runbook.

## Decision

- Technical verification: ___ (Max, date/time).
- Go / no-go for the named deployed candidate: ___; rationale and known limits: ___.
- Session readiness acknowledged: ___ (Gus, notice version).
- Remaining action, owner and required evidence: ___.

Keep actual plans, participant folder links and credentials in their private
locations. Publish only a non-secret pass/fail summary and exact code/deploy identity.
