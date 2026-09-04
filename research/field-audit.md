# Field audit — RPA-55

Every field in `research-plan-template.md` put through Caroline Jarrett's
question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,
what goes, and what is being asked at the wrong moment.

**Status: questions 2 and 3 drafted. No verdicts reached yet.** The field list,
types and hint text are generated from the template; questions 2 and 3 are filled
in below as a starting point to argue with. Question 1 — *why do we need it?* —
and every verdict are still open.

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
| keep | 8 |
| cut | 1 |
| merge | 0 |
| optional | 3 |
| move | 4 |
| undecided | 17 |
| **total** | **33** |

33 rather than 28: the three fixed-column tables are audited per column, per the
unit rule above.

## Header (document meta)

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Title**<br><sub>asks: Title for your research plan</sub> | `text` |  | Researcher — naming their own plan. | Able, but usually **last**. You name a plan once you know what it is; this is asked first. | **move** — later. Named once the plan exists, not before it. |
| **Researcher**<br><sub>asks: Name</sub> | `text` |  | Researcher (self). | Yes — zero effort. | **keep** |
| **Project Owner**<br><sub>asks: Name</sub> | `text` |  | Researcher knows the name. | Yes — zero effort. | **keep** |
| **Last Updated** | `date` |  | Nobody — computed. Already *move*. | N/A — computed, never asked. | **move** — done. Computed value, now a dateline. |

## Alignment

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Project**<br><sub>asks: Initiative</sub> | `text` |  | Researcher, from the project side. Low risk. | Yes — to hand. | **keep** |
| **Jira Project**<br><sub>asks: Ticket reference</sub> | `text` |  | Project side owns the key, but the picker now fetches it, so the researcher no longer has to know it. | Yes — the picker searches, so recall is not required. | **keep** — the picker removed the recall cost. |
| **Project Decision** | `date` |  | ⚠ **Project Owner.** A delivery date the researcher does not set. | ⚠ **Often not yet fixed.** Must be chased from someone else, and research planning frequently precedes the date being set. A blocker disguised as a date field. |  |
| **Report Research** | `date` |  | Researcher — their own commitment. | ⚠ Able, but asked too early — a delivery commitment made before the method is chosen in section 5. |  |
| **Sign off: Project Owner**<br><sub>asks: Type initials</sub> | `text` |  | ⚠ **The Project Owner, by name.** The researcher cannot answer this one at all. | ⚠ **No.** Not the researcher's to give, and nothing exists to approve at section 2. Already *move*. | **move** — to the review step. |
| **Sign off: Researcher**<br><sub>asks: Type initials</sub> | `text` |  | Researcher (self) — but see timing. | ⚠ Willing, but not yet — there is no plan to sign. Already *move*. | **move** — to the review step. |

## Project Context

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Background**<br><sub>asks: Relevant information to understand the project</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ Project side. The researcher transcribes it rather than knows it. | Able by transcription, and that is the problem: retyping a brief that already exists. Low willingness, and invites paraphrase drift. |  |
| **Goal**<br><sub>asks: Aim of the project and the outcomes you are trying to achieve</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ **Project Owner.** This is the project's goal, not the research's. | ⚠ Able only by copying. If the brief is vague the researcher invents the project's goal — worse than leaving it blank. |  |
| **Problem Statement**<br><sub>asks: Issues requiring attention that could prevent the project achieving…</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ Project side — usually the reason research was commissioned in the first place. | Usually findable, being the reason research was commissioned. Still transcription rather than authorship. |  |

## Research

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Objective**<br><sub>asks: Purpose and high-level goals of the research</sub> | `textarea`<br><sub>eval</sub> |  | Researcher — core expertise. | Yes — this is what they came to write. | **keep** — the researcher's core contribution. |
| **Hypothesis**<br><sub>asks: Baseline assumptions to be tested during the study</sub> | `textarea`<br><sub>optional, eval</sub> |  | Researcher. | Sometimes. Many studies have none; already optional, correctly. | **optional** — confirmed. Many studies have none. |
| **Research Questions**<br><sub>asks: What do you want to understand?</sub> | `list`<br><sub>eval</sub> |  | Researcher. | Yes — core expertise, and the reason they opened the form. | **keep** — core; the reason the form is opened. |
| **Outcomes**<br><sub>asks: Deliverable for this question</sub> | `list`<br><sub>eval</sub> |  | Researcher — tracks Research Questions 1:1. | Able, but asked before methods are chosen, so the deliverable is guessed and then revised. |  |

