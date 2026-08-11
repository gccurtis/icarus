# Change record — 2026-07-21 — docs/architecture/ (conceptual → implementation maps)

Establishes a new documentation practice and its first entry.

## New: `docs/architecture/`

```text
docs/architecture/README.md              The practice: what an entry is, how it
                                         differs from companions/records/discrepancies,
                                         and the keep-it-honest rules.
docs/architecture/document-editor.md     First entry: the ProseMirror ↔ Omega editor.
```

**Why:** companions explain single files, records explain history, discrepancies
explain boundary seams — but nothing explained a *subsystem*: the concepts, how they
flow, and exactly which file/function carries each one out. The document editor made
the gap obvious. **What an entry contains** (using the editor as the template): the
idea, the layer model with its one-way dependency rule, a concept→implementation table,
the runtime flows, the **invariants that must stay true**, an extension map ("I want to
change X → touch Y, leave Z alone"), and the known v1 seams.

Entries are held to companion-like discipline: update them in the same change that
reshapes the code; unbuilt intent only under a marked "next increments"/seams section.

## Cross-links

Orientation README: `docs/architecture/` added to the directory map, and the editor
quick-reference row now points at the architecture entry first.
`discrepancies/documents.md` links to it. No source code changed (docs-only — the
green gate is unaffected).
