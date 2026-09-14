# Private JSON exchange — operator steps

Gustavo owns the private Drive parent folder and confirms receipt. Max supports
technical verification and can read the collected plans and notes. This implements
the handling decision in [RPA-80 comment 10087](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10087).
It does not prove that a folder or its permissions have been configured.

## Prepare with synthetic files

1. Record the actual parent folder privately. Keep access restricted to Gus and
   Max. Create a session-ID subfolder and use ID-based filenames, for example
   `S01-original.json` and `S01-revised-01.json`. Preserve the original separately.
   Record which revision is being returned; there is no automatic synchronisation.
2. Check effective access, including inherited access. Give a participant only
   their own upload/return location, not the parent folder. Keep session notes in
   an operator-only location within the private parent, not in a participant's
   shared folder. Do not enable public or unrestricted link sharing as a shortcut.
3. Rehearse with two authorised test identities and synthetic session folders.
   A must be able to upload/download A's files and must be unable to list or open
   B's folder/files, including through a direct link. Repeat B against A. Confirm
   Gus and Max can retrieve intended files. A reviewer being able to see both is
   not evidence of participant isolation. Record who tested each case and when.
4. Confirm participant access works with the account method they will actually
   use. If the agreed upload route does not work, resolve it before collecting
   plans; do not substitute a new public destination or delivery service.
5. Put session dates, the final deletion date, Gus's deletion-contact method and
   the confirmed data-handling notice into the private operator record. Keep keys,
   passwords, participant links and completed observation sheets out of Git/Jira.

## Exchange one plan

| Step | Action | Evidence to record privately |
| --- | --- | --- |
| Download | Author downloads JSON and locates the actual file | File present, intended plan, revision label |
| Upload | Author uploads to their isolated session folder | Uploaded file is retrievable by Gus |
| Receipt | Gus checks the received file and confirms receipt to the author | Receipt time and revision label |
| Safety copy | Reviewer downloads any current browser plan they need to keep | Safety copy saved before replacement |
| Restore | Reviewer selects received JSON, confirms replacement and waits for success | Expected values restored; extra prior rows removed |
| Edit | Reviewer discusses feedback and edits in the app | Intended revision, no separate commenting system implied |
| Return | Reviewer downloads and verifies revised JSON, then places it in the session folder | Revised file retrievable by that participant |
| Author receipt | Author confirms receiving the revised file | Receipt time and revision label |
| Author restore | Author backs up current writing, restores the revised JSON and checks edits | Expected revision recovered and editable |

Use these distinct outcomes in the [observation sheet](manual-observations.md).
Screenshots of a download message, browser-only restores and an intended filename
are not proof of private transfer. A PDF is a reading copy, not the editable backup.
If a transfer fails, retain the last verified local file and record the failed step;
do not claim receipt or retry by overwriting the only good copy.

## Recovery and deletion

- Rehearse cancel and invalid-file restoration with invented data: writing must
  remain intact. A successful restore replaces the current plan, including hidden
  and unsaved data. Verify a safety copy before every replacement.
- Verify the private originals/revisions remain retrievable after an app restart
  or redeploy. App hosting does not store these plans or back up the Drive folder.
- Gus deletes retained plans, revisions and notes four weeks after the final
  session, or sooner on request. Record the due date once the final session date
  is known and adjust it if that date changes. Account for team-held downloads,
  copies and recoverable/trash copies under their control; do not promise that
  deleting a Drive item also clears participants' own devices or provider records.
- Rehearse authorised deletion with a disposable synthetic copy and confirm the
  former participant link no longer opens it. Record the scope, date and operator
  without retaining the deleted content. Existing legacy uploads are outside this
  exchange; do not remove them through this checklist.

Completed copies of this record belong in the private operator location. Blank
templates and synthetic, non-identifying verification summaries may be published.
