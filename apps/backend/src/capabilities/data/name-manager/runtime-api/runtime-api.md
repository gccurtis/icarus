# Name Manager Runtime API

One directory per public method on `NameManager`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration. A supporting procedure only one method needs sits beside
that method's entry.

Every entry takes the catalog as its first argument rather than reading one from
anywhere. `InMemoryNameManager` is the only thing that holds a catalog, and these
procedures are functions of the one they are given.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `define` | [`define/`](define/define.md) | mutator | Admits one authored declaration and adds it to the catalog |
| `get` | [`get/`](get/get.md) | accessor | Returns the declaration a name identifies, or `undefined` |
| `require` | [`require/`](require/require.md) | accessor | Returns the declaration a name identifies, or fails |
| `list` | [`list/`](list/list.md) | accessor | Returns every current declaration in definition order |

Every method on the exported interface appears here, and every directory appears
as a method. `pnpm lint` enforces both directions.

`define` is the only mutator, and it is the only entry that receives a mutable
`VariableCatalog`.

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
2. Read the catalog at that name's key.
3. Copy the result out.
```

`define` inserts admission between the name and the write, and decides the name
conflict before admitting the payload — so redefining an existing name reports
the conflict rather than whichever schema fault its value happened to carry:

```text
1. Canonicalize the authored name.
2. Fail if the catalog already holds that name.
3. Admit the type, then the value against it.
4. Write, then copy the result out.
```
