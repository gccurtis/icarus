# Top Bar Effects

Lives at `src/lib/surfaces/top-bar/effects/effects.md`. This is the one
document for the complete effect tree. Nested effect directories do not carry
their own Markdown files.

Every entry here is `.svelte.ts`.

## Effect Tree

```text
the held appearance changes               apply-appearance.svelte.ts
├── write data-appearance on <html>
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

- **Trigger:** the appearance held by this module changes.
- **Observed values:** the module's own state. It takes no reader, because the
  state and the effect that publishes it are the same thing — see the invariant
  below.
- **Writes:** `data-appearance` on the document root; the `icarus.appearance`
  localStorage key.
- **External resource:** the document root and browser storage. Neither is held.
- **General procedures:** `None`

#### Setup

```text
1. Read the held appearance.
2. Assign data-appearance on the document root.
3. Write { appearance } to localStorage, ignoring a blocked or full store.
```

#### Cleanup

```text
None. The attribute is the page's lasting state rather than a resource this
effect holds, and clearing it on teardown would strip the appearance from a
document that is still rendered.
```

- **Rerun behavior:** reassigns the attribute and rewrites the key.
- **Unmount behavior:** the attribute remains, and the page keeps its
  appearance.
- **Remount safety:** safe. Each mount writes the same two places, and neither
  accumulates.

## Effect Invariants

- **One applier, called once, at the root.** `+layout.svelte` calls
  `applyAppearance()` and nothing else does. The appearance is a property of the
  document, and a document has one.
- **The control sets, it does not apply.** The top bar and the demo bar write
  `appearance.current` and stop there. A component that both held the choice and
  published it would be a second answer to a question with one — which is
  exactly what this file used to be, in two copies.
- **Stored state is validated, never trusted.** What comes out of storage was
  written by an earlier version of this page; the appearance is checked against
  the declared list before it is used, and anything else falls back to Helios.
- **A blocked store costs persistence, not the choice.** Writing is wrapped so
  a private-mode or full store leaves the reader with the appearance they picked
  for as long as the page lives.
