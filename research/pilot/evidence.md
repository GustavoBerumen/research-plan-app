# Evidence and remaining work

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

## Approved repair candidate

[PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104) implements
the accepted fixes at `429c7297837bb312974b5de2d98e7573cd613f93`, based on f327326.
The complete 72-file package.json suite passed **672/672**, concurrency 2,
Node v24.19.0, 280.5 seconds, with no failures/skips/cancellations. The eight
link/mode/timing cases now preserve the complete saved draft and normal recovery;
failed/malformed config, no draft, queued/direct saves and the feedback gate pass.
The queued-save case uses test-only instrumentation of the real app functions.

Synthetic loopback in-app browser checks confirmed disabled dead-link Menu
actions, retained Interviews after returning to the own plan, honest local review
progress and the visible feedback-unavailable notice. Zero feedback/submission/AI
requests occurred. This is local evidence; browser-created file saving and hosted
acceptance remain separate. Check PR/CI and final main ancestry before deployment.

The original audit below deliberately retains the failures of unchanged f327326
and earlier evidence. Do not attribute those failures to the repaired candidate
or the repaired candidate passes to the old deployed build.

## Current continuation — pinned f327326

The [candidate verification](candidate-verification-2026-09-15.md) records this
pass in detail. Full suite: **654/654**, 71 package.json files, concurrency 2,
Node v24.19.0, 262.7 seconds. No full-suite rerun after documentation edits.
The clean source export and unchanged lockfile are preserved with local logs.

Focused dead-link checks found methods lost on autosave and omitted from download
in all eight ON/OFF, unknown/revoked, early/late cases. ON restore from a dead page
also fails with a null cloneNode error. The browser reproduced the missing method.
Normal partial backup/restore/cancel/invalid-file/reload passed. Actual generated
JSON files were saved, read back and hashed; the in-app browser restored one and
displayed its writing. Browser download itself remains unverified after a timeout.

Visible checks cover both review modes, sequential local approval and OFF email
wording. They used a synthetic loopback preview, default in-app viewport and mocked
capabilities; no native Chrome, hosted, paid-provider or cloud-record evidence is
claimed. The preview made zero AI/feedback/submission requests. Its initial missing
helper assets and UTF-8 fixture header were corrected in the temporary harness;
candidate application code was unchanged. The retained exploratory field-only
checks are superseded for method preservation by the failing focused reproducer.

The prior nine-document update was already committed/pushed as d681155. These new
changes are uncommitted on the same branch; no PR has been opened. RPA-6 is still
In Progress, Max, under RPA-124. Draft PRs #100–103 remain Gustavo's work.

Latest provider/service settings below are historical observations, not a fresh
dashboard check. Earlier 644/644 plus 44 production checks cover d1802db; 16/16
hosted checks cover 6818628 / dep-dak32sbl550s73brjv1g. The preserved 59-file pack,
source exports, logs and retention obligations remain intact. No new deployment,
paid call, real collection, provider change, external message or BitLocker action.

Use the [release proposal](release-proposal-2026-09-15.md) for the current no-go
on unchanged f327326 and the accepted browser-local demonstration after fixes.
All current-sounding statements in the historical sections below belong to their
recorded observation, not this new candidate.

## Historical earlier preparation — 15 September 2026 (before this continuation)

The [release proposal](release-proposal-2026-09-15.md) is the current starting point.
The tested candidate is `d1802db5c9aea44eebf68eb6d34a3070f2ed9f4e`, including merged
RPA-64 and its successful PR-head CI. Main subsequently advanced to
`f3273269d58893e9e4f6004267175c54b4d6d4ff` through RPA-137 PR #98 at 17:04:46 UTC.
Live GitHub verification confirms that merge adds browser-local review links and
does not overlap these documentation changes. The new main was not run through
this preparation's local tests; the results below retain their original source.
Recorded RPA-64 evidence: 644/644 local and CI, 22/22 focused compatibility,
synthetic browser walkthrough, earlier Max-reported manual passes, and an earlier
real R2/private Drive recovery/deletion rehearsal. Each retains its own source
version; none is hosted acceptance of the merged build.

Render's dashboard still shows `6818628` / `dep-dak32sbl550s73brjv1g` live, Oregon,
the expected build/start/health settings, auto-deploy Off and a verified custom
domain with certificate issued. Anthropic shows US$3 workspace cap, US$3.54 credits
and auto-reload Off. At 16:44:23 UTC, 16/16 read-only HTTPS checks through Render
Web Shell passed across both hostnames. Runtime is Node v24.19.0, pilot/AI true,
Haiku 4.5, submissions unset, source `6818628`; authenticated config agrees and
keeps the five old write/proxy capabilities off. No paid call or write was made.
No provider settings or deployed source changed.

