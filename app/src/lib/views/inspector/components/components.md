# Inspector Components

Lives at `src/lib/views/inspector/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
inspector.svelte
├── copilot                          components/copilot.svelte
├── text-selection                   components/text-selection.svelte
└── next-text                        components/next-text.svelte
```

At most one renders, chosen by the inspection's kind. The nothing-selected and
no-view-yet states are plain markup in the root rather than components, because
neither has anything to hold.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`copilot.svelte`](copilot.svelte)
- [`next-text.svelte`](next-text.svelte)
- [`text-selection.svelte`](text-selection.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

Both take the fields of the inspection node they are named for, and nothing
else. That is the model's contract rather than a limitation here: an inspection
names ids and offsets, and whoever renders it fetches whatever it needs. A
payload would be a copy of content that lives elsewhere and may have changed
since — the same reason an inspection is never persisted.

**The fetch is the missing half of both.** Turning a block id into text needs a
document capability, which does not exist. Each shows the identity it was handed.

### `text-selection`

- **Root:** [`text-selection.svelte`](text-selection.svelte)
- **Purpose:** the `document-text-selection` inspection — a range within a block.
- **Inputs:** `blockId`, `from`, `to`
- **Outputs:** `None`. Controls that act on a selection arrive with the editor
  that can apply them.
- **Owned children:** `None`
- **Behavior delegated to the view root:** narrowing the union, and the scroll
- **Focus behavior:** nothing focusable
- **Layout and overflow:** fills the panel; does not own a scroll
- **Accessibility:** a description list under a heading

### `next-text`

- **Root:** [`next-text.svelte`](next-text.svelte)
- **Purpose:** the `document-next-text` inspection — a caret with text about to
  be typed. The case that shows this panel is a control surface rather than a
  mirror: nothing is selected, so a mirror would have nothing to show.
- **Inputs:** `blockId`
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** narrowing the union, and the scroll
- **Focus behavior:** nothing focusable
- **Layout and overflow:** fills the panel; does not own a scroll
- **Accessibility:** a description list under a heading

## Key Selection

- **Key:** `InspectionNode["kind"]`, from `$model/client`.
- **Selected by:** [`inspector.svelte`](../inspector.svelte), which reads
  `workbench.currentInspection` and narrows on its kind.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `undefined` | Nothing selected | root markup |
| `copilot` | Conversations, running work, the active chat | [`copilot.svelte`](copilot.svelte) |
| `document-text-selection` | The range and its offsets | [`text-selection.svelte`](text-selection.svelte) |
| `document-next-text` | The caret's block | [`next-text.svelte`](next-text.svelte) |
| `empty` | The kind, named | root fallback |
| `document-table` | The kind, named | root fallback |
| `formula` | The kind, named | root fallback |
| `prompt` | The kind, named | root fallback |

**The map is partial because the application is, not because the union is about
documents.** An inspection is a label for whatever the user is looking at,
anywhere — `copilot` belongs to no resource at all, and slides, spreadsheets, and
research will each contribute their own labels as their editors arrive. What is
built is a view per label some surface can currently produce: the copilot bar
produces one, the workspace's document component produces two. The rest have no
producer, and `empty` needs the insert affordances that belong to an editor;
components for them would be files nothing can reach. The fallback names the
kind, which is the honest rendering of "something is inspected and this panel has
no view for it yet".

**Selection is an if-chain rather than a `Record`**, unlike the workspace and the
context panel. `InspectionNode` is a discriminated union whose members carry
different fields, so a component map would erase the per-kind props and every
component would take `any`. Narrowing on `kind` is what keeps `blockId` and the
offsets typed at the point they are passed.

## Tree Invariants

- **Neither component fetches anything.** When the fetch arrives it belongs to
  the component that needs it, not to the root — the root's job is to decide
  which one renders.
- **Neither writes an inspection.** This panel reads. When it gains controls
  they act on the thing inspected, not on the inspection itself.
