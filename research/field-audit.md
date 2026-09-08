# Field audit — RPA-55

Every field in `research-plan-template.md` put through Caroline Jarrett's
question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,
what goes, and what is being asked at the wrong moment.

**Status: complete. All 31 verdicts are in.** The field list, types and hint text
are generated from the template. Question 1 was filled from what the app
demonstrably consumes; questions 2 and 3 from the template, the field order and
how the app behaves.

The six rows that held out longest all failed question 1 the same way — nothing
in the app consumed them — and **not one of them was resolved by deleting it.**
See *How the last rows were settled* below. Question 1 turned out to be the
weakest of the three for finding cuts, because it measures the tool as much as
the field. The single cut on the sheet came from question 3.

The two Action Points columns left that list without one. Their answer to "no
in-app consumer" was to build the consumer rather than to cut the question —
see *Action Points* below. It is the pattern worth trying on the rows that
remain: **before cutting a field for having no reader, ask what would have to
exist for it to have one.**

Question 1 is deliberately last. It asks what decision depends on each answer,
which is the one thing that cannot be inferred from the form: it needs the people
who read these plans. Questions 2 and 3 could be reasoned out from the template,
the field order and how the app behaves.

## How to use this

For each field, answer three questions. A field that cannot answer all three is a
candidate to lose or move:

1. **Why do we need this?** What decision or output depends on the answer? "It
   would be nice to know" is not an answer.
2. **Who has the answer?** Is the person filling the form the person who knows?
3. **Are they able and willing to give it?** Do they have it to hand *at the point
   we ask*, or must they go and find it?

Verdicts: **keep** · **cut** · **merge** (into another field) · **optional** ·
**move** (right question, wrong place)

A verdict of *move* is as valuable as *cut*. Per RPA-55, sequencing is half the
problem — a field can be necessary and still be asked at the wrong moment.

### One row per question, not per field

Settled: **a table column is a question, so it gets its own row** — with one
exception.

`Requirements` is declared `editable-headers` in the template, so Physical,
Digital and Approvals are *default labels the user can rename*, not questions
the form asks. There is nothing to cut: a column someone can retitle is not a
fixed question. It stays a single row, and its verdict is about the defaults.

`Stage Timeline`, `Action Points` and `Previous Knowledge` have fixed columns.
Every one of them is a question asked of every user, every time, so each is
audited on its own line.

This is what lets the sheet express the two column-level recommendations below.
It also sharpens them: *Action Points → Status* is a straightforward column cut,
whereas *Requirements → Approvals* is not a cut at all but a proposal to promote
a renameable default into a field of its own.

## Scoreboard

Fill in as verdicts are reached.

| Verdict | Count |
|---|---|
| keep | 20 |
| cut | 1 |
| merge | 0 |
| optional | 5 |
| move | 5 |
| undecided | 0 |
| **total** | **31** |

31 rather than 25: the three fixed-column tables are audited per column, per the
unit rule above. Requirements left the sheet when it was made dormant — hidden,
not decided; its reasoning is under *Already dormant*.

It was 30 until User Groups came back. The sheet's one *merge* was reversed —
Characteristics and User Groups are two questions again — so that row returned
and the merge count went to zero. A verdict is not a ratchet: this one was made
from the template and overturned by the researcher who runs the studies, which
is the right way round.

## What is left

The verdicts are done. Three recommendations are not, and each has a home so that
none of them lives only here:

| # | What | Where it goes |
|---|---|---|
| 1 | Prefill Background, Goal and Problem Statement from the linked Jira issue, instead of asking a researcher to retype a brief that already exists. | **Still needs a ticket.** Blocked on a real constraint: the proxy calls `issue/picker`, which returns key and summary only, so descriptions need a second endpoint. |
| 2b | Create Jira subtasks from Action Points, which is the consumer those two columns were kept for. | **RPA-69.** Settle first whether the team accepts tickets reported by a shared service account — the answer decides whether this is a day's work or per-user OAuth. |
| 4 | Give Previous Knowledge a source — link it to the shared Drive research library. | **RPA-71.** The optional half is done; marking a field optional stops it blocking anyone without making the answer easier to find. |

Recommendation 3 is deferred rather than open, and deliberately: moving Context is
blocked behind #1, because the complaint about Context is that it is transcription
rather than that it is first. Everything else is closed.

## How the last rows were settled

Six rows held out to the end. Every one passed question 2 — somebody knew the
answer — and failed question 1 in the only way code can measure it: **nothing in
the app consumed the value.**

