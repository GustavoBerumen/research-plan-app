# Research

Design and UX research that informs the app — what we read, what we concluded,
and why the product looks the way it does.

## Reading list

The reading list for the app redesign — form design and form-filling UX — lives
in a Google Doc:

**[Resources Form Design (Doc)](https://docs.google.com/document/d/1mrg7-h9IM3f1sLxdEX2cKrQ_b0xytqf2NsOmx9_yUOk/edit)**

The Doc is **authoritative** and is edited in place as reading progresses. It is
deliberately not mirrored into this repo — a copy here would fork from it within
a week. This holds until we decide otherwise, at which point this note changes
with it.

## Research library (Google Drive)

Collected source material — papers, PDFs, book chapters, screenshot sets, and
links — lives in a shared Drive folder:

**[Research library (Drive)](https://drive.google.com/drive/folders/1-m6rHCtqUFc7GxmsL25whbHReSWEObjo)**

Access is restricted to the project team. If you can't open it, request access
and one of us will approve it.

## What goes where

| | Lives in Drive | Lives in this repo |
|---|---|---|
| **What** | Things we *collected* | Things we *wrote* |
| **Examples** | PDFs, book chapters, large screenshot sets, saved links, the reading list | Synthesis notes, decision records, audits |
| **Why** | Bulky or copyrighted; no value in version history | Diffable, reviewable in a PR, versioned next to the code it justifies |

This repository is **public**, so copyrighted source files stay in Drive. Links
to a source, and our own notes about it, are always fine to commit here.

If a source actually changed a decision, it gets a short note in this folder —
the Drive folder is the archive, this repo is the map.

### One deliberate exception: MISSION.md

The rule above is why the reading list is not mirrored into the repo: a copy
forks from the Doc within a week. [`MISSION.md`](../MISSION.md) is a mirror of
the same Doc's Alignment section and has exactly that problem, and it lives in
the repo anyway.

That is a decision, not an oversight (Gus, 13 October 2026). The difference is
which way the authority runs: the reading list is a collection the Doc owns and
the repo would only copy, whereas the mission is something we wrote and need to
argue against proposals in pull requests. So `MISSION.md` is canonical and the
Doc became its drafting surface — the opposite arrangement to the reading list.
**Do not apply the no-mirror rule to it.**

## Layout

```
research/
  README.md            This index
  field-audit.md       Field-by-field audit of the form (RPA-55)
  field-audit-gen.py   Drift-checks that audit against research-plan-template.md
  notes/               Synthesis notes, one per source or theme
  decisions/           Numbered decision records (context / decision / consequences)
  images/              Small screenshots only — keep large sets in Drive
```
