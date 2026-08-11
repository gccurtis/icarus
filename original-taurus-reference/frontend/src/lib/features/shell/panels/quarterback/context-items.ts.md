# context-items.ts

The **context-item projection** for the Current-context manager: which concrete items the
enabled context sources contribute right now. Pure functions of the store values the manager
passes in — `context-items.test.ts` covers the projection without mounting a component (the
same model-computes/component-renders split as the document panels).

## `contextItemsFor({enabled, excluded, activeTab, resources})`

Builds the list source by source, in display order:

- **`document`** — the active resource tab, when there is one (`kind === 'resource'` with a
  resource id). A "new tab" contributes nothing.
- **`selection`** — a single fixed "Current editor selection" entry.
- **`knowledge`** — every project resource *except* the open one (it is already the `document`
  entry; listing it twice would let one removal silently survive as the other).
- **`sources`** — two illustrative linked-source entries; the source toggle itself is badged
  Mock in the grid (`aiContextSourceOptions.wired`).

Exclusions (`excludedContextItemIds`) filter the built list at the end, so an excluded item
stays excluded whichever source contributed it.

## `filterContextItems(items, query)`

Case-insensitive substring match over `name + typeLabel`; a blank query returns the list
unchanged.