That turned out not to be a verdict. A field can matter to a human reader and be
used by nothing in the tool, or the tool can be ignoring information it already
collects. The question that settled them was not *should this go?* but:

> **Nothing in the tool uses this. What would have to exist for something to?**

None of the six was resolved by deleting it:

- **Action Points → Action and → Responsible: kept.** "Nothing uses this" turned
  out to mean nothing uses it *yet*. The answer was to build the consumer.
- **Characteristics: kept, and User Groups restored with it.** The reader was
  recruitment all along. The tool not consuming a value says nothing about
  whether a person does.
- **Previous Knowledge → Name and → File: optional.** Question 3 settled these,
  not question 1. A field nobody can answer at the moment it is asked does not
  have to be deleted; it has to stop blocking.

- **Feedback: moved** into the review step, above the approvals. Its missing
  reader was a placement problem — a section of its own at the end of the
  document was nobody's stop.

Four different answers to the same failing question, and none of them a cut. The
one field that was cut — Action Points → Status — failed question 3, not
question 1: it was unanswerable at the moment it was asked and wrong the day
after sign-off.

**That is the finding worth carrying out of this audit.** "Nothing uses this"
identifies where the tool is thin, not which questions are surplus. The question
that finds real cuts is *can the person in front of the form actually answer this,
here, now?*

## Header (document meta)

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Research title** | `text` | Identifies the plan everywhere it is listed, shared or printed. | Researcher — naming their own plan. | Able, but usually **last**. You name a plan once you know what it is; this is asked first. | **move** — later. Named once the plan exists, not before it. |
| **Jira Project** | `text` | Links plan to ticket; the picker resolves it live. | Project side owns the key, but the picker now fetches it, so the researcher no longer has to know it. | Yes — the picker searches, so recall is not required. | **keep** — the picker removed the recall cost. |
| **Lead researcher**<br><sub>asks: Name</sub> | `text` | Attribution, and the sign-off pair reads the name from here. | Researcher (self). | Yes — zero effort. | **keep** |
| **Project requester**<br><sub>asks: Name</sub> | `text` | Attribution; names the approver for sign-off. | Researcher knows the name. | Yes — zero effort. | **keep** |
| **Last updated** | `date` | Tells a reader how current the plan is. Computed. | Nobody — computed. Already *move*. | N/A — computed, never asked. | **move** — **done, and verified in the app this time.** It reads as a dateline in the header corner. It stays editable at Gus's request, so the sentence itself is the control: activating it swaps in the date editor in place, with no separate Change link. |
| **Project decision** | `date` | **Feeds the deadline check** — warns when reporting lands less than a week before it. Also the reason the study has a deadline at all. | ⚠ **Project Owner.** A delivery date the researcher does not set. | ⚠ **Often not yet fixed.** Must be chased from someone else, and research planning frequently precedes the date being set. A blocker disguised as a date field. | **keep — sourced.** Load-bearing (feeds the deadline check) but routinely unanswerable at the moment it is asked. The verdict used to read "sourced **or** optional"; the optional half was put to Gus under recommendation 5 and declined, so this is a required question and the answer is to pull it from the linked Jira issue. Nothing blocks on it in the meantime — the form has no validation — so an unanswered date costs the deadline warning, not the plan. **Reorder done:** now in the header beside the names, so the constraint is visible before any section is written. |
| **Research readout** | `date` | **Feeds the deadline check** (the other side of it), and sets the delivery expectation. | Researcher — their own commitment. | ⚠ Able, but asked early — a delivery commitment made before the method is chosen in Methodology. | **keep** — the sequencing complaint is the form's order, not this field. Proposed as optional under recommendation 5 and declined; question 3 flags the *timing* here rather than the ability, and the answer to a timing complaint is order, not a marker. **Reorder done:** now in the header beside Project Decision, where a deadline belongs. |

## Alignment

*Now the last section (reorder done, RPA-55). The two deadlines moved up into the header table above.*

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Sign off: Lead researcher**<br><sub>asks: Type initials</sub> | `text` | Records approval to proceed. | Researcher (self) — but see timing. | ⚠ Willing, but not yet — there is no plan to sign. Already *move*. | **move** — **done.** The review step exists and both sign-offs are in it. |
| **Sign off: Project requester**<br><sub>asks: Type initials</sub> | `text` | Records approval to proceed. | ⚠ **The Project Owner, by name.** The researcher cannot answer this one at all. | ⚠ **No.** Not the researcher's to give. Alignment now closes the form (reorder done), so there is at least a plan to approve — but the approver is still not the person filling it in. Already *move*. | **move** — **done.** The review step exists and both sign-offs are in it. |

