# Demo Effects

Lives at `src/lib/views/demo/effects/effects.md`. This is the one
document for the complete effect tree. Nested effect directories do not carry
their own Markdown files.

Every entry here is `.svelte.ts`.

## Effect Tree

```text
appearance selection changes              apply-appearance.svelte.ts
├── write data-theme on <html>
└── write the icarus.appearance key
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every effect appears here and is described under Lifecycles below.

<!-- generated:inventory:start -->
- [`apply-appearance.svelte.ts`](apply-appearance.svelte.ts)
<!-- generated:inventory:end -->

## Lifecycles

### `applyAppearance`

- **Trigger:** The `Appearance` returned by the reader changes.
- **Observed values:** `theme`
- **Writes:** `data-theme` on the document root; the `icarus.appearance`
  localStorage key.
- **External resource:** The document root and browser storage. Neither is held.
- **General procedures:** `None`

#### Setup

```text
1. Read the current appearance.
2. Assign data-theme on the document root.
3. Write the appearance to localStorage, ignoring a blocked or full store.
```

#### Cleanup

```text
None.
```

- **Rerun behavior:** Reassigns both attributes.
- **Unmount behavior:** The attributes remain.
- **Remount safety:** Safe.

## Effect Invariants

- The document root is the only place appearance is applied.
- Stored appearance is validated against the declared theme and set names before
  it is used.
