#!/usr/bin/env python3
"""Generate or drift-check the field audit table against the form schema.

research/field-audit.md audits every field in research-plan-template.md. That
template is edited freely -- the app builds the form from it at page load -- so
the audit can quietly fall out of step with the form it claims to audit.

Two modes:

    python3 research/field-audit-gen.py            # check for drift (default)
    python3 research/field-audit-gen.py --write    # regenerate a blank scaffold

Check is the one you want almost always. It compares the fields in the template
against the rows in the audit and reports either side's extras, exiting non-zero
on drift so CI can fail on it.

--write emits a scaffold with empty protocol columns and REFUSES to overwrite an
existing audit unless given --force, because the answers and verdicts in that
file are hand-written and cannot be regenerated. Use it to start over, not to
refresh: there is no merge here, only replacement.
"""

import argparse
import os
import re
import sys

TEMPLATE = "research-plan-template.md"
AUDIT = "research/field-audit.md"

FIELD = re.compile(r'^([^(<][^(]*?)\s*\(([^)]*)\)\s*:\s*(.*)$')
COMMENTED = re.compile(r'^<!--\s*(.+?)\s*-->\s*$')
# Audit rows are "| **Label**... | `type` |..." -- the backticked type cell is
# what distinguishes them from the scoreboard and dormant tables.
AUDIT_ROW = re.compile(r'^\| \*\*(.+?)\*\*(?:<br>.*?)? \| `')


def parse_template(path=TEMPLATE):
    """Return (sections, dormant) from the form schema.

    sections is [(name, [(label, spec, hint, group), ...]), ...] in file order.
    dormant is the commented-out field lines -- fields trimmed previously.
    """
    lines = open(path).read().split("\n")
    # The schema doc-comment at the top ends at the first line that is exactly "-->".
    start = next(i for i, l in enumerate(lines) if l.strip() == "-->") + 1

    sections, dormant, group = [], [], None
    for raw in lines[start:]:
        line = raw.rstrip()
        if not line.strip():
            continue
        # Indented lines belong to the field above them -- "Hint:", "Good:",
        # "Bad:" -- and are never fields. Skip them outright rather than
        # relying on FIELD failing to match: a hint containing "):" would
        # otherwise be mistaken for a field line.
        if raw[:1].isspace():
            continue
        m = COMMENTED.match(line.strip())
        if m:
            fm = FIELD.match(m.group(1))
            if fm:
                where = sections[-1][0] if sections else "Header"
                dormant.append((fm.group(1).strip(), fm.group(2).strip(), where))
            continue
        if line.startswith("## "):
            group = line[3:].strip()
            continue
        if line.startswith("# "):
            name = re.sub(r'\s*\{\w+\}', '', line[2:].strip()).strip()
            fm = FIELD.match(name)
            # The first "#" line defines the document title field, not a section.
            if fm and not sections:
                sections.append(("Header (document meta)", [
                    (fm.group(1).strip(), fm.group(2).strip(), fm.group(3).strip(), None)]))
            else:
                sections.append((name, []))
            group = None
            continue
        fm = FIELD.match(line)
        if fm and sections:
            sections[-1][1].append((fm.group(1).strip(), fm.group(2).strip(),
                                    fm.group(3).strip(), group))
    return sections, dormant


def audited_labels(label, spec, hint):
    """The rows a field should occupy: one per question, not one per field.

    A fixed table column is a question the form asks of every user, every time,
    so it is audited on its own line -- that is what lets the sheet carry a
    verdict like "Action Points -> Status: cut".

    The exception is a table declared editable-headers: its column names are
    defaults the user can rename, not questions the form asks, so there is
    nothing to cut per column. Those stay a single row.
    """
    if "table" not in spec or "editable-headers" in spec:
        return [label]
    columns = [c.split(":")[0].strip() for c in hint.split("|") if c.strip()]
    return [f"{label} → {c}" for c in columns] or [label]