## Context

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Background**<br><sub>asks: Relevant information to understand the project</sub> | `textarea`<br><sub>eval</sub> | **Feeds the framework suggester** and is scored by the rubric. Something does depend on it — which argues for sourcing it, not cutting it. | ⚠ Project side. The researcher transcribes it rather than knows it. | Able by transcription, and that is the problem: retyping a brief that already exists. Low willingness, and invites paraphrase drift. | **keep — source it.** Feeds the framework suggester, so it is needed; but it is transcription. Prefill from the linked Jira issue (recommendation 1). The output is a follow-up ticket, not a cut. |
| **Goal**<br><sub>asks: Aim of the project and the outcomes you are trying to achieve</sub> | `textarea`<br><sub>eval</sub> | **Feeds the framework suggester**; scored by the rubric. Same argument: source it rather than ask for it again. | ⚠ **Project Owner.** This is the project's goal, not the research's. | ⚠ Able only by copying. If the brief is vague the researcher invents the project's goal — worse than leaving it blank. | **keep — source it.** As Background. Bad transcription here degrades an AI feature's input, which makes sourcing a quality fix, not a convenience. |
| **Problem Statement**<br><sub>asks: Issues requiring attention that could prevent the project achieving…</sub> | `textarea`<br><sub>eval</sub> | **Feeds the framework suggester**; scored by the rubric. | ⚠ Project side — usually the reason research was commissioned in the first place. | Usually findable, being the reason research was commissioned. Still transcription rather than authorship. | **keep — source it.** As Background. |

## Research

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Objective**<br><sub>asks: Purpose and high-level goals of the research</sub> | `textarea`<br><sub>eval</sub> | **Feeds the methods suggester** and is scored by the rubric. | Researcher — core expertise. | Yes — this is what they came to write. | **keep** — the researcher's core contribution. |
| **Hypothesis**<br><sub>asks: Baseline assumptions to be tested during the study</sub> | `textarea`<br><sub>optional, eval</sub> | Feeds the framework suggester; scored by the rubric. | Researcher. | Sometimes. Many studies have none; already optional, correctly. | **optional** — confirmed. Many studies have none. |
| **Research Questions**<br><sub>asks: What do you want to understand?</sub> | `list`<br><sub>eval</sub> | **The load-bearing field.** Feeds the methods and framework suggesters, drives the Methods grouping, and pairs 1:1 with Outcomes. More depends on this than on anything else. | Researcher. | Yes — core expertise, and the reason they opened the form. | **keep** — core; the reason the form is opened. |
| **Outcomes**<br><sub>asks: Deliverable for this question</sub> | `list`<br><sub>eval</sub> | Scored by the rubric, and paired 1:1 with Research Questions — the pairing is what makes each question answerable. | Researcher — tracks Research Questions 1:1. | Able, but asked before methods are chosen, so the deliverable is guessed and then revised. | **keep** — not *move*, deliberately: it is bound 1:1 to Research Questions, and moving it after Methods would break the pairing that gives it its value. The timing complaint is the form's order, handled by the reorder. |

## Methodology

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Theory**<br><sub>asks: Any useful framework that can guide our research</sub> | `textarea`<br><sub>optional</sub> | Grounds the design; the framework suggester writes into it. | Researcher. | Often not to hand. Already optional, and the suggester exists precisely because recall is unreliable here. | **optional** — confirmed. Rarely to hand. |
| **Methods**<br><sub>asks: Search or type a method</sub> | `list` | The study design itself — what the plan exists to state. | Researcher — core expertise. | Yes — core expertise, with a 125-item list and a suggester behind it. | **keep** — core expertise, well supported. |
| **Characteristics**<br><sub>in *Participants*</sub><br><sub>asks: who to recruit</sub> | `list` | ⚠ No in-app consumer. Recruitment screening, and since RPA-55 also the segments to represent — needs a reader to confirm either. | Researcher; recruitment/ops may hold the real numbers, product may own segment names. | Roughly, yes. Precise figures usually sit with recruitment. | **keep — and the merge is reversed.** The merge argued that both fields wanted a short noun phrase naming a kind of person. True of the format, wrong about the function: a screener criterion filters who is eligible, a segment sets who must be represented among those who are. One is a filter, the other a quota, and a study can get the first right and the second wrong. Gus reversed it as the researcher who runs these studies, which outranks an inference drawn from the template. The hints now hold the line and a test objects if they ever collapse together again. Drafts saved while the fields were one keep everything in Characteristics: which entries had been segments was never recorded, so the split is forward-looking only. |
| **User Groups**<br><sub>in *Participants*</sub><br><sub>asks: which segments to represent</sub> | `list` | ⚠ No in-app consumer. Sets the sampling quota — who must be present among the people recruited, which is a different instrument from the screener above it. Needs a reader to confirm, like its neighbour. | Researcher, usually with product: segment names are often the product's rather than research's. | Yes for the names; the numbers behind a quota usually sit with recruitment. | **keep** — restored. It was merged into Characteristics earlier in RPA-55 and split back out: filtering who is eligible and setting who must be represented are two questions, and a study can answer the first well and the second badly. |
| **Sample Size**<br><sub>in *Participants*</sub><br><sub>asks: Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)</sub> | `radios` | Sets recruitment effort and the confidence the study can claim. | Researcher. | Yes — a four-option dropdown, near-zero cost. | **keep** — drives recruitment; four-option dropdown. |

