# API: `list`

`list` exposes the whole catalog, for consumers that need a complete view of
what is defined rather than an answer about one name — a name resolver building
its scope, or a caller enumerating what is available.

## Classification

- **Owner:** `NameManager`
- **Execution:** accessor
- **Transaction:** none
- **Entry:** [`list.ts`](list.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `catalog` | `ReadonlyVariableCatalog` | The runtime's declarations, read-only |

## Output

`readonly NamedVariable[]`

Every current declaration, each copied, in the order they were defined. The
array is a snapshot: a later `define` does not appear in it.

## Failures

None. An empty catalog returns an empty array.

## Effects

None.

## Procedure Tree

```text
list(catalog)
  1. Read every current declaration, in definition order.
  2. Copy each one.
  3. Return them.
```

Definition order comes from the catalog's insertion order, and holds because no
declaration is ever removed or replaced — there is no update or delete.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `copyVariable` | The caller must not receive handles on the stored declarations |
