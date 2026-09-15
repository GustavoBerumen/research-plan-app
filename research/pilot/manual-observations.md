# Manual observation template

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

Copy this blank template into Gustavo's operator-only notes location. It implements the manual pilot slice of
[RPA-79](https://turingtestable.atlassian.net/browse/RPA-79), not automatic telemetry.
Do not commit completed sheets, private links, plan text, attachments, names or
email addresses to this repository or Jira.

## Mode and interpretation

Record the accepted mode first. The accepted Thursday mode demonstrates author
and reviewer turns on one browser; local Sign/Approved states are not remote
delivery, authenticated identity or team receipt. A facilitator acting as the
second person is a demonstration/assistance, not an independent reviewer success.
JSON exchange rows below apply only to an explicitly selected contingency.
Tool feedback remains subject to its separate approved gate/notice.

## Session record

| Field | Fill for the actual session |
| --- | --- |
| Pseudonymous session ID | S__ |
| Accepted mode and demonstrated role | Browser-local demo / completed-plan collection / future shared review; author / reviewer |
| Date, start time and timezone | |
| App origin; full deployed SHA and displayed build | |
| Rubric revision and notice version | |
| Browser, OS and viewport | |
| Acknowledgement | Given / declined / limited; record limits without personal details |
| Controls demonstrated or tasks prefilled | |
| Notes owner and readers | Gus; Gus and Max |
| Notes location | Private operator-only location; do not paste it into public evidence |
| Retention/deletion | Four weeks after last session; earlier on request to Gus; actual due date: ___ |

## One row per observed action

| Time / action ID | Stage / field | Task outcome | Assistance | Explicit evaluation clicks / retries | Displayed score | Technical failure / writing preserved? | Provider attempts / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | Independent after tour / assisted / failed / declined / not attempted | None / goal repeated / hint / demonstration; when given | Observed count or not observed | Exact displayed criterion, value and scale, or no result | Category and whether writing survived, or none observed | Unknown unless diagnostic evidence exists |

Distinguish the section Evaluate action from a field retry. One section click can
trigger several field requests, and a field request can contain provider retries.
Do not infer provider attempts or spending from clicks or displayed field results.
Do not turn a technical failure into a zero research-quality score, invent a number
from a qualitative label, or average scores with incompatible scales. Missing or
unattempted actions are not zero outcomes. Record completed-plan Send only when
enabled for the accepted release: attempted, rejected, unconfirmed, received or
updated. Keep tool-feedback submission separate. A receipt is not operator review
or email delivery; Send is not applicable when disabled.

Keep separate rows for:

- Same-browser writing recovery.
- Download requested and actual file verified.
- Local author signature, reviewer turn, request-changes/re-sign and approval; no delivery inferred.
- Private upload, reviewer receipt and backup before replacement, only for a selected contingency.
- Reviewer restore, edit and revised-file download, only for that contingency.
- Private return, author receipt and returned-file restore, only for that contingency.
- PDF save and reopen, if attempted.
- AI evaluation/suggestion use and any failure or retry.
- Completed-plan validation, declarations, Send receipt/retry, if enabled.
- Optional tool-feedback outcome and the agreed collection notice, separately.

Do not make a participant complete every technical rehearsal step during a study.
Gustavo chooses the session tasks and timing. Record demonstrations as assisted;
protect writing when necessary and label that intervention.

## After the session

| Finding | Existing issue or new observation | Evidence / affected action | Impact / follow-up owner |
| --- | --- | --- | --- |
| | Known / new / needs investigation | | |

Summarise task difficulty, assistance and feedback usefulness without copying the
plan. Gustavo owns synthesis and prioritisation under RPA-7. These manual records
do not complete RPA-79's later event storage/export requirements.