def audit_labels(path=AUDIT):
    """Field labels currently present as rows in the audit table."""
    if not os.path.exists(path):
        return None
    return {m.group(1) for m in
            (AUDIT_ROW.match(l) for l in open(path).read().split("\n")) if m}


def check():
    sections, _ = parse_template()
    in_template = {row
                   for _, fields in sections
                   for label, spec, hint, _grp in fields
                   for row in audited_labels(label, spec, hint)}
    in_audit = audit_labels()
    if in_audit is None:
        print(f"{AUDIT} does not exist -- run with --write to create it.")
        return 1

    missing = sorted(in_template - in_audit)   # in the form, never audited
    extra = sorted(in_audit - in_template)     # audited, no longer in the form

    for label in missing:
        print(f"  MISSING from audit: {label}")
    for label in extra:
        print(f"  STALE in audit (not in template): {label}")

    if missing or extra:
        print(f"\nDrift: {len(missing)} missing, {len(extra)} stale.")
        return 1
    print(f"No drift -- all {len(in_template)} fields accounted for.")
    return 0


def scaffold():
    sections, dormant = parse_template()
    total = sum(len(audited_labels(l, s, h))
                for _, fields in sections for l, s, h, _ in fields)
    out = []
    w = out.append
    w("# Field audit — RPA-55")
    w("")
    w("Every field in `research-plan-template.md` put through Caroline Jarrett's")
    w("question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,")
    w("what goes, and what is being asked at the wrong moment.")
    w("")
    w("**Status: scaffold — no verdicts reached yet.**")
    w("")
    w("Verdicts: **keep** · **cut** · **merge** · **optional** · **move**")
    w("")
    for name, fields in sections:
        if not fields:
            continue
        w(f"## {name}")
        w("")
        w("| Field | Type | Why do we need it? | Who has the answer? | "
          "Able and willing? | Verdict |")
        w("|---|---|---|---|---|---|")
        for label, spec, hint, grp in fields:
            rows = audited_labels(label, spec, hint)
            if rows != [label]:
                # Fixed table columns: one row each, typed from the column spec.
                for row, col in zip(rows, [c.strip() for c in hint.split("|") if c.strip()]):
                    ctype = col.split(":", 1)[1].split("=")[0].strip() if ":" in col else "text"
                    w(f"| **{row}** | `{ctype}` |  |  |  |  |")
                continue
            parts = [p.strip() for p in spec.split(",")]
            flags = ", ".join(parts[1:])
            tcell = f"`{parts[0]}`" + (f"<br><sub>{flags}</sub>" if flags else "")
            h = hint.replace("|", "\\|")
            if len(h) > 70:
                h = h[:67] + "…"
            fcell = f"**{label}**"
            if grp:
                fcell += f"<br><sub>in *{grp}*</sub>"
            if h:
                fcell += f"<br><sub>asks: {h}</sub>"
            w(f"| {fcell} | {tcell} |  |  |  |  |")
        w("")
    w("## Already dormant")
    w("")
    w("| Field | Type | Was in |")
    w("|---|---|---|")
    for label, spec, sec in dormant:
        w(f"| {label} | `{spec.split(',')[0].strip()}` | {sec} |")
    w("")
    return "\n".join(out), total


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true",
                    help="regenerate a blank scaffold (destructive)")
    ap.add_argument("--force", action="store_true",
                    help="with --write, overwrite an existing audit")
    args = ap.parse_args()

    if not args.write:
        return check()

    if os.path.exists(AUDIT) and not args.force:
        print(f"Refusing to overwrite {AUDIT}.\n"
              "Its answers and verdicts are hand-written and would be lost.\n"
              "Run the default check instead, or pass --force if you mean it.")
        return 1

    text, total = scaffold()
    os.makedirs("research", exist_ok=True)
    open(AUDIT, "w").write(text)
    print(f"Wrote {AUDIT}: {total} fields.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
