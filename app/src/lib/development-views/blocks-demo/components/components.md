# Blocks Demo Components

Lives at `src/lib/development-views/blocks-demo/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
blocks-demo.svelte
├── document-surface                 components/document-surface.svelte
├── slide-surface                    components/slide-surface.svelte
└── block-inspector                  components/block-inspector.svelte
```

## Inventory

<!-- generated:inventory:start -->
- [`block-inspector.svelte`](block-inspector.svelte)
- [`document-surface.svelte`](document-surface.svelte)
- [`slide-surface.svelte`](slide-surface.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `document-surface` and `slide-surface`

- **Roots:** [`document-surface.svelte`](document-surface.svelte),
  [`slide-surface.svelte`](slide-surface.svelte)
- **Purpose:** the two conventions a block can be rendered under.
- **Inputs:** the blocks for that surface, the selection, and two callbacks.
- **Outputs:** selection and text, upward. Neither holds state.

**They differ in three lines and that is deliberate.** One sets a measure and
passes no `chrome`; the other sets an aspect ratio and passes `chrome`. If the
difference between a document and a slide needed more than that, the block
component would be carrying a surface's decisions.

### `block-inspector`

- **Root:** [`block-inspector.svelte`](block-inspector.svelte)
- **Purpose:** what can be changed about the selected block.
- **Inputs:** the block, and an update function.
- **Outputs:** writes through the update function.

**The size section is different for each sizing, and absent for one.** A `flow`
paragraph gets no size controls — not disabled ones, none — because the column
owns its width and its height is whatever the text needs. Drawing a greyed-out
width there would be a control that can never work on this thing.
