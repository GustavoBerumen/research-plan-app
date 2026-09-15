# Evidence and remaining work

## Current release preparation — 15 September 2026

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
