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
- **Purpose:** what is selected in the chart, and what could be done with it.
- **Inputs:** the selection, the data behind it, the series, and a formatter.
- **Outputs:** writes through the selection — clicking a row in the list selects
  just that mark.

**It is the argument for marks.** A chart that is one picture can only be
inspected as one picture. A chart made of addressable marks can be asked what a
particular bar is, and every operation a presentation tool offers — recolour
this one, annotate that one, pull a slice out — is an operation on a selection.

**What it offers depends on the selection's shape**, because one bar, a whole
column, a whole series and an arbitrary handful are four different subjects. The
three actions are drawn disabled with their reasons: none of them exist yet, and
saying so is more honest than an empty panel that implies there was nothing to
offer.
