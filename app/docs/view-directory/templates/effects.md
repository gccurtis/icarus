# {{View Name}} Effects

Lives at `src/lib/views/{{view-name}}/effects/effects.md`. This is the one
document for the complete effect tree. Nested effect directories do not carry
their own Markdown files.

Every entry here is `.svelte.ts`.

## Effect Tree

Name each effect entry and the procedures it calls.

```text
TODO reactive or environment trigger      TODO.svelte.ts
├── TODO setup
├── TODO general procedure                ../procedures/TODO.ts
└── TODO cleanup
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every effect appears here and is described under Lifecycles below.

<!-- generated:inventory:start -->
<!-- generated:inventory:end -->

## Lifecycles

Repeat this section for every effect.

### `TODO`

- **Trigger:** TODO
- **Observed values:** TODO
- **Writes:** TODO or `None`
- **External resource:** TODO or `None`
- **General procedures:** TODO or `None`

#### Setup

```text
1. TODO
2. TODO
```

#### Cleanup

```text
1. TODO
2. TODO
```

- **Rerun behavior:** TODO
- **Unmount behavior:** TODO
- **Remount safety:** TODO

## Effect Invariants

- TODO: State a cleanup, subscription, or synchronization invariant.
