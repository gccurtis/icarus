# {{View Name}} Components

Lives at `src/lib/views/{{view-name}}/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

Name every component with its real path.

```text
{{view-name}}.svelte
├── TODO                             components/TODO.svelte
└── TODO                             components/TODO/TODO.svelte
    └── TODO                         components/TODO/components/TODO.svelte
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
<!-- generated:inventory:end -->

## Subtree Contracts

Repeat this section for each component directory or other meaningful subtree.
Small leaf components need only the inventory row above.

### `TODO`

- **Root:** TODO: Link the matching `.svelte` entry.
- **Purpose:** TODO
- **Inputs:** TODO
- **Outputs:** TODO
- **Owned children:** TODO
- **Behavior delegated to the view root:** TODO or `None`
- **Focus behavior:** TODO
- **Layout and overflow:** TODO
- **Accessibility:** TODO

## Key Selection

Complete this section when a model key chooses which component renders.
Otherwise write `None`.

- **Key:** TODO: Name the model type, such as `ResourceKind` or `ActivityId`.
- **Selected by:** TODO: Name the component that reads the key and renders the
  match.

| Key value | Renders | Component or composed view |
| --- | --- | --- |
| `TODO` | TODO | TODO |

The mapping is total in both directions: every key value has a component, and
every component listed is reachable by a key. State any deliberate exception and
what renders in its place.

## Tree Invariants

- TODO: State an ownership or composition rule that spans components.
- TODO: State where scrolling, focus, or selection is owned.
