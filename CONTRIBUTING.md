# Working on this repo

Most work here happens in two places at once: a Claude Code session in the
terminal and a second agent session in VS Code. That is deliberate — planning,
research and ticket-writing are a different job from implementation, and running
them in parallel is faster than alternating. It also has one failure mode, and
this file exists to name it.

## The rule

**One writer per file. Where possible, one writer per working directory.**

Git merges divergent *commits* well. It does nothing for two processes writing
`app.js` seconds apart: the second write wins silently, and neither session
knows it happened. Every convention below is a way of enforcing that one rule.

## Lanes

The default split, which works because the two sets genuinely do not overlap:

| Lane | Owns |
|---|---|
| Planning session | Jira, `research/decisions/`, `research/field-audit.md`, `README.md`, this file |
| Implementation session | `app.js`, `server.js`, `style.css`, `test/`, `index.html`, the content Markdown |

Crossing lanes is fine, but say so explicitly and stop the other session first.
The failure is never a disagreement about who *should* write a file; it is two
sessions both believing they are the only one who *is*.

## Two sessions writing code at once

Use a worktree. Each gets its own directory and branch, sharing one `.git`, so
conflicts cannot happen and the work merges through a normal PR.

```sh
git worktree add ../rpa-app-<ticket> -b feat/rpa-<n>-<slug>
cp .env ../rpa-app-<ticket>/.env
cd ../rpa-app-<ticket> && npm install
PORT=8935 npm start
```

Three things specific to this repo:

- `.env` and `node_modules/` are both gitignored, so a fresh worktree has
  neither. Copy the first, install the second.
- Always set `PORT`. `server.js` reads it (defaulting to 8934), and the most
  common symptom of forgetting is an `EADDRINUSE` crash from a server the other
  session left running.
- Never `git checkout` another branch in a directory a session is mid-task in.
  This is the one operation that loses work rather than merely causing
  confusion, and avoiding it is what worktrees are for.

## Running the app

One session owns port 8934 at a time. If `npm start` fails with `EADDRINUSE`,
something is already serving — and it is probably running code from before the
last few commits:

```sh
lsof -i :8934 -sTCP:LISTEN -n -P    # find it
kill <pid> && npm start             # replace it
```

## Stale context

An agent session caches what it has read. A commit from the other session does
not invalidate that cache, and nothing warns it.

- After a batch of work lands, tell the other session **"I've committed,
  re-read"**. One line is enough.
- Before acting on anything read more than a few turns ago, re-check. Branch
  names, `git status` and file contents all go stale within minutes when two
  sessions are active.

## Branches and tickets

**Get the Jira key before opening the PR, and name the branch from it.**
Renaming a head branch after a PR exists closes the PR. This has happened twice.

One branch per ticket, named `feat/rpa-<n>-<slug>` or `fix/rpa-<n>-<slug>`.
Where a ticket is written up after the code exists, rename the branch *before*
opening the PR, never after.

## Where decisions live

In the repo, not in a session's context.

- `research/decisions/` holds ADRs — what was settled, and why the alternatives
  were rejected. ADR 001 is the load-bearing one.
- `research/field-audit.md` holds the per-field verdicts.
- Jira holds the work; the description carries the reasoning, so a ticket is
  readable without the conversation that produced it.

This is what makes parallel sessions work at all. Neither session has to
remember what the other decided, because the decision is written down where both
can read it. When a decision changes, amend the record in the same commit as the
code — an ADR that describes the app as it was is worse than no ADR.

## Tests

```sh
npm test
```

Tests run against jsdom via `test/app-harness.js` and never call the live API.
New behaviour gets a test named for its ticket (`test/rpa-<n>-<slug>.test.js`),
added to the `test` script in `package.json`. That file is a frequent source of
cross-session conflicts precisely because both lanes touch it — if the other
session is adding tests, let it own `package.json` for the duration.
