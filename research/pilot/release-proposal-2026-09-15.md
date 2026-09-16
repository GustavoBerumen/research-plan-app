# Thursday release proposal — 15 September 2026

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

**Accepted mode: prepare a clearly labelled browser-local review demonstration,
with completed-plan submissions OFF and a separately reviewed feedback gate.**
Max accepted this mode and the scoped fixes. Deployment requires separate approval. The unchanged candidate has a reproduced recovery defect and misleading
delivery wording; it is **not ready for participant release**.

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

## Original audit source and evidence

| Item | This pass |
| --- | --- |
| Pinned application candidate | `f3273269d58893e9e4f6004267175c54b4d6d4ff`, freshly fetched main; includes RPA-137 PR #98 and RPA-64 PR #99 |
| Documentation worktree | `de15/research-plan-app`, `codex/rpa-6-release-readiness`; clean starting HEAD `d681155b77436cf7fe4f2fe15dc8bb8ecb394a16` was already committed and pushed |
| Documentation application baseline | `d1802db5c9aea44eebf68eb6d34a3070f2ed9f4e`; this branch was not advanced or used as the new application test source |
| New full suite | 654/654 passed, no failures/skips/cancellations; Node v24.19.0; all 71 test files from candidate package.json, concurrency 2; 262.7 seconds, 19:11:35–19:15:57 UTC |
| Focused evidence | Normal/late/failed configuration, both review modes and ordinary partial-backup restoration checked. Separate dead-link regression: method preservation and download failed in all eight unknown/revoked × ON/OFF × early/late cases |
| Visible local evidence | Codex in-app browser: sequential signatures and approval; ON declarations/Send; OFF email promise; unknown-link return with missing method; actual saved synthetic file restored and writing visible |
| Download limit | Browser reported download started, but no download event or verified browser-created file. The saved-file round trip used app-generated Blob bytes written and hash-checked by the diagnostic harness |
| Last hosted evidence, not rechecked here | Source `6818628280b87dd5eeb2989b60cc3f7487c66d4f`, deploy `dep-dak32sbl550s73brjv1g`; earlier 16/16 HTTPS checks at 16:44:23 UTC apply only there |

See [candidate verification](candidate-verification-2026-09-15.md) and the
[evidence record](evidence.md). No hosted, paid-provider or cloud-storage test was
run here. Earlier 644/644 and 44 local production checks remain evidence for
`d1802db`; they do not cover this SHA or any draft PR.

## Reconcile the meeting and implementation

The 15 September transcript (P250–P277) rejects manual JSON exchange as the normal
reviewer experience and makes human sequential review an MVP objective, allowing
a simple mockup initially. Thursday targets an updated, tested main (P520 onward),
with an outstanding draft allowed to wait. Gustavo's full pasted summary confirms
the two review modes and the remaining storage/feedback/email questions. These
sources inform this proposal; they do not authorise deployment or product choices.

| Choice | Actual behaviour and release requirements |
| --- | --- |
| Browser-local demonstration — accepted | Submissions OFF shows sequential sign-off. One browser stands in for both people; links resolve only against its saved plan. No remote reviewer retrieval, email delivery or durable shared approval. Preserve partial drafts and v9 backups. Fix dead-link recovery and honest wording, resolve feedback, then perform hosted acceptance |
| Live completed-plan collection | Submissions ON replaces the sequential panel and per-person links with two declarations, dated initials and Send/receipt. R2 stores completed immutable snapshots. It does not enable shared review or collect browser email/review history. Requires the separate notice/cohort/custody/recovery/deletion acceptance in SUBMISSIONS.md |
| Live shared review | Requires an agreed mutable, versioned durable record, concurrency/conflict handling, role/access ownership, recovery/deletion and an honest delivery mechanism. RPA-136/RPA-138 remain separate. PR #100's local-file store does not establish durability on the last-observed Render setup |

The earlier RPA-64 compatibility decision in [SUBMISSIONS.md](../../SUBMISSIONS.md)
still explains how ON works. It is not a decision to turn ON for Thursday.
JSON download/restore remains backup and recovery in every option. Historical
[private exchange](private-file-exchange.md) is operator contingency only; it is
not the intended reviewer product journey. Preserve existing records and their
agreed deletion obligations regardless of the new mode.

## Original blockers addressed by the accepted repairs

1. **Dead-link recovery.** A click on the dead-link message autosaves an empty
   methods array; downloading there also omits the saved methods. With submissions
   ON, restoring there fails with a null `cloneNode` error. Guard persistence and
   form-dependent actions while the plan DOM is absent; offer a safe return to the
   canonical own-plan page. Test queued saves, both configuration timings and full
   data preservation. Do not weaken unknown/revoked-link refusal.
