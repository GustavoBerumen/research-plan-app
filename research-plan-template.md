<!--
FIELDS SCHEMA — this file defines the Research Plan form. The app reads it at
page load and builds the form from it, so you can add, remove, reorder, or
relabel fields here without touching any code.

Field line syntax (one per line):
  Label (type[, optional][, eval]): Placeholder / description text

Types:
  text      — single-line input
  textarea  — multi-line input
  date      — native date picker (calendar); placeholder text is ignored
  email     — single-line input for an email address, with the browser's
              email keyboard and autocomplete; judged by shape (something,
              an @, something with a dot) when Continue is pressed (RPA-99)
  select    — fixed dropdown; placeholder text becomes a comma-separated
              option list, e.g. "Small (1–5),Medium (6–12)". Same dropdown
              styling as a table's "status"/"select" columns, just for a
              single top-level field instead of a table cell.
  list      — dynamic stack of inputs, one per item, with its own "+ Add …"
              button (like table rows, but one column). Add the `prose` flag
              when list items should wrap and auto-expand vertically.
              Exception: "Outcomes" is special-cased in code to be a linked
              list with no controls of its own — its rows track Research
              Questions 1:1 by position instead.
  table     — repeatable rows. Placeholder text instead describes columns as
              "ColLabel:coltype:colkey=placeholder | ..."
              coltype is one of: text, prose (wrapping auto-expanding text),
              date, person, status (fixed dropdown),
              select (dropdown with custom options — placeholder becomes a
              comma-separated option list, e.g. "Stage:select:stage=A,B,C"),
              url, file (click to attach, 15MB max)
              colkey pins the column's key so a reworded heading cannot change
              it — the same job key= does for a field. It is optional and falls
              back to the label; declare it anyway. Code reads columns by key
              (the timeline finds stage, startDate and completionDate that
              way), and renaming a heading without a pinned key unhooks that
              silently, on a form that still renders (RPA-74). Saved drafts are
              unaffected either way: table cells are stored by position, never
              by column name.
  custom-fields — "+ Add additional information" button that appends user-named blocks (an
              editable label plus a textarea each), for letting users add
              their own ad-hoc fields to a section instead of being limited
              to what's predefined here. Placeholder text becomes each new
              block's textarea placeholder.

Flags (comma-separated inside the parentheses):
  optional          — marks the field "(optional)" in its label
  eval              — attaches the mock AI-evaluation button/panel to this field
  editable-headers  — table fields only: column headers render as editable
                       text inputs instead of fixed labels, so users can
                       rename a column (e.g. "Physical" → something else)
                       directly in the UI. Off by default — other table
                       fields (Planned Schedule, Action Points) keep fixed
                       headers unless they also set this flag.
  prose             — list fields only: rows render as wrapping,
                       auto-expanding textareas instead of compact inputs.
  words=N           — textarea fields only: the design system's word count
                       under the box, "You have N words remaining", counting
                       down as the person types; past N it reads "You've
                       written about M words". Advisory, never a limit
                       (RPA-114). Two tiers today: 60 for a long answer, 30
                       for a short one.
  jira              — text fields only: the field takes a Jira ticket. It gets
                       the ticket picker (when the server has Jira configured)
                       and shows a chosen ticket as a small tag. No field
                       uses it today: the project field asks for a project
                       name since RPA-119, and its key stays jiraProject so
                       saved plans keep their answer.
  width=N           — text fields and list rows: the input is sized to the
                       answer it expects, in the GOV.UK width classes (2, 3, 4,
                       5, 10, 20 or 30 characters). A ticket key is 10, a name
                       or a user group 20, a characteristic 30. Dates are fixed
                       already; textareas and prose rows stay full width.

Exception: "Methods" rows are special-cased in code to be searchable
comboboxes — suggestions come from research-methods.md (one method per
bullet, edit that file to change the list), but each row still accepts
free text.

Section headings ("# Name") become collapsible sections.
  "# Name {open}" makes that section expanded by default.
  "# Name {grid}" lays that section's fields out two-per-row instead of stacked.