## Execution

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Stage Timeline → Stage** | `select` | **Labels the rows of the timeline visualisation.** | Researcher — their own plan. | Yes — a five-option dropdown. | **keep** |
| **Stage Timeline → Start Date** | `date` | **Drives the timeline visualisation** and the start-before-completion constraint. | ⚠ Researcher proposes; recruitment decides whether it holds. | ⚠ A proposal, not a commitment. Depends on recruitment lead times the researcher does not control. | **keep** — a planned date, like every date in a plan. Say so in the hint so the printed document is not read as a commitment. Proposed as optional under recommendation 5 and declined: a schedule is part of what makes a plan reviewable. |
| **Stage Timeline → Completion Date** | `date` | **Drives the timeline visualisation** and the same constraint. | ⚠ As above — a forecast, not a fact. | ⚠ Weaker still — a forecast derived from a forecast. | **keep** — same note as Start Date. |
| **Action Points → Action** | `prose` | ⚠ No in-app consumer *yet*. Overlaps what Jira already tracks — which is the argument for feeding Jira from it, not for asking twice. | Researcher. | Yes. | **keep — pending its consumer.** The plan is where the work is decided; Jira is where it is tracked. The integration below makes this column the input to creating the subtask, which is the consumer it lacks. |
| **Action Points → Responsible** | `prose` | ⚠ No in-app consumer *yet*. Overlaps Jira assignees. | ⚠ Names other people. Commits someone who is not in the room. | ⚠ Able to type a name; not able to secure the commitment. Records an obligation the named person has not agreed to. | **keep — pending its consumer, and question 3 stays open.** An assignee is half of an action, so cutting it leaves work with no owner. The integration answers question 1 and **does not answer question 3**: creating a Jira subtask still commits someone who was not asked. It arguably raises the stakes — a name in a document is a note, a ticket in a queue is a claim on someone's time. The mitigation is that Jira makes the commitment visible and refusable, which a printed plan does not. Becoming a person picker is part of that work. |
| **Action Points → Status** | `status` | ⚠ **Nothing.** No consumer in the app, and a signed document cannot hold live state. | ⚠ Nobody, at authoring time. It changes after the plan is written. | ⚠ **Unanswerable here.** Nothing has happened yet. Any value is wrong the day after signing. | **cut** — **done.** Removed from the template, so the table asks two questions. The only row so far to fail all three questions at once. The `status` column type stays part of the template language and keeps its coverage from a fixture. |
| **Previous Knowledge → Name** | `prose` | ⚠ No in-app consumer. Meant to prevent repeating past work — the intent is good, the mechanism is absent. | ⚠ Often nobody's job. "What research already exists" is the classic unowned question. | ⚠ High effort, low willingness. Requires searching past work with no repository to search — the field most likely to be left blank. | **optional** — **done.** Question 3 decided this one. The field stays for the people who have something to hand, and stops being a wall for everyone else. Marking it honestly is not the same as giving it a source, which is still open — see recommendation 4. |
| **Previous Knowledge → File** | `file` | ⚠ No in-app consumer beyond storing the upload. | ⚠ Harder than the name: needs the artefact to hand, not just its title. | ⚠ Harder again: needs the artefact itself, not just its title. | **optional** — **done.** With the Name column, since the two are one row of one table and cannot be optional separately. The harder half of an already-hard question. |
| **Additional information**<br><sub>was *Additional Resources*</sub> | `custom-fields` | Escape hatch for anything the template did not anticipate. Also evidence: what people add here is a record of what the form is missing, which is why there is one of these rather than one per section. | Researcher — open-ended by definition. | Yes when they have something; the field only appears on demand. | **optional** — confirmed, and **fixed.** It rendered as a bare "+ Add additional section" button: no label, no hint, and sitting in Execution only because the Resources section was folded there. It has a label and a hint now, and renders after the sections rather than inside one, because "what the template did not anticipate about Execution specifically" is not a question anyone is asking. GOV.UK has no pattern for a user-defined field — every *Ask users for* pattern is for a known thing — so one, scoped to the plan, is as far as this should go. |

