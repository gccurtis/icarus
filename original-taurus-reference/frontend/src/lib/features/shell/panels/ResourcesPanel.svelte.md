# ResourcesPanel.svelte

The project-context **All resources** lens — the project's real Omega catalog as a *navigator*, with
project-level **Import** and **Export** (both modals) and a search field that never scrolls away.

> **Rewritten 2026-07-29 (the context-rail pass).** Was a flat list of every resource above the
> transfer buttons. Now: a fixed head (transfer + search), then collapsible `Pinned` and per-kind
> groups with counts.
>
> **Rewritten 2026-07-27 (workstream D, catalog L4).** That pass made import/export kind-agnostic;
> the section below still describes it, and still holds.

## Layout — what is fixed and what scrolls

```svelte
<div class="flex h-full flex-col">
  <div class="shrink-0 space-y-2 pt-1">…Import/Export, search, "N of M match"…</div>
  <PanelResults class="mt-2">…groups…</PanelResults>
</div>
```

The user's requirement was that import, export, and the search field stay reachable no matter how far
the list scrolls. `flex h-full flex-col` makes `SidePanel`'s own scroller inert and hands the scroll
to `PanelResults` (the mechanism is documented in `components/PanelResults.svelte`) — no sticky
positioning, and no change to the panel contract the other fifteen mount points rely on.

## The navigator's search is not the table's search

```svelte
let query = $state('');
const groups = $derived(groupResources($resources, query));
const summary = $derived(matchSummary($resources, query));
```

The Overview stage's `ResourceTable` has its own search and filter popover, and this is deliberately
a *different* thing: the table filters rows you are working with, the rail finds a thing to open. The
projection (grouping, filtering, the "2 of 4" arithmetic) lives in
[`resource-groups.ts`](resource-groups.ts.md) so this component holds only interaction.

## Groups, collapse, and why a search overrides it

```svelte
function isOpen(groupId: string): boolean {
  return Boolean(query.trim()) || !collapsed.has(groupId);
}
```

`Pinned` first, then one group per kind the project actually has, each with a chevron, an uppercase
label, and its count. Collapse state is a `Set` of group ids held in component state — replaced
rather than mutated so the `$derived` markup re-runs.

A search **auto-reveals** every group: collapsing is the user saying "show me less", not an
instruction to hide the very thing they just typed a name for. When a group is filtered its count
reads `2 of 4`, and when it is not it reads the plain total.

Collapse state is intentionally not persisted to the workspace. It is a momentary "quiet this down"
gesture, and a rail that reopened three days later still holding a collapse the user forgot making
would read as a bug.

## Row affordances

```svelte
aria-current={openResourceId === r.id ? 'true' : undefined}
…
{#if !r.access.projectWide}<Lock … aria-label="Restricted" />{/if}
```

Two marks, both real. The row for the resource the work surface is *currently showing* is tinted and
carries `aria-current` — derived from the active tab's `resourceId`, which is the workspace's own
bridge between a tab and its resource. A resource whose `access.projectWide` is false gets a lock,
because "not everyone in the project can see this" is exactly what a navigator should tell you before
you share its name in a meeting.

Clicking a row calls `openTab(name, id, kind)`, which focuses the existing tab if the resource is
already open.

## Kind-agnostic by construction (unchanged, 2026-07-27)

This panel used to import `exportDocumentMarkdown`/`importMarkdownFile` from the documents system and
filter `kind === 'document'` — a *generic shell panel* carrying one feature's knowledge, the exact
coupling failure the panel-system design warned about. All of that moved to the file-transfer table in
[`features/shared/transfer.ts`](../../shared/transfer.ts.md); the panel names **no kind**:

- The Import/Export button row renders only `{#if importers.length}` — a project whose kinds declare
  no transfer support shows just the list.
- The Import modal iterates `importers`: each importable kind contributes its own copy, `accept`
  pattern, and picker labels; a successful `spec.run(file)` resolves to the created resource, which
  the panel opens as a tab and toasts.
- The Export modal lists `exportables` — resources whose kind has an exporter — and
  `spec.run(id, name)` triggers the download itself. The empty state is generic ("Nothing in this
  project can be exported yet.").

Adding transfer support for a new kind is a table entry, not an edit here.

## Empty states

Two, because they mean different things: an empty *catalog* gets the `EmptyState` component pointing
at the overview ("Create one from the project overview."), while an empty *search* gets a quiet line
naming the query that matched nothing. Telling someone with twelve resources that they have none
would be the worse of the two mistakes.

## Error handling

Both transfer flows share the `busy` flag (one at a time), surface `ApiError` messages through a
`danger` toast, and fall back to a generic "Import failed"/"Export failed" for anything unshaped. The
file input's value is cleared before the import starts so choosing the same file again still fires
`change`.
