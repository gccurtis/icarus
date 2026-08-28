# Analysis Demo Components

Lives at `src/lib/views/analysis-demo/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
analysis-demo.svelte
├── chart-stage                      components/chart-stage.svelte
└── data-table                       components/data-table.svelte
```

## Inventory

<!-- generated:inventory:start -->
- [`chart-stage.svelte`](chart-stage.svelte)
- [`data-table.svelte`](data-table.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `chart-stage`

- **Root:** [`chart-stage.svelte`](chart-stage.svelte)
- **Purpose:** the framed chart, and the one place a Marimekko is chosen instead
  of an ordinary one.
- **Inputs:** the kind, the layout, the orientation, the rows, the series.
- **Outputs:** the rendered `svg`, bound upward so the page can photograph it.

**Why the Mekko branches here rather than inside `Chart`.** A Marimekko needs a
second quantity — the one that sets each column's width — which no other kind
reads. Putting it behind a `kind` would give `Chart` a prop that is meaningless
five times out of six.

### `data-table`

- **Root:** [`data-table.svelte`](data-table.svelte)
- **Purpose:** the numbers, editable in place, and the filter over them.
- **Inputs:** the rows and the threshold, both bound.
- **Outputs:** writes through the bindings; the chart is downstream of them.

**It is `ScreenTable` holding `PanelEditableText`**, and that composition is the
claim worth making: the editing vocabulary was built for a 300px panel and drops
into a table cell with nothing added. Reaching for a grid-editing component here
would have been the obvious move and would have produced a second way to edit.
