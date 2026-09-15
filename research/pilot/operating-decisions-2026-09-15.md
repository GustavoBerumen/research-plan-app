# RPA-80 operating decision sheet — 15 September 2026

These are proposals for Max/Gustavo's consolidated review, not configured services
or newly accepted policy. Keep decisions on RPA-80 under RPA-88. The tested MVP is
two declarations, dated sign-offs and final Send. Full remote sequential approval,
accounts and email delivery are deferred. AI quality is never a submission gate.

## Preserve settled decisions

- JSON is the draft/backup representation; partial drafts remain local.
- Private R2 is the selected technology for completed plans; exact trial bucket,
  jurisdiction, notice and production operating arrangements remain to approve.
- Max owns hosting, deployment, technical recovery and rollback. Gustavo owns
  sessions, covers agreed costs and has AI-stop authority.
- The earlier private review/return policy is Gustavo-owned Drive, Gus and Max
  as readers, one isolated participant session folder, explicit receipt, and
  deletion four weeks after the final session or earlier on request to Gustavo.
  Actual folder access still needs verification; the owner-only synthetic Drive
  backup exercise did not prove participant isolation or Gustavo's access.
- Preserve the US$3/month AI cap and auto-reload Off. Do not reuse a historical
  higher allowance. No provider or sharing settings were changed here.

## Decisions to confirm together

| Decision | Concrete proposed arrangement | Remaining evidence / owner |
| --- | --- | --- |
| Trial destination and location | A dedicated private R2 trial bucket and distinct deployment/cohort; keep `rpa64-storage-test` synthetic-only. Keep Render in Oregon. Choose the actual R2 jurisdiction before creating the trial bucket; record every processor/location honestly | Max + Gus approve jurisdiction. WNAM is a best-effort location hint, not a residency guarantee. If EU-only handling is required, review the entire Render/AI/backup path before collecting content |
| Access | Shared pilot login for invitees; bucket-scoped runtime token; separate read-only operator and controlled maintenance token. Gus and Max can read approved exports; participants see only their own private review/return files | Max verifies credential separation; Gus confirms session-folder identities/isolation. No public bucket URL or shared parent link |
| Notice/content | Use the draft below after replacing bracketed values. Use invented or participant-owned nonconfidential plans for this small trial; no unnecessary personal/client data | Gus approves spoken/written notice and acknowledgement; Max checks the UI notice equals versioned cohort metadata |
| Review/return | After a stored-plan receipt, an operator exports a v8 plan to the approved private session location. Gus restores/reviews/edits and returns a new JSON copy; author backs up and restores | A Send receipt is not email or reviewer acknowledgement. Exports omit local email/review ledger; do not promise their recovery from R2 |
| AI cost response | Keep US$3/month, reload Off, Haiku 4.5. Max checks usage before/after sessions and technical probes; Gus can call a stop; Max executes. Propose an alert at US$2 if supported and approved | Name a deputy/contact route and response window. No monetary limit is implemented by request-rate counters; changing alerts needs approval |
| Storage cost response | For a 5–10-person trial, propose daily usage inspection and pause/investigate at 100 MiB content or any unexpected charge; propose US$1/month R2 review threshold, separate from hosting | Gus approves amounts; Max verifies available billing alerts and can pause collection. These are operator triggers, not a provider-enforced hard cap. Existing free allowance is not a guarantee |
| Independent backup | Encrypted export and newest deletion journal after each collection session/day, in an approved restricted Drive backup folder independent of R2; verify downloaded hashes and recovery before relying on it | Max proposed primary backup operator; Gus proposed recovery deputy. Confirm actual folder, access and retention. An owner-only folder on Max's account alone does not give Gus recovery capability |
| Passphrase custody | Store backup passphrase separately from backup files/R2 and outside Render, in a password manager with an approved independent custodian | Confirm primary/deputy and controlled recovery method. Do not place passphrases in Jira, Git, chat or the backup folder. CurrentUser DPAPI alone depends on Max's Windows account/device |
| Deletion and close-out | Gus receives requests and confirms the actual final session; Max pauses/drains, journals/tombstones, exports newest journal, and removes affected external copies. At final-session + 28 days purge primary and independent content plus working copies/notes | Name deputy and due-date reminder owner. No purge scheduler is deployed. Keep content-free tombstones/journals only while older backups/retries could resurrect data. Verify team-held trash/revisions as well as live files |
| Tool feedback | Resolve existing RPA-98 local-file collection before participant use: explicitly approve its notice and verified export/deletion procedure, or gate it in a small reviewed change | Recommended for the shortest controlled trial: gate server feedback collection and use approved manual RPA-79 notes until durable handling is settled. This is a proposal; no feature was removed or new ticket created |

[Cloudflare's location documentation](https://developers.cloudflare.com/r2/reference/data-location/)
distinguishes best-effort location hints from jurisdictional restrictions. R2-only
jurisdiction does not control Render processing, AI requests or Google Drive copies.

## Participant notice draft — complete before use

> This is an invited research-plan trial run by Gustavo and Max. Your unfinished
> draft is saved in this browser and site. Your email and local review history stay
> in your browser and downloaded backup; this app does not send email. If you choose
> AI evaluation or suggestions, relevant writing/context goes through our Render
> service in Oregon to Anthropic. You can continue writing without AI.
>
> When enabled, **Send plan** sends the completed active plan, declarations and
> dated initials to our private Cloudflare R2 storage in [approved jurisdiction and
> location description]. It records a reference, receipt time, version and integrity
> data. It does not send attachment files, your browser email, review history or AI
> results. Reference metadata may include filenames or links. A receipt confirms
> storage; Gustavo's review and any return of edits happen separately through your
> private session folder. Use only the content agreed for this session.
>
> Gustavo and Max can read the collected plans and agreed session notes. Encrypted
> recovery copies are held in [approved independent destination/location] by
> [named operators]. Other participants must not have access. We delete team-held
> plan content, revisions, backups and notes 28 days after the last session, or
> earlier on request to Gustavo via [private contact]. Your own device/browser
> copies stay under your control. Content-free deletion records can remain while
> needed to prevent old backups or retries from recreating deleted content.
>
> [If tool feedback remains enabled: choosing **Send feedback** sends your score,
> answers and plan title, with section/build/time, to the team's Render service.
> State the approved handling, retention and recovery limitation here. Do not imply
> it uses R2 or has a durable plan receipt. If it is gated, use the approved manual
> feedback notice instead.] You may decline a task, pause or stop. We will confirm
> your acknowledgement before collecting content, using AI or taking session notes.

This draft must match the chosen enabled features and actual provider arrangements.
Do not put bracketed text into `RPA_SUBMISSIONS_NOTICE`, initialise a real cohort,
or distribute this draft to participants as final policy.

## One consolidated response needed

Confirm the proposed owners/thresholds and storage jurisdiction, identify the
approved private backup/review destinations and independent passphrase custodian,
choose how to handle tool feedback, and confirm Thursday's session time.
Max/Gus waived discussion-guide reconciliation; no guide reference is needed.
Private credentials are entered in provider/password
manager controls, never supplied in chat. Deployment and collection approval remain
separate from these operating choices.
