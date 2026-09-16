# Pilot preparation and instructions

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

Updated 15 September 2026 under [RPA-6](https://turingtestable.atlassian.net/browse/RPA-6).
The [completed local walkthrough and follow-up fixes](manual-results-2026-09-15.md)
record Max's browser and saved-file evidence, remaining hosted gate, and shorter
backup instructions that do not require completing every section.
Start with the [release proposal](release-proposal-2026-09-15.md) and
[decision sheet](operating-decisions-2026-09-15.md).

The accepted mode for Thursday is a clearly labelled browser-local sequential
review demonstration, submissions OFF, with corrected wording and reviewed
feedback handling. Max accepted the feedback gate and scoped fixes. Unchanged candidate `f327326` is no-go
for participant release because of reproduced dead-link recovery loss and
misleading delivery wording. Publishing documentation does not accept a build.

| Reader | Document | Purpose |
| --- | --- | --- |
| Max and Gustavo | [Release proposal](release-proposal-2026-09-15.md) | Exact candidate, choices, blockers, sequence and rollback |
| Decision makers | [Operating decisions](operating-decisions-2026-09-15.md) | One grouped decision list; conditional collection requirements |
| Participant, after acceptance | [Participant guide](participant-guide.md) | Honest local-demo instructions and backup/recovery |
| Verifier | [Candidate verification](candidate-verification-2026-09-15.md) | Tests, source references, reproduced failures and limits |
| Release operator | [Release checklist](release-checklist.md) | Bounded checks on the exact approved hosted build |
| Observer | [Manual observations](manual-observations.md) | Distinguish local demonstration, AI, collection and assistance |
| Historical/contingency operator | [Private file exchange](private-file-exchange.md) | Previously agreed private handling, only when explicitly needed |
| Reviewer | [Evidence](evidence.md) | New evidence separated from older local, provider and hosted results |

## Scope and ownership

- Max owns technical verification, deployment and rollback; Gustavo owns sessions,
  covers agreed costs and retains AI-stop authority. RPA-1/RPA-6 remain open.
- Human sequential review is an MVP objective. Current links use this browser's
  saved plan. Neither submissions OFF nor ON supplies live shared review/email.
- JSON remains the backup/recovery representation, preserving partial drafts.
  Manual JSON exchange is historical/contingency handling, not the reviewer product.
- Completed-plan R2 collection is independently activated using
  [SUBMISSIONS.md](../../SUBMISSIONS.md). Immutable submissions and mutable review
  records have different requirements. No new participant bucket is authorised.
- Existing team-held records keep their agreed retention and deletion obligations:
  four weeks after the last session or earlier on request to Gustavo. Confirm actual
  dates, access and notices privately; no records are silently discarded.
- Feedback is separate local-file collection, controlled by `RPA_FEEDBACK_ENABLED`
  and OFF by default in pilot mode. Preserve existing records and verify the
  gate before deployment to existing password holders.
- Last-observed provider/hosting settings are dated evidence: protected pilot,
  one Oregon instance, auto-deploy Off, US$3/month AI cap and auto-reload Off.
  Recheck before rollout; do not change them through this documentation task.

Keep credentials, actual participant files, links and completed observation sheets
private. Use [DEPLOYMENT.md](../../DEPLOYMENT.md) for the service runbook. No new
discussion-guide lookup, PDF round, draft-PR takeover or public release is required.
