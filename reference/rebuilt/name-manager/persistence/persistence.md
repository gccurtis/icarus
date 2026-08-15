# Name Manager Persistence

Tables, not queries. The SQL lives with the function that runs it — see
[`api/api.md`](../api/api.md).

| File | Holds |
| --- | --- |
| [`tables.ts`](tables.ts) | the Kysely table type, and its registration on `Database` |
| [`initialize.ts`](initialize.ts) | the DDL, the index, and the drift check |
| [`stored-types.ts`](stored-types.ts) | row ↔ canonical conversion |

## The table

```sql
name_manager_variables
  name_key          text primary key      -- lowercased lookup form
  name              text not null         -- authored casing
  declared_type     jsonb not null
  value             jsonb not null
  definition_order  integer generated always as identity not null
```

Indexed on `definition_order` for [`list`](../api/list/list.md), which orders by
it on every call.

## No `project_id`

The backend's version of this table carried one, with a composite primary key and
a predicate on every statement. All of it is gone.

A project is its own database, so scoping is **structural**: there is no
predicate to write and therefore none to forget, and a capability that failed to
scope could not leak across projects because there is no cross-project reach to
fail at. `definition_order` is naturally per-project for the same reason — the
backend had to index `(project_id, definition_order)` to get the answer this gets
from one column.

A `project_id` column appearing here later would mean the wrong model had been
imported along with the code.

## `name_key` is the primary key

A variable *is* its name. There is no second thing to identify, and a surrogate
id would let two rows claim the same name.

The key is the **lowercased** form while `name` keeps what the author wrote,
which is what makes `Total` and `total` the same variable and still shows an
author their own casing. `canonicalName` and `nameKey` in
[`api/shared`](../api/shared/shared.md) own that derivation, and every reader and
the writer go through them.

## Initialization verifies as well as creates

`createTable().ifNotExists()` is not a migration strategy — it creates when
absent and does nothing when present, so the first added column silently succeeds
against an outdated database and fails later at query time, far from the cause.

After creating, `initialize` introspects the columns actually present and throws
on any difference **in either direction**. A missing column is the obvious case;
an unexpected one is the direction that is easy to miss, because dropping a
column from `tables.ts` leaves the database exactly as it was and every query
keeps working until someone wonders what the column is for.

Real migrations replace this later. The check buys time, not correctness.

## `value` is `ColumnType`, not `JSONColumnType`

Kysely's `JSONColumnType` constrains what it selects to `object | null`. A
variable may legitimately hold a bare `true` or `3` — a scalar declaration is
exactly that case — and `jsonb` stores a scalar perfectly well.

`declared_type` uses `JSONColumnType`, because a `TableType` is always an object.

## Copying at the boundary

`currentNamedVariable` clones. `jsonb` arrives as a live object graph the driver
just built, and handing it straight out would let a consumer mutate something a
later reader also holds.

Because the copy happens here, **no read path copies again.** `get`, `require`,
and `list` return what this produced. Only [`define`](../api/define/define.md)
has its own copy, and for the opposite reason: what it returns never came from
the database at all.
