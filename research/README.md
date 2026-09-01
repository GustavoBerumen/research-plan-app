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

## Layout

```
research/
  README.md        This index
  notes/           Synthesis notes, one per source or theme
  decisions/       Numbered decision records (context / decision / consequences)
  images/          Small screenshots only — keep large sets in Drive
```
