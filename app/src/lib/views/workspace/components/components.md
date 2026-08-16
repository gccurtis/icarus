# Workspace Components

Lives at `src/lib/views/workspace/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
workspace.svelte
├── project-overview                 components/project-overview.svelte
└── document                         components/document.svelte
```

Exactly one component renders at a time, chosen by the key below. A resource
that grows past a component becomes a sibling view and is imported through its
root; the row in the key table then names that view instead.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`document.svelte`](document.svelte)
- [`project-overview.svelte`](project-overview.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

Both take the active tab's `ResourceRef`, so a resource component is a function
of what it renders rather than a reader of the workbench. Both are **fixtures**:
their content is static because the capabilities that would supply it do not
exist. What is real in each is the model call it makes, and between them they are
the only callers of `open()` and `inspect()` in the application.

### `project-overview`

- **Root:** [`project-overview.svelte`](project-overview.svelte)
- **Purpose:** what a `project-overview` resource renders as. It is the
  permanent tab's kind, so this is what the work surface shows on a first load
  and whenever every transient tab has been closed.
- **Inputs:** the active tab's resource ref
- **Outputs:** `open()` per listed document
- **Owned children:** `None`
- **Behavior delegated to the view root:** selection, and the scroll above it
- **Focus behavior:** each entry is an ordinary button in tab order
- **Layout and overflow:** fills the centre; does not own a scroll
- **Accessibility:** a list of buttons inside the frame's `main` landmark

The list stands in for a project's contents. What is real is the opening:
`open()` mints a tab or activates the one already holding that resource, because
it dedupes on kind *and* id — pressing the same entry twice returns to the tab
rather than making a second.

### `document`

- **Root:** [`document.svelte`](document.svelte)
- **Purpose:** what a `document` resource renders as, and the only surface that
  reports an inspection.
- **Inputs:** the active tab's resource ref
- **Outputs:** `inspect()` on release inside a block — a text selection when one
  exists, a caret otherwise
- **Owned children:** `None`
- **Behavior delegated to the view root:** selection, and the scroll above it
- **Focus behavior:** nothing focusable. Reaching an inspection by keyboard is a
  real gap that belongs to a real editor, which owns a caret; giving a paragraph
  a button role would claim a keyboard path that does not work.
- **Layout and overflow:** a measure-limited column; does not own a scroll
- **Accessibility:** paragraphs inside the frame's `main` landmark

Offsets are measured from the block rather than taken from the DOM selection
directly, because `anchorOffset` counts within one text node and a block holding
any markup has several.

## Key Selection

- **Key:** `ResourceKind`, from `$model/client`.
- **Selected by:** [`workspace.svelte`](../workspace.svelte), which reads
  `workbench.active.resource.kind` and renders the match.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `project-overview` | The project overview | [`project-overview.svelte`](project-overview.svelte) |
| `document` | A document's blocks | [`document.svelte`](document.svelte) |

Total in both directions: every kind has a component, and no component here is
unreachable by a key. The map is a `Record<ResourceKind, Component<…>>`, so a new
kind fails to compile until it has a row.

No exception, and no unknown-key branch. Restoration drops a stored kind this
build no longer recognises, so nothing unmapped reaches the map.

**This is half the mapping for `ResourceKind`.** The tab bar holds the other
half — the label and icon for the same key — because that is the surface that
displays them. Adding a kind therefore touches two views, which is the same
obligation the model already imposes by typing `CONTEXTS_BY_KIND` as a
`Record` over the same union.

## Tree Invariants

- **A component here is reachable only through the key.** Nothing imports one
  directly, so the table above is the complete list of what can render.
- **No component here owns a scroll.** The frame's centre does, and a second
  inside it would make a scroll position unrecoverable.
