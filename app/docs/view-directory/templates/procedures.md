# {{View Name}} Procedures

Lives at `src/lib/views/{{view-name}}/procedures/procedures.md`. This is the one
document for general procedures that are neither interactions nor effects. It
carries the complete procedure tree; nested procedure directories have no
Markdown files.

## Procedure Tree

Name real entry and helper paths. Procedure directories are one level deep.

```text
TODO()                                      TODO.ts
TODO()                                      TODO/TODO.ts
├── TODO()                                  TODO/private-helper.ts
└── TODO()                                  TODO/another-helper.ts
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every procedure and private helper appears here, and each is described
under Contracts below.

<!-- generated:inventory:start -->
<!-- generated:inventory:end -->

## Contracts

Repeat this section for every procedure. Include the algorithm and helper rows
for complex procedures; write `None` for a simple procedure.

### `TODO`

- **Purpose:** TODO
- **Callers:** TODO
- **Input:** TODO
- **Output:** TODO
- **Mutation:** TODO or `None`
- **Preserved invariant:** TODO

#### Algorithm

```text
1. TODO
2. TODO
```

#### Private helpers

| Helper | File | Responsibility |
| --- | --- | --- |
| TODO or `None` | TODO | TODO |

#### Edge cases and failures

- TODO

## Procedure Invariants

- TODO: State an invariant shared by several procedures.
