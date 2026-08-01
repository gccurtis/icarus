# Structured Data invariants, guarantees, and limits

## Preconditions → guaranteed outcomes

| Preconditions | Current guaranteed outcome | Enforcement |
|---|---|---|
| Valid Formula-compatible, non-reserved display name within byte limit | Stored trimmed; lookup/collision key is case-insensitive | Validator plus SQLite `NOCASE` live index |
| Valid formula/function declaration | UUID entry at revision 1 with source body and empty context entries | Service/insert |
| Valid collection declaration | Schema/rows are admitted, `rowCount === rows.length`, revision 1 | Validators/service |
| Revisioned update wins SQL CAS | Exactly one live row changes and returned revision is previous +1 | SQLite `id + revision + live` predicate |
| Revisioned update loses SQL CAS | Service returns typed current stale revision or not-found | `persistUpdate` reload |
| Delete wins CAS | Tombstone is written and entry disappears from get/name/list/binding views | SQLite live predicates |
| Append succeeds | Only submitted rows were newly validated; prior rows are retained without routine rescan | `validateAppendRows` |
| Schema replacement succeeds | Every retained row validates against the new complete schema | replacement validator |
| Resolver cannot parse/evaluate a declaration | No binding is published for it; a typed issue is available | Formula resolver |
| Authored value is null | It remains a real Formula null and is not confused with failure | value conversion/resolver |
| Formula binding exists | It records stable entry ID, owner revision, and value digest | resolver snapshot |

## Admitted name and cell rules

- Display/field names use ASCII Formula identifier syntax and trim outer whitespace.
- Project declaration names are unique under lowercase lookup; casing alone cannot create another owner.
- Formula reserved names, including built-ins, are rejected case-insensitively.
- Row keys must exactly equal schema field spelling; missing keys are allowed and later become null.
- Primitive literals must match `text`, `number`, or `logic` unless field kind is `unknown`; null is accepted for every kind.
- Numbers must be finite; integer values must be JavaScript safe integers.
- Object cells must contain exactly one string `formula` property.
- Formula cells are type-checked after evaluation during snapshot construction.
- Table/record/list field kinds currently require formula-produced structured values because nested literal object cells are not admitted.

## Collection cardinality

- A list schema has exactly one field.
- A record has exactly one row at declare, replacement, append, and delete validation boundaries.
- A table may have zero fields and zero rows within configured maxima.
- Append computes final count before admission and validates only new rows.
- Delete indices are zero-based, unique, integer, and in range.
- Empty append/delete-index arrays are accepted and still produce a new revision.

## Limits

| Config | Default | Application |
|---|---:|---|
| `maxDisplayNameBytes` | 256 | Declaration/rename names |
| `maxEntries` | 10,000 | Pre-insert live count check |
| `maxFieldsPerCollection` | 256 | Schema length |
| `maxRowsPerCollection` | 100,000 | Declare/replacement rows and append final count |
| `maxBodyBytes` | 65,536 | Entry bodies and formula-cell source |

Schema field names use a separate hard-coded 256-byte call to the display-name validator. Description and `contextEntries` have no capability-specific size/count limit in the current service.

## Identity, revision, and deletion

- IDs are random UUIDs and survive rename/content/schema/row mutations.
- Every live update increments the entry revision once.
- Delete requires the current expected revision but does not increment the stored revision.
- Tombstones are retained but hidden by every current DataStore read.
- A newly declared entry can reuse a deleted display name but receives a new UUID.
- `DataBindingView.viewRevision` is a maximum, not a global mutation sequence or complete snapshot digest.

## Concurrency and atomicity

SQLite update/delete CAS is atomic across concurrent queue jobs, direct callers, store instances, and processes sharing the database. Name uniqueness is also enforced in SQLite.

Two boundaries are weaker:

- `maxEntries` is checked by a read followed by insert, so competing declarations may exceed the configured quota.
- The service's conflict precheck can race; SQLite still rejects duplicate live names, but the resulting exception may be generic rather than `DataEntryConflictError`.

There are no cross-store mutations or compensation steps in the core capability. Formula snapshot construction is read/evaluate work and does not mutate Structured Data.

## Formula binding and staleness

- Formula built-ins and lambda locals are language-owned and take precedence over external bindings.
- External display lookup is case-insensitive, but a validated/bound expression records the stable `DataEntry.id`.
- Renaming/removing that owner makes an old bound reference stale; declaring a new entry under the old name does not retarget it.
- Snapshot digest includes normalized name, stable binding ID, owner revision, and recursive value identity.
- Resolver passes are bounded by entry count rather than an arbitrary 32-pass ceiling.
- Failures remain issues; only successfully resolved entries appear in `bindings`.

## Scope and security

- The store is project-bound at startup using a hashed table prefix.
- Endpoints cannot select another project/database/table.
- `contextEntries` are relevance metadata, not authorization. Query overlap does not grant or deny content access.
- Formula source and values may contain sensitive data. Current operation logs avoid source bodies, but HTTP get/list/value responses intentionally return caller-visible data.

## Failure behavior

- Ingress validation throws before mutation.
- Wrong-kind operations throw ordinary errors and map to 400.
- Malformed persisted JSON throws during row mapping; no repair path exists here.
- Formula issues produce 409/422 value responses or 400 ad-hoc diagnostics, not null substitution.
- The endpoint adapter coerces several values with `String`/`Number` before service validation; direct service calls receive stricter TypeScript/runtime checks than those coerced fields.
- Unsupported `kind` on list/query is cast through today rather than centrally rejected; list commonly returns empty. This is a current limitation.

## Regression coverage

[`structured-data-formula.test.ts`](../../../../test/capabilities/structured-data-formula.test.ts) covers sole-source Formula resolution, case collisions, tombstone visibility/repeated delete, delete endpoint revision forwarding, cross-store update/delete CAS, collection-cell dependencies, built-ins/lambda locals, function identity/wire rejection, lexical captures, reserved names, long dependency chains, Formula output limits, stable-binding non-retargeting, snapshot owner identity, typed resolution issues, ingress collection validation, and incompatible schema replacement.

## Non-goals

Current non-goals include a second Name Manager, migration compatibility, user-scoped Structured Data in startup, global mutation sequence, change history/undo, typed dates, nested literal collection cells, schema conversions, row IDs, partial row updates, SQL-level JSON/schema constraints, automatic Context metadata inference, Knowledge ingestion, and direct Intelligence generation.