*The Resources section was folded into Execution (RPA-55): two fields did not
earn a section of their own.*

## Feedback

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Feedback**<br><sub>asks: Anything you'd like to say, any question you'd like to add, or some…</sub> | `textarea`<br><sub>optional</sub> | ⚠ **Nothing, and nobody.** No consumer and no defined reader — the only field failing both. | Whoever is filling it — but no defined reader. | Able, but why? No defined reader, so willingness is the open question — not capability. | **move** — **done.** Into the review step, above the approvals. The reader problem was a placement problem: a section of its own at the end of the document was nobody's stop, whereas the review step is the one moment somebody reads the plan rather than writes it. Above the sign-offs, because feedback offered after approval has missed its moment. It keeps the key `comments`, so no saved draft moved. |

## First pass: who has the answer?

Question 2 filled in for all 28 fields. The pattern that falls out is sharper than
any individual row.

**The form has one filler and at least four answerers.** The researcher completes
it end to end, but 8 of the 28 fields are owned by somebody else: the Project
Owner, legal/privacy, IT, and whoever a task gets assigned to. Every one of those
is a point where the form asks a person to speak for someone not in the room.

Three clusters, in descending order of how much they matter:

1. **Context is the project's knowledge, not the researcher's.** All three
   fields — Background, Goal, Problem Statement — are owned by the project side.
   That is not an argument to cut them: a plan without them is unreadable. It is an
   argument that they are being *retyped* rather than *sourced*. If they already
   exist in the project ticket, asking a researcher to paraphrase them is a
   transcription task wearing the costume of a question. Worth asking whether these
   should be pulled in from the Jira project rather than typed.

2. **Two fields hold values that change after sign-off.** Requirements/Approvals
   and Action Points/Status are operational state, not plan content. A document
   that gets signed and printed cannot also be a live tracker — whatever it says
   about status is wrong the day after it is signed. This is a *move*
   (to wherever tracking actually happens), not a cut.

3. **Sign off: Project requester names an answerer who is not the filler**, in section
   two of seven. The template states the problem in its own label. This is the
   strongest evidence for the relocation RPA-55 already decided, and it did not
   need the audit to find it — the field was self-evidently misplaced.

**Previous Knowledge deserves its own line.** "What research already exists?" is
the question nobody in an organisation owns. The researcher is asked it because
they are the one filling the form, not because they are the one who knows. If the
answer is meant to be reliable it needs a source, and if it is not meant to be
reliable it is worth asking what it is for.

**The comfortable finding:** the entire Research and Methodology block — Objective,
Hypothesis, Research Questions, Outcomes, Theory, Methods, Sample Size — is
squarely the researcher's own expertise. Eleven fields where the filler is
unambiguously the knower. Whatever this audit cuts, it is unlikely to be here.

## Recommendations (provisional)

Drawn from the question-2 pass, the RPA-54 prototype findings, and ADR 001.
**Questions 1 and 3 are not done, and question 3 is where cuts usually come from**
— so this list leans towards *move*, *source* and *optional* rather than deletion.
Treat it as the opening argument, not the conclusion.

Ordered by how much each changes the form.

### 1. Stop retyping Context — source it

Background, Goal and Problem Statement are all owned by the project side. A Jira
connector already exists on the Jira Project field (`server.js`, `/api/jira/search`).
Pull these three from the linked issue instead of asking a researcher to paraphrase
them. Failing that, change the hints to say "paste from the project brief" — an
honest transcription task beats a question that only looks like one.

*Constraint:* the proxy currently calls `issue/picker`, which returns key and
summary only. Prefilling descriptions needs a second endpoint.

### 2. Take live state out of a signed document

- **Action Points → Status: cut. Done.** The plan holds the action and its owner;
  status belongs in Jira. A signed, printed document that claims to know status is
  wrong the day after it is signed. Removed from the template, so the table now asks
  two questions rather than three. The `status` column type remains part of the
  template language and keeps its coverage from a fixture, so cutting the column did
  not quietly delete the capability.
