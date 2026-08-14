# Name Manager Runtime API

One directory per public method on `NameManager`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration. A supporting procedure only one method needs sits beside
that method's entry.

Every entry takes a project-bound `NameManagerStore` as its first argument rather
than reading a database or project ID from anywhere. `PersistedNameManager`
holds that port, and every procedure returns a promise because the database is
authoritative.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `define` | [`define/`](define/define.md) | mutator | Admits one authored declaration and persists it once |
| `get` | [`get/`](get/get.md) | accessor | Returns the declaration a name identifies, or `undefined` |
| `require` | [`require/`](require/require.md) | accessor | Returns the declaration a name identifies, or fails |
| `list` | [`list/`](list/list.md) | accessor | Returns every current declaration in definition order |

Every method on the exported interface appears here, and every directory appears
as a method. `pnpm lint` enforces both directions.

`define` is the only mutator. All four methods receive the same narrow store
port; only `define` calls its `create` operation.

## Shared Procedures

Two procedures sit in [`shared/`](shared/shared.md): `canonicalName` with
`nameKey`, which decide what a name is and when two names are the same, and
`copyVariable`, which severs object references at the boundary. Both are called
by three of the four methods, and each preserves an invariant that would break
the moment one method disagreed with another about it.

Everything else stays in its method's directory. `define` holds the whole
admission tree — five files — because no other method validates anything.

## Common Shape

Each accessor is one pass:

```text
1. Canonicalize the caller's name.
2. Query the project-bound store at that name's key.
3. Copy the result out.
```

`define` inserts admission between the name and the write, and decides the name
conflict before admitting the payload — so redefining an existing name reports
the conflict rather than whichever schema fault its value happened to carry:

```text
1. Canonicalize the authored name.
2. Fail if the store already holds that name.
3. Admit the type, then the value against it.
4. Insert with the database uniqueness constraint as the final arbiter.
5. If the insert lost a race, fail with the same name conflict.
6. Copy the result out.
```