## Methodology

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Theory**<br><sub>asks: Any useful framework that can guide our research</sub> | `textarea`<br><sub>optional</sub> |  | Researcher. | Often not to hand. Already optional, and the suggester exists precisely because recall is unreliable here. | **optional** — confirmed. Rarely to hand. |
| **Methods**<br><sub>asks: Search or type a method</sub> | `list` |  | Researcher — core expertise. | Yes — core expertise, with a 125-item list and a suggester behind it. | **keep** — core expertise, well supported. |
| **Characteristics**<br><sub>in *Participants*</sub><br><sub>asks: e.g. Frequent mobile shoppers</sub> | `list` |  | Researcher; recruitment/ops may hold the real numbers. | Roughly, yes. Precise figures usually sit with recruitment. |  |
| **User Groups**<br><sub>in *Participants*</sub><br><sub>asks: e.g. New customers</sub> | `list` |  | Researcher, though segment names may be owned by product. | Yes, though segment names may need product to confirm. |  |
| **Sample Size**<br><sub>in *Participants*</sub><br><sub>asks: Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)</sub> | `select` |  | Researcher. | Yes — a four-option dropdown, near-zero cost. | **keep** — drives recruitment; four-option dropdown. |

## Execution

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Requirements**<br><sub>asks: Physical \| Digital \| Approvals</sub> | `table`<br><sub>editable-headers</sub> |  | ⚠ **Split three ways.** Physical: researcher. Digital: IT. Approvals: legal/privacy. One field, three answerers. | ⚠ **Split.** Physical: yes. Digital: needs IT. Approvals: needs legal/privacy and is routinely unknown when planning. The danger is willingness without knowledge — a confident guess at approvals. |  |
| **Stage Timeline → Stage** | `select` |  | Researcher — their own plan. | Yes — a five-option dropdown. |  |
| **Stage Timeline → Start Date** | `date` |  | ⚠ Researcher proposes; recruitment decides whether it holds. | ⚠ A proposal, not a commitment. Depends on recruitment lead times the researcher does not control. |  |
| **Stage Timeline → Completion Date** | `date` |  | ⚠ As above — a forecast, not a fact. | ⚠ Weaker still — a forecast derived from a forecast. |  |
| **Action Points → Action** | `prose` |  | Researcher. | Yes. |  |
| **Action Points → Responsible** | `prose` |  | ⚠ Names other people. Commits someone who is not in the room. | ⚠ Able to type a name; not able to secure the commitment. Records an obligation the named person has not agreed to. |  |
| **Action Points → Status** | `status` |  | ⚠ Nobody, at authoring time. It changes after the plan is written. | ⚠ **Unanswerable here.** Nothing has happened yet. Any value is wrong the day after signing. | **cut** — live state in a signed document. Unanswerable when written, wrong the day after. |

## Resources

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Previous Knowledge → Name** | `prose` |  | ⚠ Often nobody's job. "What research already exists" is the classic unowned question. | ⚠ High effort, low willingness. Requires searching past work with no repository to search — the field most likely to be left blank. |  |
| **Previous Knowledge → File** | `file` |  | ⚠ Harder than the name: needs the artefact to hand, not just its title. | ⚠ Harder again: needs the artefact itself, not just its title. |  |
| **Additional Resources**<br><sub>asks: Add details...</sub> | `custom-fields` |  | Researcher — open-ended by definition. | Yes when they have something; the field only appears on demand. | **optional** — confirmed. Appears on demand. |

## Additional Comments

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Comments**<br><sub>asks: Anything you'd like to say, any question you'd like to add, or some…</sub> | `textarea`<br><sub>optional</sub> |  | Whoever is filling it — but no defined reader. | Able, but why? No defined reader, so willingness is the open question — not capability. |  |

## First pass: who has the answer?

Question 2 filled in for all 28 fields. The pattern that falls out is sharper than
any individual row.

