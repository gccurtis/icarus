# store

Every table, in memory, for the life of the process. One JSON file per table
under the directory `configuration/representation.yaml` names.

A path is a string — `documents.r-memo.title` — so what goes in is `unknown`
and what comes back is `Found`. What a field holds is checked by the procedure
that calls this, not here.

Reads are in memory. Every mutation writes its whole table file synchronously,
so there is nothing to flush and nothing to close.
