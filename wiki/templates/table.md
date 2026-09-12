---
name: {{Table Name}}
environment: server
data-type: table
last-commit: {{git commit hash}}
last-update: {{last review date}}
---

# {{Table Name}}

> Copy this file to `wiki/tables/<table-name>.md` and replace every
> `{{placeholder}}`. Keep the document synchronized with production source.
> Show exact signatures and meaningful code blocks; do not use pseudocode where
> the real code is short enough to review directly.

## Purpose

{{Describe the purpose of this table and what one row represents.}}

| Column | SQL type | Rust type | Nullable | Default |
| --- | --- | --- | --- | --- |
| `{{column_name}}` | `{{sql_type}}` | `{{RustType}}` | {{yes or no}} | {{SQL default or none}} |

## Source Map

| File | Role |
| --- | --- |
| `{{path/to/schema.sql}}` | Exact current table, constraint, and index definition |
| `{{path/to/row.rs}}` | Database row representation |
| `{{path/to/types.rs}}` | Exact admitted domain types |
| `{{path/to/admit.rs}}` | SQL-row-to-domain admission |
| `{{path/to/persistence.rs}}` | Reads, writes, and transaction participation |
| `{{path/to/seed.json}}` | Deterministic development/test seed rows |
| `{{path/to/test.rs}}` | Schema, admission, ownership, and transaction evidence |

## Physical Schema

{{Describe where this schema is installed and which runtime component owns its
creation. Include the complete current-schema DDL, including constraints and
indexes.}}

```sql
CREATE TABLE {{table_name}} (
    {{column_name}} {{sql_type}} {{column_constraints}}
);

CREATE INDEX {{index_name}}
    ON {{table_name}} ({{indexed_columns}});
```

## Columns

Repeat this subsection for every column.

### `{{column_name}}`

| Property | Contract |
| --- | --- |
| SQL type | `{{sql_type}}` |
| Rust type | `{{RustType}}` |
| Meaning | {{What this value represents in the domain}} |
| Constraints | {{Nullability, default, check, uniqueness, format, and range constraints}} |

{{Explain how the SQL value is encoded and decoded, including any distinction
between a database representation and the admitted domain value.}}

```rust
pub(crate) type {{RustType}} = {{ExactRustDefinition}};
```

## Supporting Types

Repeat this subsection for every enum, identifier, composite value, or admitted
domain type used by more than one column or operation.

### `{{TypeName}}`

{{Describe the type, its valid values, and why it is distinct from its underlying
SQL representation.}}

```rust
{{Exact Rust type definition}}
```

## Keys and Relationships

### Keys

| Key | Columns | Guarantee |
| --- | --- | --- |
| Primary | `{{primary_key_columns}}` | {{Identity and stability guarantee}} |
| Unique | `{{unique_columns}}` | {{Domain uniqueness guarantee}} |
| Natural | `{{natural_key_columns or none}}` | {{Selection purpose or why none exists}} |

### Relationships

| Relationship | Local columns | Referenced table and columns | Cardinality | On update | On delete |
| --- | --- | --- | --- | --- | --- |
| {{relationship name}} | `{{local_columns}}` | `{{table}}({{columns}})` | {{one-to-one, one-to-many, or many-to-many}} | {{action}} | {{action}} |

{{Explain which relationship establishes project/resource ownership and why a
caller-supplied identifier is selection input rather than proof of authority.}}

```mermaid
erDiagram
    {{PARENT_TABLE}} ||--o{ {{TABLE_NAME}} : "{{relationship}}"
```

## Row Invariants, Admission, and Retention

### Row Invariants

- {{Invariant enforced by a SQL constraint.}}
- {{Invariant enforced during a multi-column or multi-table transaction.}}
- {{Invariant that must also hold in the admitted Rust representation.}}

### Admission

{{Describe the exact conversion from the database row to the current Rust domain
type. State how nullability, enums, identifiers, ranges, and malformed stored
values are handled. Invalid stored data is a storage fault, not a domain
refusal. Do not describe legacy readers or compatibility fallbacks.}}

```rust
pub(crate) fn {{admit_row}}(
    row: {{DatabaseRow}},
) -> Result<{{DomainType}}, {{AdmissionError}}> {
    // Exact current-schema admission.
}
```

### Retention

| Event | Behavior |
| --- | --- |
| Parent deletion | {{Restrict, cascade, detach, or explicit transaction behavior}} |
| Direct deletion | {{Who may delete and which related rows change atomically}} |
| Expiration | {{Retention duration and cleanup owner, or explicitly none}} |
| Recovery | {{Whether committed rows are restored, rebuilt, or intentionally discarded}} |

## Transactions and Concurrency

{{Describe every multi-table intent involving this table. All reads that decide a
write and all participating writes must use the same transaction.}}

| Concern | Contract |
| --- | --- |
| Transaction owner | {{Capability, model adapter, or runtime entry point}} |
| Participating tables | `{{table list}}` |
| Isolation | {{Required isolation or explicit locking behavior}} |
| Revision/conflict detection | {{Revision column, compare-and-swap, lock, or why none is needed}} |
| Commit point | {{The durable decision after which recovery completes the new state}} |
| Rollback | {{State preserved when failure occurs before commit}} |
| Retry/idempotency | {{Who may retry and how duplicate work is detected}} |
| External effects | {{Ordering or durable-job/compensation rule}} |

## Tests

| Test file | Type | What it proves |
| --- | --- | --- |
| `{{path/to/schema_test.rs}}` | Schema | {{Columns, constraints, relationships, and indexes match the current contract}} |
| `{{path/to/admission_test.rs}}` | Unit | {{Valid rows admit and malformed stored rows fail as storage faults}} |
| `{{path/to/ownership_test.rs}}` | Integration | {{Another project or actor cannot access or mutate the row}} |
| `{{path/to/transaction_test.rs}}` | Integration | {{Participating reads and writes commit or roll back atomically}} |
| `{{path/to/concurrency_test.rs}}` | Concurrency | {{Conflicting writes are detected and resolved by the documented owner}} |
| `{{path/to/recovery_test.rs}}` | Recovery | {{Interruption before and after the commit point follows the durable contract}} |

## Known Limitations

{{List behavior that is intentionally unsupported, invariants not yet enforced,
failure modes not yet tested, and the next proof required. Do not present planned
behavior as implemented.}}
