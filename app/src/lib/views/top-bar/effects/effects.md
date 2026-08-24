# Top Bar Effects

Lives at `src/lib/views/top-bar/effects/effects.md`. This is the one
document for the complete effect tree. Nested effect directories do not carry
their own Markdown files.

Every entry here is `.svelte.ts`.

## Effect Tree

```text
the chosen theme changes                  apply-theme.svelte.ts
├── write data-theme on <html>
└── write the icarus.appearance key
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every effect appears here and is described under Lifecycles below.

<!-- generated:inventory:start -->
- [`apply-theme.svelte.ts`](apply-theme.svelte.ts)
<!-- generated:inventory:end -->

## Lifecycles

### `applyTheme`

- **Trigger:** the `ThemeName` returned by the reader changes.
- **Observed values:** the theme name, read through the caller's closure so the
  effect never holds the state it applies.
- **Writes:** `data-theme` on the document root; the `icarus.appearance`
  localStorage key.
- **External resource:** the document root and browser storage. Neither is held.
- **General procedures:** `None`

#### Setup

```text
1. Read the current theme.
2. Assign data-theme on the document root.
3. Write { theme } to localStorage, ignoring a blocked or full store.
```

#### Cleanup

```text
None. The attribute is the page's lasting state rather than a resource this
effect holds, and clearing it on teardown would strip the theme from a document
that is still rendered.
```

- **Rerun behavior:** reassigns the attribute and rewrites the key.
- **Unmount behavior:** the attribute remains, and the page keeps its
  appearance.
- **Remount safety:** safe. Each mount writes the same two places, and neither
  accumulates.

## Effect Invariants

- **The document root is the only place a theme is applied.** One attribute
  drives every `light-dark()` in the slot table, so a second application point
  would be a second answer to a question with one.
- **Stored state is validated, never trusted.** What comes out of storage was
  written by an earlier version of this page; the theme is checked against the
  declared list before it is used, and anything else falls back to the default.
- **A blocked store costs persistence, not the choice.** Writing is wrapped so
  a private-mode or full store leaves the reader with the theme they picked for
  as long as the page lives.
- **The effect reads, it does not own.** State is passed in as a reader, which
  is what lets the component hold the choice and the effect stay a synchronizer.
