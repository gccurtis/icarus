# {{Capability Name}} Persistence

Lives at `persistence/persistence.md`.

`persistence/` holds **tables, not queries**. It describes what is stored and
brings the tables into existence; it runs none of the capability's reads or
writes. Those live with the function that runs them — Kysely is already the query
interface, and a wrapper over it would either fail to express a real multi-row
transactional operation or grow parameters until it was a worse query builder.

## Files

| File | Holds |
| ---- | ----- |
| `tables.ts` | Kysely table types, and the `declare module` block registering them on the `Database` interface |
| `initialize.ts` | The DDL, and the drift check that runs after it |
| `stored-types.ts` | Rows exactly as stored, and the conversion to and from the canonical types in [`types/`](../types/types.md) |

## Project Scoping

A project is its own database. **No table here carries a `project_id` column and
no query carries a `project_id` predicate** — the registry in
`$model/server/persistence` opens the right database from `scope.projectId`
before any of this is reached. A capability that forgets to scope cannot leak
across projects, because there is no cross-project reach to forget.

{{If any table is also scoped to a user, say so here and say why. That column
belongs in the primary key rather than beside it, so a write that omits it
collides instead of quietly landing in another user's row.}}

## Tables

### Table: `{{table_name}}`

{{What it stores and which canonical type it corresponds to.}}

| Column | Type | Description |
| ------ | ---- | ----------- |
| `{{column_name}}` | `{{sql_type}}` | {{Meaning, and whether it is part of the key}} |

**Primary key:** {{the columns, and what uniqueness they enforce}}

**Indexes:** {{indexes and what query each serves, or "none"}}

## Initialization

`initialize.ts` exports one function that the persistence object calls at
startup, once per project database, in the order that object lists.

It does two things, and the second is the point:

1. **Creates** the tables if they are absent.
2. **Verifies** them — introspects the columns actually present and throws when
   they differ from what `tables.ts` declares.

The check exists because `createTable().ifNotExists()` is not a migration
strategy. It creates when absent and does *nothing* when present, so the first
added column silently succeeds against an outdated database and then fails at
query time, far from the cause. The drift check turns that into a startup failure
that names the difference.

{{State what this capability's check compares, and what it does not: type
equivalence across dialects is unreliable — the same declaration reports
different names on different engines — so compare what is stable.}}

## Stored Versus Canonical

{{Where the stored shape differs from the canonical type and why — serialized
columns, denormalized ordering, columns that exist only for querying. State the
translation point, so a reader knows a row is never handed out directly.}}

## Concurrency

{{How concurrent writers are handled: revision gates, compare-and-swap, and what
a caller sees when it loses a race. Transaction boundaries are opened by `api/`
entries, so name which ones and what each spans.}}

## Invariants

- {{What must remain true of stored rows regardless of which function ran.}}
- {{Ordering, uniqueness, or referential guarantees.}}
