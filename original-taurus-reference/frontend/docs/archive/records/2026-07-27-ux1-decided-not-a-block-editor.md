# 2026-07-27 — UX1 decided: row/blocks inspection stays unreachable, by design

The reachability finding from the e2e repair (catalog **UX1**) asked for a decision: the Row and
Multiple Blocks lenses cannot be opened since the left-gutter handles were removed (`3866771`,
2026-07-23) — should an entry point come back?

**The user decided: no.** Row/block manipulation affordances make the product *feel like a block
editor*, and it is deliberately a **text editor** — that feel is part of what sells it. The
unreachability is intent, not damage.

## Clarified (2026-07-27, later the same day)

The user sharpened the wording, and the sharpened form is the canonical one — the shorthand
"it's a text editor, not a block editor" risks being read as an architecture claim, and it is
not one:

> It's not that it's a text editor, not a block editor. **The feeling of it should feel like a
> text editor.** Obviously we're using a block model in the backend and as our underlying data
> model — but the feeling should just be a smooth text editor.

So, precisely:

- **The block model stays.** Omega documents ARE blocks in rows; Alpha's runtime, ops, and sync
  all speak blocks. No change should remove or weaken block-based machinery on "it's a text
  editor" grounds.
- **The decision is about the editing surface's FEEL.** No gutters, drag handles, row/block
  selection chrome, or other affordances that make the user handle blocks *as objects*.
  Block-aware features that surface as smooth text editing (Text type, Insert element, inline
  typography — all block ops underneath) are the intended shape.

Judge future changes by what they do to the feel of editing, not by whether they touch blocks.

## What this changes

- **Catalog UX1** → closed as decided; it is no longer a gap to fix.
- **D6 unblocked**: workstream D deletes `runtime.inspectAnchor` (dead since `3866771`) and the two
  dead lens files, `RowLens.svelte` and `BlocksLens.svelte`. The frozen `SelectionInfo` contract
  keeps its `row`/`blocks` modes (contracts stay frozen); the dispatcher gets a defensive fallback
  for modes that can no longer occur.
- **Orientation** and the `resources.spec.ts` dropped-coverage note now say the assertions are not
  coming back, instead of "re-add when row inspection gets an entry point".

## Terminology, recorded

"**Lens**" is the canonical term for the inspector's per-selection views — not "view" (overloaded)
and not "stage" (already means the work-surface stages). Adopted by the user explicitly.