2. **Delivery wording.** Correct the author-email hint/playback and the other-party
   email hint in the base rendering, so pending/failed/OFF configuration is honest.
   The original “Sign and send” / “Sent to” wording is replaced by local-review
   language in the repair candidate. No email service is added by a wording change.
3. **Tool feedback.** `capabilities.feedback` is true and POST `/api/feedback`
   writes score, answers, plan title, section, build and time to a local JSONL file.
   It is outside R2 backup/deletion. Recommend an explicit server capability gate
   and matching UI, reviewed separately, before deploying to existing password
   holders. An alternative is approved notice and verified handling/export/deletion
   that explicitly accepts the durability limit. Instructions not to click are
   insufficient. Preserve any already-held records before operational changes.

Detailed reproductions and change specifications are prepared as local task
artifacts. No production patch was applied in this documentation branch. Any
accepted code change creates a new candidate SHA requiring affected regression
checks and the repository's normal release validation.

## Draft PR boundary

All four were rechecked open/draft against main, owned by Gustavo; none was
adopted, altered, fully reviewed or tested as part of this candidate.

| PR | Pinned head | Thursday relevance |
| --- | --- | --- |
| [#100 RPA-138](https://github.com/GustavoBerumen/research-plan-app/pull/100) | `221b71f40b549fc76033e699f13dc4ad1b59c6bc` | Future HTTP sign-off; local store is not shared-review durability acceptance |
| [#101 RPA-121](https://github.com/GustavoBerumen/research-plan-app/pull/101) | `99c8993c6b00c45b9908cfc6e8c7acff3a056915` | Attribution; separate review, no blanket dependency implied |
| [#102 RPA-125](https://github.com/GustavoBerumen/research-plan-app/pull/102) | `095b64acd0f4209881fb9793563cceedec2a1141` | Proposed focus guard; original user-reported flicker remains unreproduced |
| [#103 RPA-46](https://github.com/GustavoBerumen/research-plan-app/pull/103) | `c4ba9946cf6454a43ef7b380fc62c639aee5a025` | Initial linked-plan model; not required to demonstrate this review flow |

Do not chase tomorrow's content commits indefinitely. If later work is selected,
record the new exact SHA and inspect its delta before release approval.

## Bounded path to Thursday 17 September

1. Mode, feedback gate and recovery/wording implementation were accepted by Max.
   Review the completed changes and publish the prepared documentation when authorised.
2. Implement/review approved fixes in their own scoped work, then select and test
   the resulting exact main SHA. Preserve this pass's evidence and draft ownership.
3. Obtain explicit deployment approval. Recheck live service/source/settings and
   active sessions; manually deploy the specific commit on the existing service.
   Keep protection, one instance, canonical origin and auto-deploy Off. Preserve
   the last-observed US$3/month AI cap and auto-reload Off; recheck before paid work.
4. Complete the [mode-specific acceptance checklist](release-checklist.md) on the
   actual host using synthetic data. Paid calls, service restarts and collection
   exercises require their own bounded approval; none happened here.
5. Max performs one short intended-device walkthrough: honest review wording,
   edit/reload and actual JSON download/restore, then Gustavo confirms session
   readiness and notice. No new PDF round or discussion-guide lookup is required.

## Rollback and preservation

The last recorded protected fallback is `dep-dak32sbl550s73brjv1g` / `6818628`.
Verify its retained build and protection before use. Roll back for lost access
protection, unexpected collection, failed startup, broken recovery or unusable
navigation. A pre-RPA-1 unprotected build is never a fallback.

Before refresh into older code, save and retain the newer v9 backup: old code may
not read browser email/review history or the newer draft version. If it rejects
the draft, stop editing and recover with compatible code; never clear browser
data to force it. Keep the canonical origin and preserve partial drafts.

Render reuses target build/settings for rollback but retains current saved
service settings for the next normal deploy. Disks and external R2/Drive records
are not rolled back with code. Verify flags and data separately. See
[Render rollbacks](https://render.com/docs/rollbacks), checked 15 September 2026.
If collection exists, follow SUBMISSIONS.md: disable acceptance, drain at least
75 seconds, pause, preserve receipts/frozen retries and the newest independent
deletion journal. Export/retain existing feedback according to its agreed handling
before a planned restart or deployment; do not silently discard it.

**Go/no-go: no-go for unchanged f327326 participant deployment.** Independent
preparation is complete and mode/gate/fix decisions are accepted. Implementation
verification, publication, deployment and hosted acceptance remain distinct. RPA-6 remains In Progress, assigned to Max under RPA-124.
