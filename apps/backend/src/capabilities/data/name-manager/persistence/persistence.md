# Name Manager Persistence

`persistence/` stores the canonical named-variable catalog. It does not admit
declarations or decide name semantics; the runtime API validates first and asks
the store to persist only canonical values.

## Files

| File | Holds |
| ---- | ----- |
| `schema.ts` | The `name_manager_variables` table and its `BackendDatabase` augmentation |
| `stored-types.ts` | Translation between canonical declarations and JSON-backed row values |
| `store.ts` | The project-bound table interface and PGlite/Kysely implementation |

## Table: `name_manager_variables`

| Column | Type | Description |
| ------ | ---- | ----------- |
| `project_id` | `text` | The catalog namespace supplied at construction |
| `name_key` | `text` | Lower-cased canonical name; part of the primary key |
| `name` | `text` | Canonical name with authored casing preserved |
| `declared_type` | `jsonb` | The admitted table type and recursive schema |
| `value` | `jsonb` | The admitted canonical value |
| `definition_order` | identity `integer` | Stable ordering assigned by PostgreSQL |

The primary key is `(project_id, name_key)`, so the database closes the race
between concurrent definitions of the same case-insensitive name. An index on
`(project_id, definition_order)` serves ordered catalog reads. Identity gaps are
allowed; only relative order is meaningful.

## Stored Versus Canonical

Project, lookup key, and order are storage concerns and do not appear on
`NamedVariable`. Type and value are serialized as JSONB only after the complete
declaration has passed Name Manager admission. Reads reconstruct fresh canonical
values; a row object never leaves this directory.

## Store Operations

| Operation | Reads / Writes | Description |
| --------- | -------------- | ----------- |
| `initialize` | write | Creates the table and listing index if absent |
| `find` | read | Looks up one declaration in the bound project |
| `create` | write | Inserts once and reports whether it won the unique-name race |
| `list` | read | Returns the bound project's declarations in definition order |

## Concurrency

`define` first checks for an existing key so name conflict retains precedence
over payload validation. Its final insert uses `ON CONFLICT DO NOTHING`; if a
second writer claims the name after that check, the losing insert reports false
and the runtime raises the same `name-conflict` error. A declaration is one row,
so no explicit transaction is required.

## Invariants

- A project and normalized name identify at most one declaration.
- Only canonical declarations are written.
- Every query is constrained to the store's bound project.
- Definition order survives runtime reconstruction and process restart.
