# Context Panel Components

Lives at `src/lib/views/context-panel/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
context-panel.svelte
├── rail                             components/rail.svelte
├── overview                         components/overview.svelte
└── outline                          components/outline.svelte
```

The root renders the rail always and exactly one content component, chosen by
the key below.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`outline.svelte`](outline.svelte)
- [`overview.svelte`](overview.svelte)
- [`rail.svelte`](rail.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `rail`

- **Root:** [`rail.svelte`](rail.svelte)
- **Purpose:** the fixed strip that chooses what the panel shows.
- **Inputs:** the display copy for every context, the ids this resource kind
  offers in order, the selected id, and a select callback.
- **Outputs:** one select call carrying a `ContextId`.
- **Owned children:** `None`
- **Behavior delegated to the view root:** resolving the choice. The rail
  reports which id was picked and never renders the result.
- **Focus behavior:** each entry is an ordinary button in tab order. It takes no
  focus and restores none.
- **Layout and overflow:** a fixed column at `RAIL_WIDTH`; never scrolls, never
  collapses.
- **Accessibility:** a `navigation` landmark named "Contexts". Entries are
  icon-only, so each carries its context name as its accessible name, and the
  selected one carries `aria-current` plus an edge marker so selection does not
  ride on colour.

**Why it takes props instead of reading the model.** The root already reads
`activeContext` to resolve the content component. A rail that read it too would
make the same key resolve in two places, and the map would have to exist in
both.

### Content components

Both take the active tab's `ResourceRef` and render what surrounds it. Neither
reads the model: the root resolves the key and passes the resource, so a context
component stays a function of its input and the panel has one reader.

Both are **fixtures**. Real content needs capabilities that do not exist, and
inventing a shared store to fake one would be a worse lie than a visibly static
list. What they do prove is that the panel re-resolves when the active tab
changes — each names the resource it is looking at, so a tab switch is visible in
the panel as well as in the centre.

### `overview`

- **Root:** [`overview.svelte`](overview.svelte)
- **Purpose:** what surrounds the active resource at project level.
- **Inputs:** the active tab's resource ref
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** selection, and the scroll above it
- **Focus behavior:** nothing focusable
- **Layout and overflow:** fills the content half; does not own a scroll
- **Accessibility:** static text under a heading

### `outline`

- **Root:** [`outline.svelte`](outline.svelte)
- **Purpose:** the structure of the resource being looked at.
- **Inputs:** the active tab's resource ref
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** selection, and the scroll above it
- **Focus behavior:** nothing focusable
- **Layout and overflow:** fills the content half; does not own a scroll
- **Accessibility:** an ordered list under a heading

## Key Selection

- **Key:** `ContextId`, from `$model/client`.
- **Selected by:** [`context-panel.svelte`](../context-panel.svelte), which
  reads `workbench.activeContext` and renders the match.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `overview` | What surrounds the resource at project level | [`overview.svelte`](overview.svelte) |
| `outline` | The resource's own structure | [`outline.svelte`](outline.svelte) |

Total in both directions: every id has a component, and no component here is
unreachable by a key. The map is a `Record<ContextId, …>`, so a new id fails to
compile until it has a row.

No exception, and no unknown-key branch. The model guarantees `activeContext` is
an id this resource kind offers, falling back to the kind's default when a stored
one no longer resolves.

**Which ids are offered is not this view's decision.** `CONTEXTS_BY_KIND` maps
each resource kind to its rail, so `project-overview` offers `overview` alone
while `document` offers `outline` first and `overview` second. That is why the
rail itself changes when the active tab does, and why `outline` is the default
for a document without anyone selecting it.

## Tree Invariants

- **The rail decides, the content displays.** Neither reaches into the other,
  and the root is the only thing that knows both.
- **The map is the root's.** A component here never resolves a `ContextId`; the
  rail is handed copy, and the content component is already the answer.
- **One scroll context.** The content half scrolls; the rail does not.