- **Requirements → split Approvals out.** Physical and Digital are the researcher's.
  Approvals is legal/privacy — a different answerer, a different timeline, and
  usually the thing that actually blocks a study. It is currently hiding as a third
  column of a table about equipment.

### 2b. Give Action Points its consumer — connect it to Jira

The cut above only removed the column that could not be answered. The two that
remain were kept on a promise, and this is the promise.

Action and Responsible fail question 1 today for a reason that is fixable rather
than fatal: the plan is where the work gets decided, and Jira is where it gets
tracked, and nothing carries it across. So it gets typed twice, or once and then
forgotten. **Make the table the input to creating the work.**

Most of the plumbing exists. `server.js` already proxies Jira with the token kept
server-side, the plan already stores a real ticket key in Jira Project, which gives
a subtask its parent, and the ticket combobox is a pattern already built twice.
Creating a subtask is one more call to the same API; assigning needs a second
lookup to turn a name into an account.

Four things change, and they are the decision rather than the code:

- **Read becomes write.** Every Jira call so far is a search. Creating tickets from
  a draft document means an explicit action, never autosave, and each row recording
  the key it created so pressing it twice does not duplicate the work.
- **The tickets would be reported by the wrong person.** One API token is one
  account, so every subtask shows a service account as reporter rather than the
  researcher. Per-user OAuth fixes it and costs an order of magnitude more. **Settle
  this before writing any code** — it is a Jira administration decision, and the
  answer determines the size of the build.
- **Responsible stops being prose.** Assigning requires picking a real user, so the
  column becomes a person picker over the same proxy.
- **Where the button lives.** After sign-off, in the review step, fits the grain of
  the document better than a button inside an unsigned draft. Approving the plan is
  the moment the actions become real.

**What it does not fix.** Question 3 on Responsible stays open, and see that row:
assigning a ticket to someone who was not in the room is still committing them.
Visible and refusable beats invisible, but it is a mitigation and not an answer.

*Scope for a first version:* one action per row that creates a subtask under the
plan's ticket and writes the key back as a chip, reusing the Jira Project chip
styling. Roughly a day against a shared account; considerably more against OAuth.

### 3. Fix the opening sequence

The first two sections, Alignment and Context, are the ones the researcher
is least able to complete alone. The sections they own outright start at number
three. The ordering principle is to open with what people can answer; this form
does the opposite. Consider opening with Research, and letting the admin and
project-context fields follow or arrive prefilled per #1.

**Half done, and the rest deliberately deferred.** Alignment is gone — it became
the review step and moved to the end, so the form no longer opens by asking for
approvals. Context is still first, and Gus's decision is to leave it there until
recommendation 1 lands.

The reasoning: the complaint about Context is not its position but that it is
transcription. If Background, Goal and Problem Statement arrive prefilled from the
linked Jira issue, Context stops being a wall and the reorder is solving a problem
that no longer exists. Reordering first would also cost the reader something real —
a finished plan reads better with the background before the questions — for a
writer-side gain that prefilling may deliver anyway.

So this is blocked on #1 rather than open. Revisit it if #1 turns out not to be
feasible, since the constraint noted there is real: the proxy calls `issue/picker`,
which returns key and summary only.

### 4. Give Previous Knowledge a source, or make it optional

Nobody owns "what research already exists". `research/README.md` already points at
a shared Drive research library — either link the field to it, or accept the field
is aspirational and mark it optional.

**The second half is done: both columns are optional.** The first half is not, and
the two are not substitutes. Marking it optional stops the field blocking anyone;
it does not make the answer any easier to find for the people who want to give one.
Linking it to the Drive library is still the change that would earn the question.

### 5. Apply the optionality convention properly — settled

**5 of 26 fields are optional, and that is the final set:** Hypothesis, Theory,
Action Points, Previous Knowledge and Feedback. Nothing further is added.

This recommendation opened by predicting the opposite. It said 3 of 25 was "almost
certainly understated" on a form of this length. Four more were put forward as
candidates, each one flagged on question 3 — Project decision, Stage Timeline,
Research readout and Goal — and Gus's answer was that all four are required.

That is the third inference this audit drew from reading the template and had
overturned by the person who runs these studies, after Project (cut against a
*keep*) and the Characteristics merge (reversed). The pattern is consistent enough
to be worth stating: **the sheet is good at finding what a form cannot answer and
poor at judging what a team is willing to leave blank.** The first is a property of
the form and can be read off it. The second is a property of the practice and
cannot.

