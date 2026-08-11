# Change record — 2026-07-21 — Overview: consistent bordered panels, full-width purpose, inline rename

Another Overview pass, per feedback. The resource area stays a **table** (the list
conversion was reverted at the user's request); the changes are about making Create,
Activity, and the table read as one bordered-panel family, plus purpose and name edits.

## Purpose — full width, fixed two lines, scroll-inside

[PurposeStatement.svelte](../../../src/lib/features/stages/PurposeStatement.svelte) now
spans the **full width** (matching the resource table) and is fixed at **two lines**:
extra text scrolls inside the box rather than growing the stage. Dropped the auto-grow
logic — it's a plain `rows="2"` textarea in a bordered, filled card.

## Create + Activity — bordered panels, equal height, activity fills the width

- [CreateColumn.svelte](../../../src/lib/features/stages/CreateColumn.svelte): the kind rows
  now live in a **bordered panel** split by `divide-y` into sections, `flex-1` so they
  share the panel height evenly — matching the activity feed and the table.
- [ActivityFeed.svelte](../../../src/lib/features/stages/ActivityFeed.svelte): added a
  **border around the whole list** (kept the dividers, still no background fill).
- [OverviewStage.svelte](../../../src/lib/features/stages/OverviewStage.svelte): the band is
  now `sm:grid-cols-[15rem_minmax(0,1fr)]` so **Activity fills the remaining width** (the
  earlier narrow-and-pushed-right version left a big gap), with `grid-rows-1` giving both
  cells the full height so the two panels match. The band is dropped a little (`mt-8`) and
  the Resources section tightened (`mt-3`) so the **table stays roughly put** while
  Create/Activity move down.

## Inline project rename — a labeled mock

Double-click the project name to edit it in place (Enter commits, Escape discards, blur
commits). Rename has **no backend endpoint**, so this is a **labeled mock**: it calls the
existing client-only `renameProjectMock` and toasts "Renamed (mock — backend rename
pending)"; the store update flows back into the header (and top bar/tab) reactively. The
ask is already tracked in
[backend-requests/project-updates.md → Rename](../backend-requests/project-updates.md).

## Principle reaffirmed

Per the user: **the front end shows data and flags gaps; pivotal data changes belong to
the backend.** Where there's no endpoint (rename here), we show a mock, label it as a
mock, and keep a backend request — never silently faking a real save. This holds for
everything prior too (purpose, activity, resources, members, visibility are all
mock-and-badged with backend requests).

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean. Resource table kept as-is
(still no Type column from the earlier pass; the icon carries the kind with a hover
tooltip).
