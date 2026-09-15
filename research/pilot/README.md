# Invited pilot instructions and checks

Refreshed 15 September 2026 for [RPA-6](https://turingtestable.atlassian.net/browse/RPA-6).
Start with the [current release proposal](release-proposal-2026-09-15.md) and
[operating decision sheet](operating-decisions-2026-09-15.md). The app update is
merged; deployment and participant acceptance remain separate. This pack draws on
the earlier local review pack, which remains preserved with its historical evidence.
Publication of these documents does not establish a deployed or accepted release.

## Use the pack

| Reader | Document | Purpose |
| --- | --- | --- |
| Participant | [Participant guide](participant-guide.md) | Sign in, keep writing, use AI deliberately, download and restore |
| Gustavo and Max | [Private file exchange](private-file-exchange.md) | Verify access, transfer, confirm receipt, return a revision and delete retained copies |
| Session observer | [Manual observation sheet](manual-observations.md) | Copy the blank template into the private notes location |
| Max | [Release checklist](release-checklist.md) | Record the actual deployment, tests and go/no-go |
| Reviewer | [Evidence and remaining work](evidence.md) | Distinguish code, local/manual results and outstanding hosted checks |

Fill the private operational details before distributing the
participant guide; never publish participant links, completed notes or credentials
in this repository or Jira.

## Agreed scope and owners

- Max owns deployment, verification, release and rollback in his Render workspace.
  Gustavo covers the agreed costs and retains authority to stop AI spending.
  Hosting exists; keep the current US$3/month AI workspace cap and auto-reload Off.
- Gustavo owns sessions and the private Google Drive folder.
  Gus and Max read collected plans and notes; each participant accesses only their
  own upload/return location. Use session IDs rather than names in filenames.
- The selected journey is browser draft → JSON download → deliberate private
  upload/receipt → reviewer restore/edit → revised download/return → author restore.
  Print / Save as PDF provides a readable copy. Restore replaces, rather than merges.
- Plans, revisions and session notes are deleted four weeks after the last session,
  or earlier on request to Gus. Actual permissions and exchange are still to verify.
- Completed-plan Send is implemented and off by default. When separately enabled,
  two declarations and dated sign-offs precede private R2 storage and a receipt.
  Send does not email anyone or collect browser email/review history. The full
  remote sequential approval/email workflow remains deferred.
- Tool feedback is separately enabled in the candidate and writes a local server
  file. Resolve its notice, export/recovery and deletion before participant use;
  Send-off is not zero collection. Direct PDF/Word downloads, CSV, accounts and
  automatic telemetry are not added by this release. Calibration, uploads, library
  writes and app Google/Jira integrations stay disabled.

## Remaining private operational details

| Value | Owner | Where to record it |
| --- | --- | --- |
| Canonical HTTPS address and actual release/deploy identity | Max | Release record; normal app URL may be shared with invitees |
| Shared password and API key | Max | Private credential storage and Render secrets only |
| Provider cap/credits, cost response and backup custody confirmed | Max + Gus | Account settings and private operator record; no secrets |
| Actual parent folder and isolated per-session links | Gus | Private operator record; give each participant only their own link |
| Session dates, final deletion date and contact method for Gus | Gus | Private operator record and participant notice |
| Final participant notice | Gus + Max | Private session record |

Use the [deployment runbook](../../DEPLOYMENT.md) for service settings and AI stop
procedures. Follow [RPA-80's workflow decision](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10068)
and [Gus's handling decision](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10087).
RPA-1 and RPA-6 remain open until their actual acceptance gates pass; RPA-7 owns
session results and RPA-83 the later public release.
