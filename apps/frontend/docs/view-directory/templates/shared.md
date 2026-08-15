# {{View Name}} Shared State

Lives at `src/lib/views/{{view-name}}/shared/shared.md`. It documents state and
context shared by components in one mounted view instance.

## Construction

- **Constructor:** [`create-shared.svelte.ts`](create-shared.svelte.ts)
- **Types:** [`types.ts`](types.ts)
- **Constructed by:** TODO
- **Access mechanism:** TODO: Props, snippets, or view-owned context.

The directory exports constructors or context accessors, never an instantiated
module singleton.

## Values

| Value | Type | Initial value | Readers | Writers |
| --- | --- | --- | --- | --- |
| `TODO` | `TODO` | TODO | TODO | TODO |

## Lifetime

- **Created:** TODO
- **Destroyed:** TODO
- **Reset:** TODO or `None`
- **Cleanup:** TODO or `None`

## Mutation Rules

- TODO: State who may mutate each value and through which operation.
- TODO: State derived values and their source fields.

## Consumers

| Component | Values used | Reason |
| --- | --- | --- |
| TODO | TODO | TODO |

## Why This Is View State

TODO: Explain why the state may die with this view and does not belong in a
client model, persisted preference, or workbench snapshot.

## Shared-State Invariants

- TODO: State an instance, mutation, or consistency invariant.
