# Manual observation template

Copy this blank template into Gustavo's operator-only notes location and align it
with his existing discussion guide. It implements the manual pilot slice of
[RPA-79](https://turingtestable.atlassian.net/browse/RPA-79), not automatic telemetry.
Do not commit completed sheets, private links, plan text, attachments, names or
email addresses to this repository or Jira.

## Session record

| Field | Fill for the actual session |
| --- | --- |
| Pseudonymous session ID | S__ |
| Date, start time and timezone | |
| App origin; full deployed SHA and displayed build | |
| Rubric revision; guide and notice version | |
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
unattempted actions are not zero outcomes. Finish/Send is **not applicable** here.

Keep separate rows for:

- Same-browser writing recovery.
- Download requested and actual file verified.
- Private upload, reviewer receipt and backup before replacement.
- Reviewer restore, edit and revised-file download.
- Private return, author receipt and returned-file restore.
- PDF save and reopen, if attempted.
- AI evaluation/suggestion use and any failure or retry.

Do not make a participant complete every technical rehearsal step during a study.
Use Gus's guide for timing and research prompts. Record demonstrations as assisted;
protect writing when necessary and label that intervention.

## After the session

| Finding | Existing issue or new observation | Evidence / affected action | Impact / follow-up owner |
| --- | --- | --- | --- |
| | Known / new / needs investigation | | |

Summarise task difficulty, assistance and feedback usefulness without copying the
plan. Gustavo owns synthesis and prioritisation under RPA-7. These manual records
do not complete RPA-79's later event storage/export requirements.
