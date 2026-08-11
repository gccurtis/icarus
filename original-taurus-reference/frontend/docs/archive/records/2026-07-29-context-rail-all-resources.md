# 2026-07-29 — All resources becomes a navigator

Second of five changes rebuilding the left rail's project-context set (plan:
[`docs/plans/2026-07-29-project-context-rail.md`](../../plans/2026-07-29-project-context-rail.md)).
The lens was a flat list of every resource under two transfer buttons; it is now a navigator whose
head never moves.

## The shape

```svelte
<div class="flex h-full flex-col">
  <div class="shrink-0 space-y-2 pt-1">…Import/Export, search, "N of M match"…</div>
  <PanelResults class="mt-2">…Pinned, then one group per kind…</PanelResults>
</div>
```

Import, Export, and the search field are fixed; the groups scroll under them. Each group header
carries the count of what is under it, and collapses.

## Two rules worth stating, because both could have gone the other way

**Pinned duplicates, it does not relocate.** A pinned document appears in `Pinned` *and* in
`Documents`. Moving it would make `Documents (4)` stop meaning "this project has four documents",
and pinning something would make it harder to find where you'd look for it. A shortcut that removes
the original is not a shortcut. `matchSummary` counts from the catalog rather than by summing groups
for exactly this reason — a pinned match would otherwise be counted twice.

**A search overrides a collapse.** Collapsing is "show me less", not "hide the thing I am about to
search for", so `isOpen` returns true for every group while the query is non-empty. Collapse state
is also deliberately *not* persisted to the workspace: a rail that reopened days later still holding
a forgotten collapse reads as a bug.

The projection lives in `resource-groups.ts` (pure, 13 tests) so both rules are asserted directly
rather than inferred from rendered DOM.

## The search is complete, and says nothing it cannot back

Name substring over `$resources`, which is the whole catalog — `enterProjectResources` pages
`/resources` to exhaustion. Searching *inside* documents is not offered: Omega has no content-search
route (its knowledge-lattice search is an agent tool, not an HTTP endpoint), and a field that
searched titles while appearing to search everything would be a lie. The header reads `1 of 10
match` so the scope is always on screen.

## What the e2e run changed about the design

Two things were wrong and the browser said so:

1. **"Mark the active resource" was nearly invisible.** Opening a document hands the left rail to the
   document stage's own contributed context set, so while a resource is active this lens is usually
   not on screen at all. The mark is now **"already open in a tab"** (a dot, from `workspace.tabs`),
   which is the fact that is useful *from Overview* — the active one still gets `aria-current` for
   the stages that don't claim the rail.
2. **Properties said "Invite only" where `ProjectSharing` says "Private".** The lens is one click from
   that dialog; a state that renames itself on the way there reads as a different setting. It now
   uses the dialog's own two words, and the adjacent `Owner`/`Owner` rows became `Your role` /
   `Project owner`.

`e2e/context-rail.spec.ts` is new and covers both lenses, including the structural claim the whole
rail rests on:

```ts
expect(geometry.bodyScrolls).toBe(false);
expect(geometry.resultsScrolls).toBe(true);
```

`SidePanel`'s own scroller must stay inert while the lens's results box does the scrolling. If that
inverts, every lens's head silently stops being fixed — and nothing else in the suite would notice.
The spec shortens the viewport so ten documents genuinely overflow, or the assertion would be
vacuous.

Two harness facts also came out of it, both recorded in the spec: the icon-rail buttons are a
*toggle* (clicking the already-active section collapses the panel, so `openSection` checks
`aria-pressed` first), and workspace state persists across runs, so a case must click `Overview`
before expecting the project rail at all.

## Verification

`pnpm check` 0 errors / 0 warnings · `pnpm test` 397 → **410 passing** (13 new for the grouping
projection) · `verify-companions` OK · `pnpm exec playwright test e2e/context-rail.spec.ts` 2/2.
