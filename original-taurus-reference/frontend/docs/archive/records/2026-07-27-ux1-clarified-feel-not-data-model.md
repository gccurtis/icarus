# 2026-07-27 — UX1 clarified: it's about FEEL, not the data model

The user sharpened the UX1 decision's wording during review, and everywhere the shorthand
"it's a text editor, not a block editor" appeared has been updated to the precise form —
because the shorthand reads as an architecture claim, and it is not one.

## The clarification (user, verbatim intent)

> It's not that it's a text editor, not a block editor. The **feeling** of it should feel like a
> text editor. Obviously we're using a block model in the backend and as our underlying data
> model — but the feeling should just be a smooth text editor.

Precisely:

- **The block model stays.** Omega documents ARE blocks in rows; Alpha's runtime, ops, and sync
  all speak blocks. No change should remove or weaken block-based machinery on "it's a text
  editor" grounds.
- **The decision is about the editing surface's feel.** No gutters, drag handles, or row/block
  selection chrome — nothing that makes the user handle blocks *as objects*. Block-aware
  features that surface as smooth text editing (Text type, Insert element, inline typography —
  all block ops underneath) are the intended shape.
- **Judge changes by what they do to the feel of editing, not by whether they touch blocks.**

## Where the wording changed

- `docs/records/2026-07-27-ux1-decided-not-a-block-editor.md` — clarification section appended
  (that record stays the decision's home; this record indexes the sweep).
- Orientation §"known things" UX1 paragraph — now states the precise principle.
- Catalog ~~UX1~~ row — clarification embedded.
- Code comments + companions that carried the shorthand: `DetailsPanel.svelte` (the dispatcher
  fallback), `model/selection.ts` (`InspectionOverride`), and their companions plus
  `NoneLens.svelte.md`.
- Agent memory: the `documents-are-a-text-editor-not-a-block-editor` note replaced by
  `document-editing-feels-like-a-text-editor` (the old name itself was the misreadable
  shorthand).

No behavior changes — comments and docs only.

## Verification

`pnpm check` 0/0 · `pnpm test` 343/343 · `pnpm build` clean · companions OK · e2e **14/14**.