**The form has one filler and at least four answerers.** The researcher completes
it end to end, but 8 of the 28 fields are owned by somebody else: the Project
Owner, legal/privacy, IT, and whoever a task gets assigned to. Every one of those
is a point where the form asks a person to speak for someone not in the room.

Three clusters, in descending order of how much they matter:

1. **Project Context is the project's knowledge, not the researcher's.** All three
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

3. **Sign off: Project Owner names an answerer who is not the filler**, in section
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

### 1. Stop retyping Project Context — source it

Background, Goal and Problem Statement are all owned by the project side. A Jira
connector already exists on the Jira Project field (`server.js`, `/api/jira/search`).
Pull these three from the linked issue instead of asking a researcher to paraphrase
them. Failing that, change the hints to say "paste from the project brief" — an
honest transcription task beats a question that only looks like one.

*Constraint:* the proxy currently calls `issue/picker`, which returns key and
summary only. Prefilling descriptions needs a second endpoint.

### 2. Take live state out of a signed document

- **Action Points → Status: cut.** The plan holds the action and its owner; status
  belongs in Jira. A signed, printed document that claims to know status is wrong
  the day after it is signed.
- **Requirements → split Approvals out.** Physical and Digital are the researcher's.
  Approvals is legal/privacy — a different answerer, a different timeline, and
  usually the thing that actually blocks a study. It is currently hiding as a third
  column of a table about equipment.

### 3. Fix the opening sequence

The first two sections, Alignment and Project Context, are the ones the researcher
is least able to complete alone. The sections they own outright start at number
three. The ordering principle is to open with what people can answer; this form
does the opposite. Consider opening with Research, and letting the admin and
project-context fields follow or arrive prefilled per #1.

### 4. Give Previous Knowledge a source, or make it optional

Nobody owns "what research already exists". `research/README.md` already points at
a shared Drive research library — either link the field to it, or accept the field
is aspirational and mark it optional.

### 5. Apply the optionality convention properly

Only 3 of 28 fields are marked optional today (Hypothesis, Theory, Comments). On a
28-field form completed by one person that is almost certainly understated. Marking
what is genuinely optional is the cheapest way to make the form feel shorter
without cutting anything — which is precisely the ADR 001 hypothesis.

### 6. Decide who reads Comments

The one field with no defined reader. Either name its audience in the hint, or cut
it. Note the RPA-54 prototype has just gained coverage for it, so there is fresh
work riding on the answer.

### 7. Sign-off pair and Last Updated

Already decided in RPA-55; listed for completeness. Sign-off moves to a review step
at the end; Last Updated becomes a dateline, done in the prototype.

### 8. Small and unambiguous

**Sample Size has no hint text** — its placeholder slot is consumed by the dropdown
options. Every other field explains itself; this one does not.

### Expected shape of the finished sheet

Two cuts (Action Points/Status, possibly Comments), three or four moves, several
made optional, and the great majority *keep*. If that disappoints, ADR 001 already
argued why: the problem was probably orientation, not scope.

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

| Field | Type | Was in |
|---|---|---|
| Research Team | `text` | Header (document meta) |
| Area | `text` | Alignment |
| Jira Research | `text` | Alignment |
| Timeframe | `textarea` | Execution |
| Documentation | `textarea` | Resources |

## Known before we start

Two items RPA-55 records as already decided, carried here so the audit does not
relitigate them:

- **Sign off: Project Owner / Sign off: Researcher — _move_.** They sit in
  Alignment, section two, so people approve a plan that does not yet exist. They
  belong in a review step at the end. Project Decision and Report Research stay
  in Alignment: those are planning inputs, not approvals.
- **Last Updated — _move_, done.** Rendered as a dateline under the document
  heading rather than an editable control, in the RPA-54 prototype. It is a
  computed value and should not invite editing.

## Open question this audit inherits

ADR 001 concluded this app is an application rather than a form, and that "too
long" was probably an orientation problem rather than a scope problem. If that
holds, the win here comes from **sequencing and optionality** rather than deletion,
and a verdict sheet full of *keep* is a legitimate outcome — provided the order
changed. Worth holding open rather than treating a low cut-count as failure.
