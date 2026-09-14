# Invited pilot instructions and checks

Prepared 11 September 2026 for [RPA-6](https://turingtestable.atlassian.net/browse/RPA-6).
This is the shareable operating pack for the agreed JSON/PDF pilot. It draws on
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

Use Gustavo's existing 35-minute discussion guide to run sessions. The participant
instructions and observation columns support that guide; this pack introduces no
replacement timetable or research script. Reconciliation awaits access to the
actual guide. Fill the private operational details below before distributing the
participant guide; never publish participant links, completed notes or credentials
in this repository or Jira.

## Agreed scope and owners

- Max owns deployment, verification, release and rollback in his Render workspace.
  Gustavo covers the agreed costs and retains authority to stop AI spending.
  Card selection remains a Max/Gustavo decision.
- Gustavo owns sessions, the discussion guide and the private Google Drive folder.
  Gus and Max read collected plans and notes; each participant accesses only their
  own upload/return location. Use session IDs rather than names in filenames.
- The selected journey is browser draft → JSON download → deliberate private
  upload/receipt → reviewer restore/edit → revised download/return → author restore.
  Print / Save as PDF provides a readable copy. Restore replaces, rather than merges.
- Plans, revisions and session notes are deleted four weeks after the last session,
  or earlier on request to Gus. Actual permissions and exchange are still to verify.
- Finish/Send, direct PDF/Word downloads, email collection/delivery, CSV, accounts
  and automatic telemetry remain later work. Pilot calibration, uploads, library
  writes and app Google/Jira integrations stay disabled.

## Remaining private operational details

| Value | Owner | Where to record it |
| --- | --- | --- |
| Canonical HTTPS address and actual release/deploy identity | Max | Release record; normal app URL may be shared with invitees |
| Shared password and API key | Max | Private credential storage and Render secrets only |
| Card and provider budget/credits confirmed | Max + Gus | Account settings; record non-secret verification only |
| Actual parent folder and isolated per-session links | Gus | Private operator record; give each participant only their own link |
| Session dates, final deletion date and contact method for Gus | Gus | Private operator record and participant notice |
| Existing discussion guide reference and reconciled notice | Gus + Max | Private session record |

Use the [deployment runbook](../../DEPLOYMENT.md) for service settings and AI stop
procedures. Follow [RPA-80's workflow decision](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10068)
and [Gus's handling decision](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10087).
RPA-1 and RPA-6 remain open until their actual acceptance gates pass; RPA-7 owns
session results and RPA-83 the later public release.
