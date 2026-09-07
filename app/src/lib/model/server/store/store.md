# store

Every table, in memory, for the life of the process. One JSON file per table
under the directory `configuration/representation.yaml` names.
The process-level `ICARUS_STORE_DIRECTORY` override exists for isolated harnesses;
the Playwright server points it at a disposable seed copy and removes that copy
when the server exits. Ordinary development never sets it and continues to use
`data/`.

A path is a string — `documents.r-memo.title` — so what goes in is `unknown`
and what comes back is `Found`. What a field holds is checked by the procedure
that calls this, not here.

Reads are in memory. Every mutation writes its whole table file synchronously,
so there is nothing to flush and nothing to close. A table is first written to
a sibling next-file and renamed into place; only then does the live in-memory
map adopt it. A failed persistence attempt therefore cannot create phantom live
state. New rows receive opaque UUID identities rather than an id derived from
the rows still present; deleting a row therefore cannot make a stale client id
refer to a later replacement. `createMany` admits every
candidate first, then appends all rows and persists the table once; it is the
write boundary for materialized collections such as spreadsheet cells. It is
atomic for one table change, not a transaction across table files. Batched row
and top-level-field removals provide the same one-table boundary.