**The framing was also wrong, and GOV.UK is clear about it.** This recommendation
argued optionality was "the cheapest way to make the form feel shorter without
cutting anything". The service manual does not offer that: its answers to a form
feeling long are to eliminate the question, or to use branching so people only see
what applies to them. Marking a required question optional to make a form feel
shorter is mislabelling it.

So optionality is a correctness goal, not a length one — the marker states which
questions may honestly be skipped. That matters more here than in a government
service, because **this form has no validation at all.** Nothing blocks, nothing is
enforced, and a plan can be printed and signed entirely blank. "(optional)" is
purely communicative, which makes over-marking a real cost: a form where a third of
the labels say optional reads as a form that does not care what you put in it.

**That changes with RPA-64**, which adds Finish / Send with required-field
validation. At that point this decision stops being communicative and starts being
enforced: every field not on the list of five becomes something a plan can be
blocked on. Worth re-reading this section when that ticket is picked up — the
answers here were given about a form that asks, not a form that insists, and
Project decision in particular is a date the researcher does not set.

Counts checked against the template rather than carried forward. The earlier figure
of 28 predated the Status cut, the User Groups merge and Requirements going dormant.

**The mechanism is fixed; the convention is not yet applied.** Marking Previous
Knowledge optional revealed that the flag was unreliable: each builder drew the
"(optional)" marker inline, so the ones that never did were invisible. Declaring
`optional` on a table, on Outcomes, or on any header field parsed fine, rendered
fine and produced nothing — and Previous Knowledge is a table, so it was the first
field to hit it. It is one helper now, called from every builder with a label to
hang it on, and a test derives its cases from the template so a field type added
later is covered without anyone remembering.

**The mechanism is worth keeping even though the list did not grow.** Two of the
five optional fields — Action Points and Previous Knowledge — are a table and a
table, and both would have accepted the flag and rendered nothing before the fix.
So would Project decision, the header field this recommendation expected to add
next. The bug was real and was found by trying to apply the convention; the
convention then turned out not to need applying any further.

Nothing here is still open.

### 6. Decide who reads Feedback

The one field with no defined reader. Renaming Comments to Feedback named a writer
and a subject — feedback on the plan — but still not a reader, so the question is
unchanged by the rename. Either name its audience in the hint, or cut it.

**Done: moved into the review step**, above the approvals. The reader problem
turned out to be a placement problem. A section of its own at the end of the
document was nobody's stop; the review step is the one moment somebody reads the
plan rather than writes it, so it is the one moment a comment on it has an
audience. Above the sign-offs, because feedback offered after approval has missed
its moment.

The field keeps the key `comments` — labels and keys are independent since the
`key=` work — so nothing in a saved draft moved.

The move also exposed a bug worth recording: a plan saved with feedback in it
reopened with the field hidden behind "+ Add feedback". The value was restored and
invisible. That was survivable while this sat in a section of its own and is not,
now that the whole point is to be read at review time.

### 7. Sign-off pair and Last Updated

Already decided in RPA-55, and both are now built: the review step exists with both
approvals in it, and Last Updated reads as a dateline. Neither claim is inherited
from a prototype this time; both were checked against the running app.

### 8. Small and unambiguous

**Sample Size has no hint text** — its placeholder slot is consumed by the option
list. Every other field explains itself; this one does not. **Fixed:** hints moved
out of the placeholder slot into their own `Hint:` line (RPA-58), so it has one now
— "The number of participants needed for this study." The field is also radios
rather than a dropdown, since GOV.UK treats a select as a last resort and five
options that form a scale read better all at once.

### Shape of the finished sheet

Predicted: two cuts, three or four moves, several made optional, the great
majority *keep*.

Actual: **one cut, five moves, five optional, twenty keep**, out of 31.

Close enough that the prediction was not the interesting part. What the sheet
turned out to measure was this: a plan that felt too long had almost nothing
surplus in it. One question genuinely could not be answered. Everything else was
in the wrong place, unmarked as optional, or waiting on plumbing the tool did not
have. ADR 001 said the problem was orientation rather than scope, and the sheet
agrees more strongly than expected.

Two things are worth carrying forward:

**Question 1 is the weakest of the three for finding cuts.** "Nothing in the app
consumes this" measures the tool as much as the field, and every row that failed
only question 1 survived. The cut came from question 3 — *can the person in front
of the form answer this, here, now?* That is the question to lead with next time.

**A verdict is evidence, not a ratchet.** Two were overturned: Project was cut
against a *keep*, and the Characteristics/User Groups merge was reversed. Both
reversals came from someone who knew the practice better than the sheet did.

