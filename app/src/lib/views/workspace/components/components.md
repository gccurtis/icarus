# Workspace Components

Lives at `src/lib/views/workspace/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
workspace.svelte
└── project-overview                 components/project-overview.svelte
```

Exactly one component renders at a time, chosen by the key below. A resource
that grows past a component becomes a sibling view and is imported through its
root; the row in the key table then names that view instead.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`project-overview.svelte`](project-overview.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `project-overview`

- **Root:** [`project-overview.svelte`](project-overview.svelte)
- **Purpose:** what a `project-overview` resource renders as. It is the
  permanent tab's kind, so this is what the work surface shows on a first load
  and whenever every transient tab has been closed.
- **Inputs:** `None`. A resource component is selected by kind; the tab it
  belongs to is the active one by construction.
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** selection, and the scroll above it
- **Focus behavior:** nothing focusable yet
- **Layout and overflow:** fills the centre; does not own a scroll
- **Accessibility:** static text inside the frame's `main` landmark

It has no content of its own yet. A project summary needs capabilities that do
not exist, and the Convex round trip that used to occupy this space was a
transport probe rather than a surface — it lives at `/mock/[project]` now, where
it belongs to no tab and pretends to no resource kind.

## Key Selection

- **Key:** `ResourceKind`, from `$model/client`.
- **Selected by:** [`workspace.svelte`](../workspace.svelte), which reads
  `workbench.active.resource.kind` and renders the match.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `project-overview` | The project overview | [`project-overview.svelte`](project-overview.svelte) |

Total in both directions: one kind, one component, and no component here that a
key cannot reach. The map is a `Record<ResourceKind, Component>`, so a new kind
fails to compile until it has a row.

No exception, and no unknown-key branch. Restoration drops a stored kind this
build no longer recognises, so nothing unmapped reaches the map.

**This is half the mapping for `ResourceKind`.** The tab bar holds the other
half — the label and icon for the same key — because that is the surface that
displays them. Adding a kind therefore touches two views, which is the same
obligation the model already imposes by typing `ACTIVITIES_BY_KIND` as a
`Record` over the same union.

## Tree Invariants

- **A component here is reachable only through the key.** Nothing imports one
  directly, so the table above is the complete list of what can render.
- **No component here owns a scroll.** The frame's centre does, and a second
  inside it would make a scroll position unrecoverable.
