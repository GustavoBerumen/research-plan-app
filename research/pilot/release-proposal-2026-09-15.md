# Protected release proposal — 15 September 2026

Prepared under RPA-6, with RPA-1 deployment and RPA-80 operating decisions.
This is reviewable preparation. Deployment, publication, real participant collection
and collaborator messages require Max's explicit approval. Work resumed after the
PC restart; the earlier pause is historical.

## Verified release identities

| Item | Verified value / evidence |
| --- | --- |
| Tested candidate | `d1802db5c9aea44eebf68eb6d34a3070f2ed9f4e`; source for this preparation's local checks |
| Latest remote main | `f3273269d58893e9e4f6004267175c54b4d6d4ff`; [PR #98](https://github.com/GustavoBerumen/research-plan-app/pull/98), RPA-137 review links, merged at 17:04:46 UTC on 15 September |
| RPA-64 | [PR #99](https://github.com/GustavoBerumen/research-plan-app/pull/99) merged; feature head `d3c7be5d1093d7652302186a0467d79d307f7342` |
| CI | [Run 34986672730](https://github.com/GustavoBerumen/research-plan-app/actions/runs/34986672730), success, feature head; recorded 644/644 |
| Current hosted source | `6818628280b87dd5eeb2989b60cc3f7487c66d4f`, Render dashboard's last successful commit |
| Current live deploy | `dep-dak32sbl550s73brjv1g`, environment-update deployment; same earlier code |
| Service | `srv-dai7m2gae00c73fjgqhg`, research-plan-app, Max's Research Plan App workspace |
| Hosting settings | Oregon (US West), Node, 0.5c-512mb; `npm ci --omit=dev`; `node server.js`; `/healthz`; auto-deploy Off |
| Origins | https://research.gustavoberumen.com/ canonical; https://research-plan-app.onrender.com/ also enabled |
| Custom domain | Render shows Verified and Certificate Issued |
| AI account | Dedicated research-plan-app workspace; US$3/month; US$3.54 displayed organisation credits; auto-reload Off, read live on 15 September |
| Current ownership | RPA-1 and RPA-6 In Progress, Max, under RPA-124; RPA-7 Ready, Gustavo. RPA-64/RPA-80 under RPA-88; RPA-125 under RPA-43 |

The account cap is distinct from the much higher organisation-wide limit. Rounded
workspace spend is not a count of calls or proof that no calls occurred. No AI
setting was changed. A read-only Render-shell HTTPS check at 16:44:23 UTC passed
16/16 checks across both origins: health GET/HEAD, missing/wrong login, valid
page/config and private-source rejection. Runtime: Node v24.19.0, `6818628`,
pilot true, AI true, `claude-haiku-4-5-20251001`; submissions setting absent on the
old build. Safe config on both origins confirms pilot true and all five old
write/proxy capabilities false. These are hosted checks of the old build, with
no paid requests or record writes. They do not accept the new candidate.

Main advanced after the candidate checks. RPA-137 adds per-person review links
that can be copied, withdrawn and reissued, but they resolve against the plan in
the same browser; remote plan access and email delivery remain deferred. Its
eight changed files do not overlap this nine-document update. The 644-test and
44-check results below apply to `d1802db`, not to the newer main. Publishing these
documents does not select or accept `f3273269` for deployment. If that newer build
is selected, verify its tests and review-link behaviour and update this release
record before deployment approval.

The exact tested candidate was also exported to a clean local folder with no `.env`.
Render's production dependency mode installed 33 packages from the lockfile;
`node server.js` passed 44 real local HTTP/startup checks with zero calls reaching
the loopback provider trap. This includes the feedback-file exception and
disabled submissions. Windows local production rehearsal is not Render/Linux
deployment evidence. Application/dependency sources remained unchanged.

The fresh complete suite passed **644/644**, zero failures/skips/cancellations,
in 300.3 seconds with `--test-concurrency=2`. The first default-concurrency run
passed 643/644: one existing backup test exceeded its app-render setup timeout
while other checks/installations ran. Both logs are retained; no production code,
test assertions or timeouts were changed to obtain the pass.

## Proposed sequence

1. **Resolve feedback handling, then approve deployment of the exact candidate.**
   Existing password holders would receive the new feedback capability too;
   calling a deployment synthetic-only does not restrict them. Before deploying
   this unchanged candidate, approve its feedback notice and handling for invited
   access, or select and review a change that gates feedback collection. Any code
   change creates a new candidate SHA and must be tested and published first.
   Use the existing service and manual specific-commit deployment. Keep the shared
   password, canonical origin, AI key/model/cap, one instance and auto-deploy Off.
   Keep completed-plan submissions disabled; do not configure R2 or initialise a
   participant cohort as part of this deployment. Do not sync the Blueprint's
   initial AI-Off default over the existing setting. The runtime/configuration
   read above is complete; recheck for changes and an active session at rollout.
2. Run the bounded hosted checks below with invented content. This establishes
   whether the interface update works on the actual host. It is not permission to
   invite more participants, collect completed plans or run a session.
3. Settle the [operating decisions](operating-decisions-2026-09-15.md), including
   the feedback exception. For a Send-enabled
   trial, configure an approved private destination/cohort and run the separate
   hosted R2 acceptance below before collection. The existing test bucket stays
   synthetic-only; its location and short-lived keys are not production approval.
4. Record the exact accepted deployment and one final short Max walkthrough.
   Gustavo acknowledges the notice and session readiness. Target: before
   Thursday 17 September; the session time remains to be confirmed.

## Newly identified release issue: tool feedback

At this candidate, `capabilities.feedback` is always true. A successful
`POST /api/feedback` appends to `feedback-data.jsonl`, including optional free text,
usefulness, plan title, section, client build and server time. It is protected by
the pilot gate, but is outside R2, its receipts and backup/deletion CLI. The UI
thanks the user for saved feedback. This is intentional RPA-98 behaviour, confirmed
by its tests; this preparation does not silently remove it.

Render's Disk page was checked: it offers Add Disk and has no attached disk.
The app's local feedback file is therefore on the ephemeral service filesystem.
The source provides no feedback export/retention scheduler. Before participant
use, approve and verify feedback notice, custody, export and deletion, or have a
small separately reviewed change gate this collection. Merely telling participants
not to click the button is not a technical collection control. Do not describe a
Send-off release as zero collection, or treat feedback as a durable completed plan.
Track this under existing RPA-98/RPA-80/RPA-6; no new storage ticket is needed.

## Rollback plan

- Record the current deploy and confirm its retained build artifact before rollout.
  The first fallback is `dep-dak32sbl550s73brjv1g` / `6818628`, which already has the
  protected pilot gate. Never choose a pre-RPA-1 unprotected build.
- Roll back for startup/health failure, either hostname losing protection,
  unexpected capabilities or collection, broken recovery, or unusable navigation.
  Recheck both hostnames, safe config and actual source identity after rollback.
- Render rollback reuses the target build and several target settings, including
  environment variables, but does not overwrite saved current service settings.
  A later normal deploy uses the current saved configuration. Environment groups,
  domains and external R2/Drive data have separate behaviour. Check all relevant
  flags and secret identities before the next normal deploy. See
  [Render rollback documentation](https://render.com/docs/rollbacks).
- Preserve a JSON backup before the update and remain on the canonical origin.
  Before a planned rollback, download a fresh v9 backup from the still-loaded
  newer page before refreshing into old code; preserve it even if old code cannot
  import it. If that is impossible, do not overwrite the browser's newer draft.
  Old source predates version-9 drafts; do not assume it can read a newer browser
  draft or safely round-trip browser-only email/review history. Retain the v9 file,
  stop editing if the fallback rejects it, and recover using the newer compatible
  build or a verified earlier compatible backup. Never clear browser data to force it.
- If collection is ever enabled, stop acceptance, drain in-flight sends for at
  least 75 seconds and pause the cohort before maintenance. Preserve receipts,
  frozen pending requests, primary records and latest independent deletion journal.
  Code rollback does not roll back R2. Do not redeclare a receipt, overwrite an old
  record, or resend edited content under an old ID. Use SUBMISSIONS.md for recovery.
- An urgent AI stop can revoke the dedicated key; changing an environment variable
  affects the new process and an in-flight call may still cost money. This document
  does not authorise a production stop or credential change now.

## Bounded hosted verification after approval

Use synthetic data and a single operator. Record full SHA, deploy ID, UTC time,
origin, result and evidence class for each item. Stop on an unexpected write or
paid request; do not stress or exhaust the service.

| Check | Bound and success evidence |
| --- | --- |
| Build, TLS and access | Both origins: GET/HEAD health, absent/wrong credentials on page/config, valid page/config and private-file rejection. Record Render SHA plus runtime build; no paid payloads |
| Capability and route controls | pilot true; submissions false for initial update; calibration/uploads/library-write/Jira/Google false; feedback explicitly true. Check malformed disabled requests reject before processing; known/unknown framework read |
| Browser and recovery | Agent runs desktop and 1280px keyboard/navigation, fresh email entry, partial draft/reload, actual saved v9 JSON and safety-copy restore/cancel/invalid-file checks. Exercise returning earlier draft and receipt states with synthetic fixtures. Inspect saved bytes; no new mandatory PDF round |
| Feedback boundary | Only after synthetic-write approval: one invented feedback submission, inspect the exact local file record and private-file denial, document export/redeploy-loss limitation. No real title or feedback text |
| AI | After verifying current credits/cap, at most one small evaluation and one request through each suggestion route; at most US$0.05 total test allowance subject to explicit approval. Stop after each request and inspect usage. No user requests repeated if controls are absent; explain inaccessible UI paths. Automated local evidence covers limit/failure/pause behaviour; do not exhaust real credits |
| Same-build restart | Approved restart once; verify same-origin draft/recovery, auth and config. Record what survives in browser, what is externally stored, and feedback-file handling separately |
| Send-enabled acceptance | Separately approved synthetic cohort: one complete application Send with receipt and operator read/hash; same-ID retry, changed-payload conflict, no overwrite; restart/redeploy read; independent encrypted backup plus latest journal readback/recovery; deletion and nonresurrection; close-out/purge procedure. Use existing evidence for unchanged provider semantics, focusing new work on actual hosted build/configuration |

An arbitrary spend ceiling cannot be guaranteed by checking an asynchronously
updated Console after each call. Keep the provider cap intact and approve this
bounded probe allowance before paid tests; skip paid tests if it cannot be honoured.

## Max's final walkthrough (one, about five minutes)

After technical checks pass, open the canonical protected build on the intended
desktop/laptop, resume the prepared invented draft, edit one answer and refresh,
download its backup, then inspect the final review/Send wording if enabled. Confirm
the journey is understandable and the writing remains. The agent covers detailed
technical regression and file checks. Additional manual work requires a concrete
uncovered browser interaction or regression, not a blanket repeat of earlier tests.

## Participant instructions and current go/no-go

Max confirmed on 15 September that Gustavo does not consider discussion-guide
reconciliation important. It is removed from release requirements; no further
lookup, replacement script or guide approval is needed.

The updated participant instructions use current control names, explain local
email and drafts, distinguish Send receipts from review/email, keep AI optional,
and cover separate tool feedback, notice and private review/return. RPA-79 notes
distinguish assistance, technical failure, AI quality, feedback and plan submission.
Gustavo chooses the session tasks and timing.

**Current decision: prepared for deployment review; participant go/no-go remains
open.** A successful historical provider rehearsal, local tests or merged PR alone
does not accept this hosted build. No deployment or participant collection occurred
in this preparation.
