# Field audit — RPA-55

Every field in `research-plan-template.md` put through Caroline Jarrett's
question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,
what goes, and what is being asked at the wrong moment.

**Status: questions 1–3 drafted; 30 of 31 verdicts settled.** The field list,
types and hint text are generated from the template. Question 1 is filled from
what the app demonstrably consumes; questions 2 and 3 from the template, the
field order and how the app behaves. **One row is still open — Feedback.** It
shares the property that held up all the others: **no in-app consumer.** It
needs a reader, not a developer — see *For the readers* below.

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
| move | 4 |
| undecided | 1 |
| **total** | **31** |

31 rather than 25: the three fixed-column tables are audited per column, per the
unit rule above. Requirements left the sheet when it was made dormant — hidden,
not decided; its reasoning is under *Already dormant*.

It was 30 until User Groups came back. The sheet's one *merge* was reversed —
Characteristics and User Groups are two questions again — so that row returned
and the merge count went to zero. A verdict is not a ratchet: this one was made
from the template and overturned by the researcher who runs the studies, which
is the right way round.

## For the readers

One row is left open, and it is the last of a list that started at six. It passes
question 2 (someone knows the answer) and fails question 1 in the only way the
code can measure it: **nothing in the app consumes the value.** That is not a
verdict. A field can matter to a human reader and be used by nothing in the
tool — or the tool may be ignoring information it already collects. Both need
a reader to settle.

The question to put to whoever reads these plans, field by field:

> **Nothing in the tool uses this. What do you use it for?**

Anything with an answer is a *keep* (and possibly a feature request: feed it
to the suggesters). Anything nobody can justify is the cut list. Several of
these are also the hardest fields to answer (question 3) — *no consumer and
high effort* is where the genuine cuts live.

How the other five left is the useful part, because none of them left as a cut:

- **Action Points → Action and → Responsible: kept.** "Nothing uses this" turned
  out to mean nothing uses it *yet*. The answer was to build the consumer.
- **Characteristics: kept, and User Groups restored with it.** The reader was
  recruitment all along. The tool not consuming a value says nothing about
  whether a person does.
- **Previous Knowledge → Name and → File: optional.** Question 3 settled these,
  not question 1. A field nobody can answer at the moment it is asked does not
  have to be deleted; it has to stop blocking.

Three different answers to the same failing question, and not one of them was
"delete it". That is worth holding in mind for the row that remains.

- Feedback *(renamed from Comments: Gus wants it used for feedback
  on the plan, which names a writer but not yet a reader)*

## Header (document meta)

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Research title** | `text` | Identifies the plan everywhere it is listed, shared or printed. | Researcher — naming their own plan. | Able, but usually **last**. You name a plan once you know what it is; this is asked first. | **move** — later. Named once the plan exists, not before it. |
| **Jira Project** | `text` | Links plan to ticket; the picker resolves it live. | Project side owns the key, but the picker now fetches it, so the researcher no longer has to know it. | Yes — the picker searches, so recall is not required. | **keep** — the picker removed the recall cost. |
| **Lead researcher**<br><sub>asks: Name</sub> | `text` | Attribution, and the sign-off pair reads the name from here. | Researcher (self). | Yes — zero effort. | **keep** |
| **Project requester**<br><sub>asks: Name</sub> | `text` | Attribution; names the approver for sign-off. | Researcher knows the name. | Yes — zero effort. | **keep** |
| **Last updated** | `date` | Tells a reader how current the plan is. Computed. | Nobody — computed. Already *move*. | N/A — computed, never asked. | **move** — **done, and verified in the app this time.** It reads as a dateline in the header corner. It stays editable at Gus's request, so the sentence itself is the control: activating it swaps in the date editor in place, with no separate Change link. |
| **Project decision** | `date` | **Feeds the deadline check** — warns when reporting lands less than a week before it. Also the reason the study has a deadline at all. | ⚠ **Project Owner.** A delivery date the researcher does not set. | ⚠ **Often not yet fixed.** Must be chased from someone else, and research planning frequently precedes the date being set. A blocker disguised as a date field. | **keep — sourced or optional.** Load-bearing (feeds the deadline check) but routinely unanswerable at the moment it is asked. Pull it from the linked Jira issue, or let people proceed without it. Blocking on a date someone else has not set is how forms get abandoned. **Reorder done:** now in the header beside the names, so the constraint is visible before any section is written. |
| **Research readout** | `date` | **Feeds the deadline check** (the other side of it), and sets the delivery expectation. | Researcher — their own commitment. | ⚠ Able, but asked early — a delivery commitment made before the method is chosen in Methodology. | **keep** — the sequencing complaint is the form's order, not this field. **Reorder done:** now in the header beside Project Decision, where a deadline belongs. |

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
| **Stage Timeline → Start Date** | `date` | **Drives the timeline visualisation** and the start-before-completion constraint. | ⚠ Researcher proposes; recruitment decides whether it holds. | ⚠ A proposal, not a commitment. Depends on recruitment lead times the researcher does not control. | **keep** — a planned date, like every date in a plan. Say so in the hint so the printed document is not read as a commitment. |
| **Stage Timeline → Completion Date** | `date` | **Drives the timeline visualisation** and the same constraint. | ⚠ As above — a forecast, not a fact. | ⚠ Weaker still — a forecast derived from a forecast. | **keep** — same note as Start Date. |
| **Action Points → Action** | `prose` | ⚠ No in-app consumer *yet*. Overlaps what Jira already tracks — which is the argument for feeding Jira from it, not for asking twice. | Researcher. | Yes. | **keep — pending its consumer.** The plan is where the work is decided; Jira is where it is tracked. The integration below makes this column the input to creating the subtask, which is the consumer it lacks. |
| **Action Points → Responsible** | `prose` | ⚠ No in-app consumer *yet*. Overlaps Jira assignees. | ⚠ Names other people. Commits someone who is not in the room. | ⚠ Able to type a name; not able to secure the commitment. Records an obligation the named person has not agreed to. | **keep — pending its consumer, and question 3 stays open.** An assignee is half of an action, so cutting it leaves work with no owner. The integration answers question 1 and **does not answer question 3**: creating a Jira subtask still commits someone who was not asked. It arguably raises the stakes — a name in a document is a note, a ticket in a queue is a claim on someone's time. The mitigation is that Jira makes the commitment visible and refusable, which a printed plan does not. Becoming a person picker is part of that work. |
| **Action Points → Status** | `status` | ⚠ **Nothing.** No consumer in the app, and a signed document cannot hold live state. | ⚠ Nobody, at authoring time. It changes after the plan is written. | ⚠ **Unanswerable here.** Nothing has happened yet. Any value is wrong the day after signing. | **cut** — **done.** Removed from the template, so the table asks two questions. The only row so far to fail all three questions at once. The `status` column type stays part of the template language and keeps its coverage from a fixture. |
| **Previous Knowledge → Name** | `prose` | ⚠ No in-app consumer. Meant to prevent repeating past work — the intent is good, the mechanism is absent. | ⚠ Often nobody's job. "What research already exists" is the classic unowned question. | ⚠ High effort, low willingness. Requires searching past work with no repository to search — the field most likely to be left blank. | **optional** — **done.** Question 3 decided this one. The field stays for the people who have something to hand, and stops being a wall for everyone else. Marking it honestly is not the same as giving it a source, which is still open — see recommendation 4. |
| **Previous Knowledge → File** | `file` | ⚠ No in-app consumer beyond storing the upload. | ⚠ Harder than the name: needs the artefact to hand, not just its title. | ⚠ Harder again: needs the artefact itself, not just its title. | **optional** — **done.** With the Name column, since the two are one row of one table and cannot be optional separately. The harder half of an already-hard question. |
| **Additional Resources**<br><sub>asks: Add details...</sub> | `custom-fields` | Escape hatch for anything the template did not anticipate. | Researcher — open-ended by definition. | Yes when they have something; the field only appears on demand. | **optional** — confirmed. Appears on demand. |

