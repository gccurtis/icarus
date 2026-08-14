# Persistence

One table, `settings`, in each project's own database.

| File | Holds |
| --- | --- |
| [`tables.ts`](tables.ts) | the Kysely table type, and its registration on `Database` |
| [`initialize.ts`](initialize.ts) | the DDL, and the drift check |
| [`stored-types.ts`](stored-types.ts) | row to canonical |

There is no `store.ts`. SQL lives in the function that runs it — see
[`api/api.md`](../api/api.md).

## No `project_id`

A project is its own database, so scoping is **structural**: there is no
predicate to write and therefore none to forget. A column here would mean the
wrong model had been imported along with the code.

This is the property the whole per-project registry exists to buy, and it is
worth naming because the alternative looks so reasonable in isolation. A
`where project_id = ?` on every query is one clause away from being absent on
one of them, and that one is a cross-project read.

## The key is the identity

No surrogate id. There is no second thing to name, and a surrogate would let two
rows claim the same key while the database considered them distinct.

## The drift check is not a migration system

`createTable().ifNotExists()` creates when absent and does nothing when present.
That means the first column added to `tables.ts` succeeds silently against an
outdated database, and fails much later at query time — far from the change that
caused it.

So initialization introspects afterwards and compares what exists against what
was declared, in **both directions**. A missing column is the obvious case. An
*extra* column is the one that gets missed: dropping a column from `tables.ts`
leaves the database exactly as it was, and every query keeps working until
someone wonders what the column is for.

What this buys is that the report arrives at boot rather than mid-request.
Repairing drift is still a person's job, and Kysely's `Migrator` is the eventual
answer.

## Registration

`initializeSettings` is listed in the persistence runtime's initializer list.
A capability that is not listed there has no tables, however many it declares —
which surfaces as the first query against a table nobody created.
