## What it is

The vocabulary. Every other tree speaks in the types declared here, and the tree itself speaks in nothing else: no file under `src/lib/representation` imports another tree ([[check:representation-imports-nothing-else]]). It is the one place a shape is defined once, and the reason two surfaces cannot hold different opinions about what a document row is.

Three kinds of file live here and nothing else ([[check:representation-layout]]): type declarations under `data/types/`, pure behaviour under `data/behavior/`, and the store's declarations under `store/`.

## What it owns

- **Type declarations**, one directory per domain — thirteen of them, from `agents` to `workspace`. A type file compiles to nothing ([[check:types-emit-nothing]]), checked against compiled output rather than source so a re-export that survives erasure is caught.
- **Pure behaviour** for four domains: `core` (ids, resource refs), `semantic` (encoding, token alignment, segmentation, translation), `slide-decks` (applying ops to a deck body) and `workspace` (the opening rails, the starting workspace, op inversion, and the two generated vocabularies). Same arguments, same answer, on either side of the boundary ([[check:behavior-is-pure]]): no Svelte, no `node:*`, no clock, no environment.
- **The store's declarations**: [[file:app/src/lib/representation/store/tables.ts]] names the 42 tables and the fields of each row; [[file:app/src/lib/representation/store/path.ts]] is the path algebra (`table.id.field…`) every read and write is spelled in; [[file:app/src/lib/representation/store/admission.ts]] is what the store checks before acting on a name it did not mint. Nothing here opens a file ([[check:store-opens-nothing]]) — a lifetime belongs to the runtime, and the server object that owns it is [[page:/trees/model#units|model/server/store]].

## What it may and may not import

Nothing outside itself. Within the tree, a domain may import only the domains it declares in [[file:app/configuration/representation.yaml]], and the declared graph must be acyclic ([[check:domain-graph-is-declared]]). The [[page:/data-model#the-domain-graph|domain graph]] page draws it from that file.

## Shape on disk

```
representation/
  representation.md
  data/
    data.md
    types/<domain>/*.ts        thirteen domains, types only
    behavior/<domain>/*.ts     pure functions; test/ beside them
  store/
    store.md
    tables.ts                  TABLE_NAMES and TableFields
    path.ts                    StorePath, readAt, writtenAt, removedAt, createdIn
    admission.ts               asTable, asRowId
```

## Invariants

The six checks under `scripts/lint/representation/` are listed below with their own words. Two of them are worth reading before anything else: types emit nothing, and behaviour is pure. Everything the client and server agree on rests on those two.

## What to open first

1. [[file:app/src/lib/representation/representation.md]] — the tree's own account of itself.
2. [[file:app/src/lib/representation/data/types/core/id.ts]] — `Id<Table>` is a branded string and `Row<Table>` is what every row carries.
3. [[file:app/src/lib/representation/data/types/documents/body.ts]] and [[file:app/src/lib/representation/data/types/documents/op.ts]] — a body is rows of blocks; an op is `set`, `insert`, `remove`, `move` or `text`, each carrying enough to invert itself.
4. [[file:app/src/lib/representation/data/behavior/workspace/opening.ts]] — what each category opens on, and which context views ride its rail.
5. [[file:app/src/lib/representation/store/path.ts]] — how a path becomes a read or a write.

Note that [[file:app/src/lib/representation/store/store.md]] describes 35 tables and a `store.server.ts` that no longer exists; `tables.ts` declares 42, and the object that opens the directory is `model/server/store`. The code wins; see [[page:/gaps|Gaps]].

## Units
