# Change record — 2026-07-21 — Permanent inspector sections; the lens follows the click

Per direction (and the shell reference): the inspector has **permanent** sections that
always exist — **Details** (the selection lens, the default) and **Quarterback** (tied
to the bar). The reference names these two; a third view wasn't found in the local
corpus (it may live in the un-mirrored Notion "Context & Inspector Panels" spec — per
direction, ignored until it surfaces; sections are pluggable when it does).

## Changes

- **Details is universal and permanent** (`AppShell` + new
  [`DetailsFallbackPanel`](../../../src/lib/features/shell/panels/DetailsFallbackPanel.svelte)):
  always first on the rail, always present. A surface contributing a section with id
  `details` **replaces its content** (the document's selection lens does exactly this);
  other contributed inspector sections sit between the two permanents; Quarterback is
  always last. Merge-by-id amendment recorded in the
  [panel-system design](../plans/2026-07-21-panel-system-design.md).
- **Details is the default**: new workspaces open with `inspector.section = 'details'`
  (and `context.section = 'properties'`, the left rail's first).
- **The lens follows the click**: pointer-down anywhere in the document work (paper,
  text, gutters) switches the inspector to Details — section only, the user's
  collapsed state is respected. Focusing the Quarterback bar remains the symmetric
  jump to `ai`. So: click a thing → see its details; click the bar → see the
  Quarterback.

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean. Companions updated
(AppShell, DetailsFallbackPanel, workspace defaults, DocumentStage).
