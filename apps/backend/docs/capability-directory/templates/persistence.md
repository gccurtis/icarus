# {{Capability Name}} Persistence

Lives at `persistence/persistence.md`.

`persistence/` holds storage concerns only. It does not decide capability
behavior and does not admit requests. Transactions are started and coordinated
by [`runtime-api`](../runtime-api/runtime-api.md) entries; the store executes
what they ask for.

## Files

| File | Holds |
| ---- | ----- |
| `schema.ts` | Table definitions and the create-if-absent initialization run at construction |
| `stored-types.ts` | Rows exactly as stored, distinct from the canonical types in [`types/`](../types/types.md) |
| `store.ts` | The table interface: ordered reads and transaction-scoped writes |

## Tables

### Table: `{{table_name}}`

{{What it stores and which canonical type it corresponds to.}}

| Column | Type | Description |
| ------ | ---- | ----------- |
| `{{column_name}}` | `{{sql_type}}` | {{Meaning, and whether it is part of the key}} |

**Indexes:** {{indexes and what query each serves, or "none"}}

## Stored Versus Canonical

{{Where the stored shape differs from the canonical type and why — serialized
columns, denormalized ordering, columns that exist only for querying. State the
translation point, so a reader knows a row is never handed out directly.}}

## Store Operations

| Operation | Reads / Writes | Description |
| --------- | -------------- | ----------- |
| `{{operationName}}` | {{read / write}} | {{What it does and which runtime-api methods call it}} |

## Concurrency

{{How concurrent writers are handled: revision gates, compare-and-swap,
transaction boundaries, and what a caller sees when it loses a race.}}

## Invariants

- {{What must remain true of stored rows regardless of which operation ran.}}
- {{Ordering, uniqueness, or referential guarantees.}}