*The Resources section was folded into Execution (RPA-55): two fields did not
earn a section of their own.*

## Feedback

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Feedback**<br><sub>asks: Anything you'd like to say, any question you'd like to add, or some…</sub> | `textarea`<br><sub>optional</sub> | ⚠ **Nothing, and nobody.** No consumer and no defined reader — the only field failing both. | Whoever is filling it — but no defined reader. | Able, but why? No defined reader, so willingness is the open question — not capability. |  |

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

### 4. Give Previous Knowledge a source, or make it optional

Nobody owns "what research already exists". `research/README.md` already points at
a shared Drive research library — either link the field to it, or accept the field
is aspirational and mark it optional.

### 5. Apply the optionality convention properly

Only 3 of 25 fields are marked optional today: Hypothesis, Theory and Feedback. On
a form of this length completed by one person that is almost certainly understated.
Marking what is genuinely optional is the cheapest way to make the form feel shorter
without cutting anything — which is precisely the ADR 001 hypothesis.

Counts checked against the template rather than carried forward: 25 live fields, and
the three above are the whole of the optional set. The earlier figure of 28 predated
the Status cut, the User Groups merge and Requirements going dormant.

### 6. Decide who reads Feedback

The one field with no defined reader. Renaming Comments to Feedback named a writer
and a subject — feedback on the plan — but still not a reader, so the question is
unchanged by the rename. Either name its audience in the hint, or cut it.

There is now a third option the earlier draft did not have: **move it into the
review step.** That is where a plan is read rather than written, which is the one
moment a comment on it has an audience. It would also stop the field being a
section of its own at the end of the document, which is most of why it currently
reads as an afterthought.

Note the field keeps the key `comments` — labels and keys are independent since the
`key=` work — so nothing in a saved draft moves when this is settled.

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

### Expected shape of the finished sheet

One cut so far (Action Points/Status, done), possibly a second (Feedback), three or
four moves, several made optional, and the great majority *keep*. If that
disappoints, ADR 001 already argued why: the problem was probably orientation, not
scope.

The Action Points rows sharpened that. Two of the three columns looked like cuts on
question 1 and turned out to be missing plumbing rather than surplus questions.
**"Nothing uses this" is a finding about the tool as often as about the field**, and
the audit's job is to tell those apart. Only the third column — unanswerable at the
moment it is asked, and wrong the day after — was a genuine cut.

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

- **Table columns still derive their keys from their labels.** There is no `key=` for
  a column: the column spec is `Label:type=placeholder`, and threading a key through
  it safely is a larger change than it looks. Renaming *Start Date* would still break
  the timeline. The guard is the only protection there — column keys are exposed as
  `data-col-key` and asserted against what the code reads.
- **A guard is a test, not a constraint.** It fails loudly on the next run; it does
  not prevent the mistake.