"## Name" groups the fields that follow under a labeled sub-heading
inside the current section (a bordered cluster with "Name" above it),
without opening a new collapsible section of its own. The group ends
at the next "##" or "#" line.

A field line may be followed by indented lines. "Hint:" is the field's
guidance, shown as visible text between the label and the control — edit
the hint here, not in app.js. "Good:" and "Bad:" are examples, shown in a
toggle panel under the field:
  Hint: what this field is for, and how to answer it well
  Good: an example of a strong answer
  Bad: an example of a weak answer

Wrap words in *asterisks* inside a Hint to italicise them, e.g.
  Hint: structured as *If we do this, then this will happen.*

An indented "Guidance:" line is a longer note about the field, shown on
demand behind a closed link at the bottom of the field, under the box
(RPA-107). Every field has the link, the title and header fields
included; a field with no Guidance line yet opens on "No further help for
this field yet." Several Guidance lines make several paragraphs; *italics*
work as in a Hint, and [text](url) makes a link to a page that says more.

The words of the notes are RPA-119, and they brought three things:
  Help: the title of the note      — the words on the closed link, saying
                                     what is behind it ("Why we ask for a
                                     decision date"). Without a Help line
                                     the link reads "Help with this section".
  Guidance: - an item              — a Guidance line that starts "- " is an
                                     item of a list; items that follow one
                                     another make one list, where written.
  **bold**                         — works in a Hint or a note, beside
                                     *italics*.

An indented "Error:" line is what Save and continue says, in the error
summary and at the field, when a required field is left unanswered
(RPA-120). Say what to do, in the words of the field's question: "Enter
the goal of this project", "Select how many studies you will run". No
full stop, no "please", nothing about what the person did wrong. On a
field asked once per study, "this study" becomes the study's name, and a
message that does not say it has " for Study 2" added. A field without an
Error line gets the general wording made from its label ("Enter the
goal"). What the form says about an answer that is there and wrong (a
date with no year, a date that is not real, an email address without an
@) is not written here: it is the same for every field of that kind.

question=... on any field makes that the heading a person reads, as a
question page asks it ("What is the goal of this project?"). The label
before the parentheses stays the field's name: error messages, the check
page and Review use it ("Enter the goal"), so keep it short and do not
turn it into the question.

The very first "#" line in the file is special: it defines the document
title field, not a section. Plain field lines right after it (before the
next "#" heading) become the header's meta fields (owner, dates, etc).
A field line above that title is asked before the plan, on a page of its
own that stands in front of every step until it is answered: the email
address a link back to the plan will be sent to (RPA-99). Its question=
is the page's heading; its label names it in the Menu and in messages.
-->

Email address (email, width=30, question=What is your email address?, key=emailAddress):
  Hint: This address identifies your local draft and backup. This app does not send email.

# Research title (text, question=What is the name of your research plan?, key=researchTitle):
  Hint: A simple descriptive name for your study, for example ‘Usability testing of checkout flow’.
  Error: Enter a name for your research plan
  Help: I am not sure what to name my research
  Guidance: A good title helps colleagues understand what you are testing without reading the rest of the document.
  Guidance: Try combining the purpose of your study with the feature or solution you want to understand better:
  Guidance: - Discovery interviews for onboarding
  Guidance: - Navigation evaluation with power users
  Guidance: - Identifying issues in the management dashboard
  Guidance: You can change this title at any time.

Project name (text, width=20, question=Which project or initiative does this research support?, key=jiraProject):
  Hint: The name of the wider project, programme, or product goal your study relates to. For example, ‘Checkout redesign’ or ‘Billing self-serve’.
  Error: Enter the project or initiative this research supports
  Help: Why we ask for the project name
  Guidance: Connecting your study to a project helps others find related work, such as existing documentation, previous research, or active Jira tickets.
  Guidance: It also helps to understand the impact of this study and to connect with and include the right stakeholders.
  Guidance: You can update this at any time.
Lead researcher (text, width=20, question=Who is leading this research?, key=leadResearcher):
  Hint: Enter the full name of the person responsible for running this study.
  Error: Enter the name of the person leading this research
  Help: Why we ask for the lead researcher
  Guidance: This identifies the main point of contact who will carry out the study and share the findings.
  Guidance: The lead researcher is accountable for:
  Guidance: - Ensuring the research plan aligns with the project objectives
  Guidance: - Running sessions and collecting data
  Guidance: - Delivering insights that support the project initiative
  Guidance: If multiple people are involved, enter the person with overall responsibility.
  Guidance: You can change this name at any time.
<!-- RPA-141, 17 September 2026. Research is often done by more than one
     person, and the plan had nowhere to say who else. A yes or no question,
     then their names only if yes. "closed" means the options are the whole
     set, so no "Other" is offered; "reveals=" names the field asked only
     when the first option is chosen. Names only, for now: no roles, no
     email addresses. The sign-off stays between the Lead researcher and the
     Project requester (RPA-134). Wording is a placeholder for Gus. -->
Other researchers (radios, closed, reveals=researcherNames, question=Are other researchers involved in this research?, key=otherResearchers): Yes,No
  Hint: Anyone besides the lead researcher who will plan, run or analyse the research.
  Error: Select yes if other researchers are involved in this research
Researcher names (list, width=20, key=researcherNames):
  Hint: Add each person’s name. Do not include the lead researcher.
  Error: Enter the name of at least one other researcher
Project requester (text, width=20, question=Who requested this research?, key=projectRequester):
  Hint: Enter the name of the project lead or stakeholder who asked for this research support.
  Error: Enter the name of the person who requested this research
  Help: Why we ask for the project requester
  Guidance: This is usually the person responsible for the wider product or business initiative, such as a product manager, designer, data analyst, or engineer.
  Guidance: Adding their name helps ensure:
  Guidance: - The research plan aligns with their original request and business goals
  Guidance: - They review the plan before sessions begin
  Guidance: - The insights from this research will be used to make decisions and drive tangible product changes
  Guidance: You can update this name at any time.
Project decision (date, question=When will the findings be used to make a decision?, key=projectDecision):
  Hint: The date the project requester or team plans to use the insights to take action.
  Error: Enter the date the findings will be used to make a decision
  Help: Why we ask for a decision date
  Guidance: Research is most effective when insights arrive before choices are locked in.
  Guidance: Knowing the decision deadline ensures:
  Guidance: - Findings are shared, read, and understood in time to influence the work
  Guidance: - The team has time to act—such as designers updating prototypes, engineers planning sprints, or product managers adjusting requirements
  Guidance: - The research schedule is planned backwards from when stakeholders actually need answers
  Guidance: An approximate date is fine. You can update this date if timelines shift.
Research readout (date, question=When will the findings be shared with the team?, key=researchReadout):
  Hint: The date you expect to deliver the insights from this research. This date should be a few days before the project decision date.
  Error: Enter the date the findings will be shared with the team
  Help: Why this date needs to be before the decision date
  Guidance: This date should be set before the project decision deadline.
  Guidance: We recommend sharing insights at least a few days in advance so the team can:
  Guidance: - Review and understand the findings
  Guidance: - Ask follow-up questions or request deeper analysis
  Guidance: - Have a built-in buffer in case sessions or analysis run behind schedule
  Guidance: An estimated date is fine. You can adjust this timeline as the project progresses.
Last updated (date, key=lastUpdated):
  Hint: The date this plan was last edited.
<!-- RPA-145. Plan details closes with the same hatch as the four content
     sections (RPA-101, capped at one block by RPA-82). It was the one place
     a researcher had nowhere to put what the questions did not ask for. It
     is a header field here, because Plan details is the document's header;
     the form draws it under the header's questions, not among them. -->
Additional information (custom-fields, max=1, key=additionalPlanDetails):
  Hint: Anything this section needs that its fields have no place for. It becomes its own titled part of the document.

# Context {open}

Background (textarea, eval, rows=2, words=60, question=What do people need to know about this project?, key=background):
  Hint: Give essential context about the wider initiative and define any terms needed to understand this research.
  Error: Enter what people need to know about this project
  Help: Why we ask for the background
  Guidance: Research always sits within a bigger picture. A clear background connects your study to the wider business initiative so stakeholders can easily follow along.
  Guidance: A good background covers three essential areas:
  Guidance: - **Relevant context:** Briefly explain what the wider project is, and why this study is needed right now.
  Guidance: - **Essential terms:** Introduce and define terms early so they make sense when referenced later in your goals and objectives.
  Guidance: - **Tight focus:** Keep the scope sharp by leaving out general details that do not directly inform this project.
  Guidance: About 3 sentences are usually enough.
  Guidance: You can edit this at any time.
Goal (textarea, eval, rows=2, words=30, question=What is the goal of this project?, key=goal): 
  Hint: State the outcome the initiative aims to achieve and what will change in the product.
  Error: Enter the goal of this project
  Help: How to define the project goal
  Guidance: Every project aims to change something for the user, the solution or the business. A clear goal defines the future product state once this initiative succeeds.
  Guidance: A strong project goal covers 3 key areas:
  Guidance: - **The change:** State what you want to improve, such as increasing conversion or reducing drop-offs.
  Guidance: - **The future product state:** Describe what the product will do differently after the changes are made.
  Guidance: - **Outcome over research:** Focus on what the business or product achieves, not what you plan to learn in your sessions.
  Guidance: Keep it focused on the end result.
Problem Statement (textarea, eval, rows=2, words=60, question=What problem are you trying to solve?, key=problemStatement): 
  Hint: Summarise the specific issue, challenge, or gap your research aims to address.
  Error: Enter the problem you are trying to solve
  Help: How to write a strong problem statement
  Guidance: Usually research starts with something that needs fixing or improving. A clear problem statement defines the exact challenge the team is trying to solve.
  Guidance: A strong problem statement covers 3 key areas:
  Guidance: - **User friction:** Describes the struggle, obstacle, or unmet need without prescribing a design feature or solution.
  Guidance: - **The measure:** Mention the specific problem and a metric or rate to show its scale (such as drop-offs or error rates).
  Guidance: - **The impact:** Clarify why fixing this matters to the user or the business.
  Guidance: Keep it narrow enough to tackle in one study. You can edit this at any time.
Additional information (custom-fields, max=1, key=additionalContext):
  Hint: Anything this section needs that its fields have no place for. It becomes its own titled part of the document.

# Research

Objective (textarea, eval, rows=2, words=30, question=What do you want to learn from this research?, key=objective): 
  Hint: State the specific unknown you need to uncover about your users to guide product decisions.
  Error: Enter what you want to learn from this research
  Help: How to define your research objective
  Guidance: The research objective focuses on what you need to learn from users. A strong objective covers 3 key areas:
  Guidance: - **User behaviour and needs:** Focus on how users complete tasks, where they struggle, or why an issue happens, not just feature validation.
  Guidance: - **A decision to make:** Target a specific unknown that helps your team pick a direction, launch a feature, or prioritise work.
  Guidance: - **A manageable scope:** Focus on one clear audience and workflow so findings stay conclusive.
  Guidance: Start with an action verb like Understand, Identify, or Explore.
  Guidance: You can edit this at any time.
<!-- Dormant since RPA-117, 14 September 2026, the same day as Theory and
     Action Points. Older drafts keep their text through carryUnrendered.
     Uncomment the three lines to bring it back. -->
<!-- Hypothesis (textarea, optional, eval, rows=1, words=30, key=hypothesis): -->
<!-- Hint: An educated assumption about this project's results, structured as: *If we do this, then this will happen.* -->
<!-- Guidance: Specific enough to be wrong. Leave it blank if the study is exploratory and you do not yet have one. -->
Research Questions (list, eval, question=What questions do you need this research to answer?, key=researchQuestions): 
  Hint: Frame the specific gaps in your understanding of user experience, needs and issues.
  Error: Enter at least one research question
  Help: How to write strong research questions
  Guidance: A research question is the core unknown your study must answer to guide product decisions. It is what the team needs to find out through the research.
  Guidance: A good research question covers 3 key areas:
  Guidance: - **Target audience:** Identifies who is encountering the situation.
  Guidance: - **User experience:** Focuses on how users think, make choices, or get stuck.
  Guidance: - **Specific task:** Tied to an exact trigger, feature, or workflow phase.
  Guidance: Use open-ended stems like *How*, *Why*, or *What* such as *“Why do new users drop off on the bank-linking screen?”*
  Guidance: You can edit, remove, or add more questions at any time.
Outcomes (list, eval, question=What deliverables will answer your research questions?, key=outcomes): 
  Hint: Add the specific outputs you will deliver. Each outcome should answer one of your research questions.
  Error: Enter at least one deliverable that will answer your research questions
  Help: How to define research outcomes
  Guidance: It is the tangible deliverable that answers a research question and helps your team take action. Avoid vague outputs like “a summary” or “a presentation slide deck.”
  Guidance: A strong outcome covers 3 key areas:
  Guidance: - **Direct alignment:** Maps straight back to one research question.
  Guidance: - **Specific format:** Such as a prioritised list of pain points, an end-to-end journey map, wireframe recommendations.
  Guidance: - **Action-oriented:** Directly supports an upcoming decision, such as refining the backlog, or updating design flows.
  Guidance: You can edit, remove, or add more outcomes at any time.

Additional information (custom-fields, max=1, key=additionalResearch):
  Hint: Anything this section needs that its fields have no place for. It becomes its own titled part of the document.

# Studies

<!-- RPA-142, 16 September 2026. A study is what Methodology is answered
     for. Between Research and Methodology the plan says how many studies
     there are and which research questions each one answers; a question may
     be answered by more than one study, and every study must answer at
     least one. Methodology is locked in the task list until this section is
     complete. The radios offer One, Two and Three, with "More than three"
     revealing a number box (Gus's choice over a bare number box). The
     wording of both questions and their hints is Gus's to settle. -->
Number of studies (radios, question=How many studies will you run?, key=studyCount): One,Two,Three
  Hint: Count each separate research activity. A usability study and a survey count as two studies, even if they are for the same question.
  Error: Select how many studies you will run
  Help: How to plan your studies
  Guidance: A study is a distinct research activity with its own method, participant group, and timeline.
  Guidance: Choose the structure that fits your plan:
  Guidance: - **One study for all questions:** A single round of interviews or usability tests covers everything if the audience is the same.
  Guidance: - **One study per question:** Each question needs a different method, such as a survey for scale and interviews for depth.
  Guidance: - **Multiple studies for one question:** You need to combine methods, like discovery interviews followed by prototype testing.
  Guidance: You can change this at any time.
Study questions (study-questions, question=Which research questions does this study answer?, key=studyQuestions):
  Hint: Select every question this study helps answer. A question can be answered by more than one study.

# Methodology

<!-- Dormant since RPA-117, 14 September 2026. Theory and Action Points are
     hidden at this stage of the plan — Theory added friction, and actions are
     tracked in Jira. Saved values in older drafts are carried forward
     untouched by carryUnrendered, and the framework suggestion code stays
     for when Theory returns. Uncomment the two lines to bring it back.
     Hypothesis joined them the same day; see Research above. -->
<!-- Theory (textarea, optional, rows=2, key=theory): -->
<!-- Hint: A framework to help ground the study design and analysis. -->
Methods (list, width=20, question=Which research methods will you use for this study?, key=methods):
  Hint: A technique to study user behaviours, needs, and experiences that helps answer your research question.
  Error: Enter at least one research method for this study
  Help: What is a research method?
  Guidance: A research method is the practical technique you use to collect data from users. The right method depends on whether you need to observe what people do, listen to what they say, or measure trends at scale.
  Guidance: Common methods include:
  Guidance: - **Usability testing:** Observe how users navigate a prototype or live feature and where they struggle.
  Guidance: - **User interviews:** Explore motivations, workflows, and the reasons behind user behaviour.
  Guidance: - **Tree testing:** Test navigation labels, menus, and content structure.
  Guidance: Read the provided recommendations carefully. You can use them or choose different methods.

<!-- Since RPA-116 the participant fields below are asked inside each group
     under Methods and saved with it; since RPA-142 a group is a study, and
     "perQuestion" means "asked once per study". The flag keeps its name so
     older drafts, tests and the submission contract read as before. -->
<!-- Who takes part is one question again (Gus, 17 September 2026, RPA-119).
     Characteristics and User Groups were merged once in RPA-55, split again
     on the grounds that a screener criterion is a filter and a segment is a
     quota, and are now one list under the question "Who should take part in
     this study?", with the help note explaining the two kinds of criteria.
     The field keeps the key "characteristics", so nothing saved moves; a
     plan saved while there were two lists reads with its user groups after
     its characteristics (plan-model.js), and no draft version changes. -->
Participant criteria (list, prose, width=30, perQuestion, question=Who should take part in this study?, key=characteristics):
  Hint: Define the target participants and screening criteria for this study. For example: *New customers who abandoned a checkout in the last 30 days.*
  Error: Enter who should take part in this study
  Help: How to define your participants
  Guidance: Participant criteria define who you need to recruit to answer your research question accurately.
  Guidance: Include two types of criteria:
  Guidance: - **User groups:** The broad segments, roles, or personas you need (such as account owners, new sign-ups, or support agents).
  Guidance: - **User characteristics:** Specific behaviours, conditions, or experience levels that make someone eligible (such as uses the mobile app weekly or has not made a purchase yet).
  Guidance: You can also mention any profiles to exclude (such as internal staff or users on legacy plans).
  Guidance: You can edit or add more criteria at any time.
<!-- "question=" sets the legend of a radios field: the question as a
     person reads it, while the label stays the field's name for messages
     and the check page (RPA-118). -->
Sample Size (radios, perQuestion, question=How many participants do you need?, key=sampleSize): Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)
  Hint: The number of people this study's methods need.
  Error: Select how many participants you need
  Guidance: Five people find most usability problems in one design; interviews stop being surprising around eight to twelve; a survey needs many more. Pick the band for the method, not for ambition.

Additional information (custom-fields, max=1, key=additionalMethodology):
  Hint: Anything this section needs that its fields have no place for. It becomes its own titled part of the document.

# Execution

<!-- Requirements (table, editable-headers, key=requirements): Physical:prose:physical | Digital:prose:digital | Approvals:prose:approvals -->
<!-- Hint: What you'll need to run this study — physical items, digital tools, and approvals. -->
<!-- Timeframe (textarea, key=timeframe): Scheduled duration for each research phase -->
<!-- "prefill" starts this table with one row per Stage option rather than one
     empty row, so the five-stage schedule everybody builds by hand is already
     there (RPA-76). The stage names come from the column's own options, so
     renaming or reordering a stage here is enough — app.js holds no copy of
     the list. Planning's start date is when the plan was started; Reporting's
     completion date follows Research readout until somebody edits it. -->
Planned Schedule (table, prefill, row=stage, key=stageTimeline): Stage:select:stage=Planning,Recruitment,Data Collection,Analysis,Reporting | Start Date:date:startDate | Completion Date:date:completionDate
  Hint: Suggested stages of a standard study. Each stage needs a start and completion date, on or before the research readout. Remove stages you do not need.
  Error: Enter a start date and a completion date for each stage
<!-- Dormant since RPA-117, see Theory above. RPA-69, Jira subtasks from
     Action Points, loses its source while this is hidden. -->
<!-- Action Points (table, optional, key=actionPoints): Action:prose:action | Responsible:prose:responsible -->
<!-- Hint: Tasks needed to move this research forward, and who owns each one. -->
<!-- The Status column was cut (RPA-55). A plan gets signed and printed; it
     cannot also be a live tracker, so any status it claims is wrong the day
     after sign-off. Nothing has happened yet at the point the question is
     asked, which makes every available answer untrue. Status belongs in Jira.
     Action and Responsible stay: the plan is where the work is decided, and
     RPA-69 gives them a consumer by creating the Jira subtasks from them. -->
<!-- Previous Knowledge and Additional Resources used to be a Resources
     section of their own. Two fields did not earn a section: what you already
     know and what you still need are part of executing the study, not a
     separate stage of it (RPA-55). -->
<!-- Optional, per RPA-55. "What research already exists?" is the question
     nobody in an organisation owns. It is asked of the researcher because they
     are the one filling the form, not because they are the one who knows, and
     answering it means searching past work with no repository to search. The
     field stays for the people who have something to hand and stops being a
     wall for everyone else. Marking it honestly is not the same as giving it
     a source, which is still open — see recommendation 4. -->
Previous Knowledge (table, optional, key=previousKnowledge): Name:prose:name | File:file:file
  Hint: Prior research or documentation relevant to this study, attached for reference. For example: Q3 Checkout Usability Study.
<!-- Documentation (textarea, key=documentation): Reference materials required to understand and execute the study -->
<!-- One Additional information hatch per section, rendered in place at the
     end of its section and capped at one block (max=1) — RPA-101 and
     RPA-82. It used to be lifted out and shown after every section so it
     would not sit inside a collapsed accordion; with one section on screen
     at a time that reason is gone. The Execution one keeps the key
     additionalResources so older drafts restore into it. -->
Additional information (custom-fields, max=1, key=additionalResources):
  Hint: Anything this plan needs that the sections above have no place for. Each one you add becomes its own titled part of the document.

<!-- The review step, and the last thing in the document. Alignment became this
     once its identifiers moved to the header: what was left was the two
     approvals, and approving is a moment rather than a section (RPA-55).
     Rendered by renderReviewStep, not as an accordion, so it cannot be
     collapsed past. -->
# Review

<!-- Project (textarea, key=project): Initiative -->
<!-- Hint: The product or business initiative this research plan supports. -->
<!-- Area (text, key=area): Department -->
<!-- Jira Research (text, key=jiraResearch): Ticket reference -->
<!-- The two sign-offs name the same two people as the header, in the same
     order, so a reader is not left wondering whether "Project Owner" and
     "Project requester" are different roles (RPA-55; Max raised it reviewing
     PR #22). The keys keep their original spelling on purpose: a key is an
     identifier, not a description, and now that the template pins them a
     label can be reworded without touching stored drafts. -->
<!-- Feedback moved here from a section of its own (RPA-55). It was the only
     field with no defined reader, and a section at the end of the document was
     nobody's stop. The review step is where a plan is read rather than
     written, which is the one moment a comment on it has an audience — and it
     sits above the approvals, because feedback offered after sign-off has
     missed its moment. It keeps the key `comments`: a key is an identifier,
     not a description, so no saved draft moves. -->
<!-- Dormant since 15 September 2026, RPA-98. The plan's Feedback box and
     its "Give feedback" button gave way to feedback on the tool, revealed by
     the same button after the sign-offs. The key comments is still carried
     in older drafts. Uncomment the two lines to bring it back. -->
<!-- Feedback (textarea, optional, words=60, key=comments): -->
<!-- Hint: Comments on the plan itself — a question, a concern, or anything you want the approvers to read before signing. -->
<!-- Two declarations close the plan, RPA-115, 14 September 2026, one per
     role in Gus's words: the lead researcher conducts the research, the
     project requester is responsible for the project. Each is a required
     box, the design system's single checkbox, directly above that person's
     sign-off. A "checkbox" line's text after the colon is the statement the
     box agrees to. -->
Declaration: Lead researcher (checkbox, key=declarationResearcher): I confirm this plan is complete and current, and I will conduct the research as it describes.
  Hint: Tick the box once every section is complete and current, then add your initials below.
  Error: Confirm that this plan is complete and current
Sign off: Lead researcher (text, width=20, key=signOffResearcher):
  Hint: Lead researcher approval — type your initials, up to 10 characters, and the date is added automatically.
  Error: Enter your initials to sign this plan
Declaration: Project requester (checkbox, key=declarationRequester): I confirm this plan meets the needs of the project I am responsible for, and I approve it.
  Hint: Tick the box to approve the plan for your project, then add your initials below.
  Error: Confirm that you approve this plan
Sign off: Project requester (text, width=20, key=signOffProjectOwner):
  Hint: Project requester approval — type your initials, up to 10 characters, and the date is added automatically.
  Error: Enter your initials to approve this plan
