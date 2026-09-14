# Evidence and remaining work — 11 September 2026

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

Next: finish the card decision; deploy protected code with AI paused; verify access
and configuration; verify the provider budget before live AI; rehearse private
exchange, recovery and deletion; reconcile Gus's guide and record the release
decision using the [release checklist](release-checklist.md).