A clean export of `d1802db` installed 33 production packages from the unchanged
lockfile and passed 44 local production-start/HTTP checks, zero provider-trap calls.
It confirmed feedback writes locally even while plan submissions are disabled.
This is Windows local runtime evidence with synthetic credentials/data, not hosted
acceptance or real R2 evidence.

The old uncommitted RPA-6 pack (59 files) was copied and SHA-256 verified with zero
mismatches before this refresh. Both earlier RPA-6 worktrees and RPA-64's worktree
remain preserved. The current preparation branch is `codex/rpa-6-release-readiness`.
Current-run logs, source export and preservation manifests are retained in the
task's local release-readiness evidence folder, not presented as participant data.

The candidate's `/api/feedback` local-file collection is a newly recorded
operational release issue. Its enabled capability is not covered by the older
all-writes-disabled assertion. See the operating decisions before participant use.

Fresh full suite: **644/644 passed**, no failures/skips/cancellations, 300.3 seconds
with test concurrency two. The first default-concurrency run was 643/644 after one
backup test's app-render setup timed out under load. Both logs remain available.
No app code, assertions or test timeouts changed. Source-specific earlier tests
remain separate evidence.

Max removed discussion-guide reconciliation from release requirements after
checking with Gustavo. Older entries below record historical context only.

## Historical record — 11 September 2026

The following table describes the earlier source and observations only. Its
pending account/deployment statements are superseded by the current record above.

This pack documents the protected candidate
`e78e8659d20ff68270794a13d7169d782f2a1bd5`, merged through
[PR #64](https://github.com/GustavoBerumen/research-plan-app/pull/64).
The instruction-pack changes do not alter application behaviour or dependencies.
The exact deployed SHA must be recorded when hosting becomes available.

| Evidence class | Result | Limits |
| --- | --- | --- |
| GitHub automated | [Tests run 34608582408](https://github.com/GustavoBerumen/research-plan-app/actions/runs/34608582408) passed 450/450 on PR #64 head `f6b80aaefd6850254919a394da6fe10e2442b23b`; merged tree matches that head. | Synthetic/offline tests, not live provider or hosted acceptance. |
| Fresh RPA-6 offline baseline | `npm test`: 450/450 passed, no failures/skips/cancellations, 73.7 seconds on Node 24.19.0. Run in the isolated instruction-pack worktree from `e78e865`; application/dependency files unchanged. | Uses existing locked dependencies and mocked providers. Does not add live or hosted evidence. |
| Agent local browser | Protected form/assets, three mocked Context evaluations and same-origin writing recovery worked. | Codex in-app browser; mocked AI; no native authentication-dialog pass inferred. |
| Max's manual report | All six requested Chrome checks passed: invented Context writing, Evaluate context, reload recovery, actual JSON download, replacement-warning restore after editing and saved/opened readable PDF. | User-reported on the local synthetic preview; agent did not inspect those saved files. Does not cover all viewport/keyboard, invalid/cancel, separate-profile, private-exchange or hosted cases. |
| Render setup | Repository selectable; screenshots confirm main/Oregon, build/start, $7 compute, `/healthz`, auto-deploy Off and non-secret pilot settings. Max reports entering the API key/password privately. | Unsaved/deploy preparation; no secret values inspected. Card choice/payment pending; no live service proven. |
| AI operation | AI remains configured Off. | Dedicated workspace, monetary cap, credit balance and live calls not verified. A key alone proves none of these. |
| Private handling | Gus recorded Drive ownership, readers, session-ID handover and four-week/requested deletion in RPA-80. | Actual folder access, isolation, exchange and deletion rehearsal not verified. |
| Guide and sessions | Gus owns a 35-minute guide and recorded a local session-1 exception. | Actual guide not retrieved/reconciled; no session results or deployed go/no-go inferred. |

The manual report is recorded in
[RPA-6 comment 10095](https://turingtestable.atlassian.net/browse/RPA-6?focusedCommentId=10095)
and [RPA-1 comment 10094](https://turingtestable.atlassian.net/browse/RPA-1?focusedCommentId=10094).
Older local pack evidence retains its original dates, source revisions and limits;
it has not been relabelled as current hosted evidence or uploaded with this pack.

For current next steps use the [release proposal](release-proposal-2026-09-15.md)
and [release checklist](release-checklist.md), not the historical pending setup.
