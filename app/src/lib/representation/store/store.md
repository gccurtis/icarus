# store

What a table is, what a read and a write are, and what it takes to open one.

One JSON file per table, read whole on open and rewritten whole on every
mutation — so there is nothing to keep in step, and a crash cannot land between a
change and its write. There are no indexes; `where` is the scan that replaces
one.

| | |
| --- | --- |
| `tables.ts` | all 35 table declarations, their names, and the set of stores over them |
| `store.server.ts` | what a read and a write are, and where a table's file sits |
| `admission.ts` | the two claims that cannot be left as claims — a table name becomes a path segment, a row id becomes a map key |

**Definitional, like everything outside `runtime/`.** This says what a store is;
it does not open one and does not hold one open. The directory it reads from is
`representation.store.directory` in configuration, and the object that takes both
— the declarations and the directory — and turns them into an open store belongs
in `runtime/server/`.

Two functions here have not made that move yet: `createStore` in
`store.server.ts` and `createJsonStore` in `tables.ts` still do the opening. They
are the last non-definitional code outside `runtime/`, named here so that is a
known gap rather than something to discover.
