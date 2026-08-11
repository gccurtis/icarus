# Change record — 2026-07-21 — Overview polish: boxed purpose, interactive activity, resource list

Follow-up to the [Overview redesign](2026-07-21-overview-redesign.md), tightening each
region per feedback.

## Purpose statement — its own box, left-aligned, no AI

- Dropped the "Draft with AI" affordance (and its imports) from
  [PurposeStatement.svelte](../../../src/lib/features/stages/PurposeStatement.svelte).
- Left-aligned the text and put it in **its own little card** (`bg-panel/40` + border,
  `rounded-panel`), so it reads as a project-description card rather than loose text.

## Activity feed — lighter, narrower, fully interactive

- **No background**: removed the panel fill/border; kept the `divide-y` row dividers.
- **Narrower + moved over**: the create/activity band is now
  `sm:grid-cols-[14rem_22rem] sm:justify-between`, so Create sits at the left and the
  feed is a tidy 22rem column pushed to the right edge (it was a wide `1fr`).
- **Interactive, even though everything is mock:**
  - New [ActivityActor.svelte](../../../src/lib/features/stages/ActivityActor.svelte) — the
    avatar + name as one unit that highlights on hover (avatar gains a ring, name
    brightens + underlines), reveals a **hover card** (name + placeholder identity), and
    is clickable (mock toast today; a real user modal is future).
  - The **target** underlines + colors on hover and **opens in a new tab** on click. A
    **deleted** target is plain text (nothing to open).
  - The whole **row** highlights on hover.
- The hover card uses **fixed-coordinate positioning** (captures the trigger rect) so the
  scrolling feed can't clip it — the same trick `Menu`/`Popover` use — and is built from
  phrasing `<span>`s so it's valid inside the feed's sentence.

## Resource table → a compact list

[ResourceTable.svelte](../../../src/lib/features/stages/ResourceTable.svelte) is the same
component (still shared with the New-tab stage) but denser and lighter:

- **Dropped the Type column.** The colored icon conveys the kind, now with a `title`
  hover tooltip naming it. Type remains a **filter** dimension in the filter popover.
- **Tighter rows** (`py-2`, `size-7` icon) reclaim vertical space.
- Everything else stays: sort (Name / Updated), filter, search, multi-select, bulk
  export, per-row **Download** and the kebab (settings / share / remove). Overview
  remains the place to manage/remove resources.

> This is the first pass at "make it a list." With the reclaimed room we can decide later
> what else the list should show (or whether a card grid fits better).

## Notes

- The resource-list change affects the New-tab stage's resource section too (shared
  component). If Overview and New-tab should diverge, that's a one-prop follow-up.
- No backend touched; the purpose and activity remain the documented mocks
  ([discrepancies/overview.md](../../discrepancies/overview.md)).