### Decision needed before verdicts go in — settled

One row per *question*, not per field: fixed table columns are audited
individually, and `Requirements` stays whole because its headers are editable.
See "One row per question, not per field" above. The sheet can now express both
column-level recommendations, and the distinction sharpened them — 2a is a
column cut, 2b is a promotion rather than a cut at all.

## Already dormant

Commented out in the template — the form has been trimmed before. Worth reading
before cutting more: if one of these was removed for a reason, that reason
probably applies to its neighbours too.

**Project was cut, against its verdict (RPA-55).** Its row said *keep* — ties the plan
to the initiative it serves, low effort, answer to hand. It went anyway because Jira
Project covers the same ground: the ticket identifies the initiative, and its hint now
says so. A verdict is evidence, not a veto.

**Requirements was hidden, not decided (RPA-55).** Its verdict was still open:
no in-app consumer, and the question splits three ways — Physical is the
researcher's, Digital needs IT, Approvals needs legal or privacy and is
routinely unknown when planning. The risk flagged there was willingness
without knowledge, a confident guess at approvals. If it comes back, that is
the problem to solve, and splitting Approvals out was the proposal.

| Field | Type | Was in |
|---|---|---|
| Project | `textarea` | Alignment |
| Requirements | `table` | Execution |
| Research Team | `text` | Header (document meta) |
| Area | `text` | Alignment |
| Jira Research | `text` | Alignment |
| Timeframe | `textarea` | Execution |
| Documentation | `textarea` | Execution |

## Known before we start

Two items RPA-55 records as already decided, carried here so the audit does not
relitigate them:

- **Sign off: Lead researcher / Sign off: Project requester — _move_, done.** They
  sat in Alignment, section two, so people approved a plan that did not yet exist.
  Alignment became the review step once its identifiers moved to the header: what
  was left was the two approvals, and approving is a moment rather than a section.
  The step is not an accordion, so it cannot be collapsed past, and it carries the
  completion-and-currency summary this record asked for. Project decision and
  Research readout are planning inputs, not approvals, and moved to the header.
- **Last Updated — _move_, done.** It reads as a dateline in the header corner
  rather than as a date box. The first time this was marked done it described the
  RPA-54 prototype and not the app; this time it was checked against the running
  form. It remains editable at Gus's request — the sentence is the control, and
  activating it swaps in the editor in place.

## Open question this audit inherits

ADR 001 concluded this app is an application rather than a form, and that "too
long" was probably an orientation problem rather than a scope problem. If that
holds, the win here comes from **sequencing and optionality** rather than deletion,
and a verdict sheet full of *keep* is a legitimate outcome — provided the order
changed. Worth holding open rather than treating a low cut-count as failure.

## Open question this audit created

**Field keys are derived from labels, so renaming a question can silently break
code.** `toCamelKey` turns a label into the key the app stores and queries by, so
"Report Research" was `reportResearch` and "Research readout" is `researchReadout`.
Most of the app never notices, because it reaches fields through the schema — but a
few features query a key by name, and those fail quietly. Renaming that field during
this audit killed the one-week buffer warning and the ceiling on the readout date,
with no error and a form that still rendered perfectly. Two tests went red, and
neither was about the feature that broke.

This matters here specifically: **an audit about rewording and removing questions is
the most likely thing to trigger it.** Every rename ahead of us is another chance.

Mitigated, not solved. `test/rpa-55-field-key-contract.test.js` scans app.js for
every key looked up by name and asserts each one renders, so the failure is now loud
and immediate, and it catches keys this audit has not touched yet. Drafts saved under
an old key are carried over by a migration in `migrateDraft`, as they were for the
Problem → Problem Statement rename.

The real fix was to let a field declare its key in the template, independent of its
label. **Done.** Every field now carries `key=` in `research-plan-template.md`, so
rewording a label cannot change a key. The deferral ran out exactly as written:
reviewing PR #22, Max renamed *Research Questions* and found the form still opened
while Outcomes rendered no rows and Methods stopped tracking — and the first version
of the guard below did not catch it.

Two gaps remain, both known rather than overlooked:

- **Table columns still derive their keys from their labels — RPA-74.** There is no `key=` for
  a column: the column spec is `Label:type=placeholder`, and threading a key through
  it safely is a larger change than it looks. Renaming *Start Date* would still break
  the timeline. The guard is the only protection there — column keys are exposed as
  `data-col-key` and asserted against what the code reads.
- **A guard is a test, not a constraint.** It fails loudly on the next run; it does
  not prevent the mistake.
