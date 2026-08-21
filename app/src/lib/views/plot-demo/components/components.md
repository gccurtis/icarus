# Plot Demo Components

Lives at `src/lib/views/plot-demo/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
plot-demo.svelte
└── selection-panel                  components/selection-panel.svelte
```

## Inventory

<!-- generated:inventory:start -->
- [`selection-panel.svelte`](selection-panel.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `selection-panel`

- **Root:** [`selection-panel.svelte`](selection-panel.svelte)
- **Purpose:** what semantic chart parts are selected.
- **Inputs:** the selection and its `ChartModel`.
- **Outputs:** writes through the selection — clicking a row in the list selects
  just that mark.

**It is the argument for identified parts.** A chart that is one picture can only
be inspected as one picture. This panel resolves every supported mark family,
axis, or added element back to its persisted id and model value.

**What it offers depends on the selection's shape**, because one bar, a whole
category, a whole series, an axis, an annotation, and an arbitrary handful are
different subjects. Model actions in the demo use those same targets to recolour
selected datums and remove selected elements.
