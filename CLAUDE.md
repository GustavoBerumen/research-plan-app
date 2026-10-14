# CLAUDE.md

Read this first. It points; it does not explain. Each file named here is the
authority on its own subject, and none of its reasoning is repeated below.

## What the app is for

[MISSION.md](MISSION.md) — purpose, guiding principle, the four things the app
does, and the boundary. **A proposal is argued against this file.** It is
canonical: where it and the working document disagree, it wins.

The short version, so a session can answer without opening anything: the app
helps someone turn what they already know about their project into a research
plan good enough to act on. Users know their project; they may have no
experience writing a plan. The app collects, evaluates, refines and suggests,
and none of that gates anyone. It is the first step — the plan is revised
afterwards, and work that belongs after a plan exists is outside the mission.

## What has already been decided

- [research/decisions/](research/decisions/) — numbered records. **001** layout
  and navigation, **002** the page and section model. Read 001 before proposing
  anything that gates progress; it rejected that, with reasons.
- [research/field-audit.md](research/field-audit.md) — every field put through
  Caroline Jarrett's three questions, twice: the RPA-55 pass and the October
  pass that cut sixteen fields of thirty-two. **This is the answer to "what are
  we allowed to cut".** A field with no verdict has not been cleared; the sheet
  says a blank is not a verdict.
- [research/redesign-october/](research/redesign-october/) — the current
  redesign: roadmap, tickets, and what is still an open question.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how two sessions work at once: one writer
  per file, worktrees, get the Jira key before opening the PR, merge rather than
  squash.

## The form is a Markdown file, not code

`research-plan-template.md` defines **every section, field, question, hint,
error message and help note**. The app parses it at page load and builds the
form from it.

So cutting a field, rewording a question, changing a hint, retitling a help note
or reordering fields is a **template edit, not a code change**. Reach for
`app.js` only when the *behaviour* changes, not the words.

The template's own syntax is documented in the doc-comment at the top of the
file — the block ending at the first line that is exactly `-->`. Read it before
editing a field line.

Two rules that bite:

- **A field declares its own `key=`.** Keys used to be derived from labels, so a
  rename silently moved a field's storage. Every field pins its key for that
  reason; `test/rpa-55-field-key-contract.test.js` holds it. Table columns still
  derive keys from their headings.
- **A cut field is commented out, not deleted** — with a dated note saying why
  and how to restore it. Older drafts keep their values. This is the RPA-117
  pattern; `test/dormant-data.test.js` holds it.

## Tests

```
node --run test
```

About 870 tests. `package.json` **lists every test file explicitly** — 100 in
`test`, 2 in `pretest` — so **a new test file does not run until it is added
there.** That list is a frequent cross-session merge conflict; resolve it as a
union. CI runs the same script from `.github/workflows/test.yml` on every pull
request.

`python3 research/field-audit-gen.py` checks the field audit still matches the
template. It must exit 0.
