# Activity Panel Components

Lives at `src/lib/views/activity-panel/components/components.md`. This is the
one document for the complete recursive component tree. Nested component
directories do not carry their own Markdown files.

## Component Tree

```text
activity-panel.svelte
├── rail                             components/rail.svelte
└── overview                         components/overview.svelte
```

The root renders the rail always and exactly one content component, chosen by
the key below.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`overview.svelte`](overview.svelte)
- [`rail.svelte`](rail.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `rail`

- **Root:** [`rail.svelte`](rail.svelte)
- **Purpose:** the fixed strip that chooses what the panel shows.
- **Inputs:** the display copy for every activity, the ids this resource kind
  offers in order, the selected id, and a select callback.
- **Outputs:** one select call carrying an `ActivityId`.
- **Owned children:** `None`
- **Behavior delegated to the view root:** resolving the choice. The rail
  reports which id was picked and never renders the result.
- **Focus behavior:** each entry is an ordinary button in tab order. It takes no
  focus and restores none.
- **Layout and overflow:** a fixed column at `RAIL_WIDTH`; never scrolls, never
  collapses.
- **Accessibility:** a `navigation` landmark named "Activities". Entries are
  icon-only, so each carries its activity name as its accessible name, and the
  selected one carries `aria-current` plus an edge marker so selection does not
  ride on colour.

**Why it takes props instead of reading the model.** The root already reads
`activeActivity` to resolve the content component. A rail that read it too would
make the same key resolve in two places, and the map would have to exist in
both.

### `overview`

- **Root:** [`overview.svelte`](overview.svelte)
- **Purpose:** what the `overview` activity shows.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** all of it
- **Focus behavior:** nothing focusable yet
- **Layout and overflow:** fills the content half; the root owns that scroll
- **Accessibility:** static text

It has no content of its own yet — a project's resource tree is the obvious
candidate and needs a capability that does not exist. What it does is make the
map below total and reachable.

## Key Selection

- **Key:** `ActivityId`, from `$model/client`.
- **Selected by:** [`activity-panel.svelte`](../activity-panel.svelte), which
  reads `workbench.activeActivity` and renders the match.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `overview` | The overview activity | [`overview.svelte`](overview.svelte) |

Total in both directions: one id, one component, and no component here that a
key cannot reach. The map is a `Record<ActivityId, …>`, so a new id fails to
compile until it has a row.

No exception, and no unknown-key branch. The model guarantees `activeActivity`
is an id this resource kind offers, falling back to the kind's default when a
stored one no longer resolves.

## Tree Invariants

- **The rail decides, the content displays.** Neither reaches into the other,
  and the root is the only thing that knows both.
- **The map is the root's.** A component here never resolves an `ActivityId`;
  the rail is handed copy, and the content component is already the answer.
- **One scroll context.** The content half scrolls; the rail does not.
