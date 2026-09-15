# Tool feedback and the local pilot

Max accepted the RPA-6 recommendation on 15 September 2026: demonstrate sequential
review in one browser, with completed-plan submissions OFF and tool-feedback
collection OFF. The recovery and wording fixes are approved for implementation.
Deployment and participant sessions still require their recorded acceptance.

## Server setting

`RPA_FEEDBACK_ENABLED` accepts only the exact strings `true` and `false`.
Any other supplied value, including an empty string, stops startup.

| Setting | Protected pilot | Non-pilot |
| --- | --- | --- |
| Absent | Disabled | Enabled, preserving the existing default |
| `false` | Disabled | Disabled |
| `true` | Enabled | Enabled |

The `/api/config` feedback capability and the `/api/feedback` route gate use the
same value. Disabled requests are refused before reading their bodies or writing
records. The UI starts unavailable and offers no feedback form, Send button or
feedback-file exchange while configuration is pending, failed or disabled.
Explicitly enabled feedback retains the existing score and two-answer contract.
If sending fails, answers remain on screen and may be downloaded for local records;
the app does not ask participants to send those files manually.

This gate does not change completed-plan submissions, AI, calibration feedback,
existing feedback records or R2. Existing `feedback-data.jsonl` records must be
preserved before a later redeploy. Enabling feedback requires its own approved
notice, custody, export/recovery and deletion procedure. A local server file is
not covered by completed-plan R2 backups.

## Recovery and local review

An unknown or revoked review link shows no plan. It cancels pending autosave,
refuses direct saves, and disables plan-dependent Menu actions. Use **Open your
own plan** to return to the saved plan, then download or restore a backup there.
Normal partial drafts, blank rows, methods and local review history remain in
backups. Email addresses identify the local demonstration; no email is sent.

The remaining manual check uses the intended device and browser: a desktop is
fine. After technical acceptance, check the review flow with a keyboard, edit and
reload, then find an actual browser-downloaded JSON backup on disk and restore it.
There is no laptop requirement and no need for another broad manual or PDF round.
