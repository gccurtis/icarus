# Analytic Output — store

Project-scoped SQLite, one database file owned by this capability. House
pattern: `CREATE TABLE IF NOT EXISTS`, table prefix
`SHA-256(projectId).slice(0, 16)`, no `STRICT`, partial indexes for liveness,
hand-written SQL through `better-sqlite3`.

The store is synchronous, matching `DataStore` and `ContextStore`. The service
above it is `Promise`-returning, matching `StructuredData`.

Two tables. The earlier draft had five — base snapshots, changesets, attempts,
stage receipts, materializations — because it modelled the definition as
versioned authored content. Here the definition is a row.

## Definitions

```sql
CREATE TABLE IF NOT EXISTS ano_${prefix}_outputs (
  id                        TEXT PRIMARY KEY,
  title                     TEXT NOT NULL,
  description               TEXT,
  binding_id                TEXT NOT NULL,
  display_name_at_authoring TEXT NOT NULL,
  definition_json           TEXT NOT NULL,   -- shelves, encodings, filters, sorts, limit, view
  definition_digest         TEXT NOT NULL,
  view_kind                 TEXT NOT NULL,   -- denormalised for filtering
  latest_materialization_id TEXT,
  revision                  INTEGER NOT NULL DEFAULT 1,
  created_by                TEXT NOT NULL,
  updated_by                TEXT NOT NULL,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  deleted_at                TEXT
);

CREATE INDEX IF NOT EXISTS ano_${prefix}_outputs_recent
  ON ano_${prefix}_outputs(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ano_${prefix}_outputs_binding
  ON ano_${prefix}_outputs(binding_id)
  WHERE deleted_at IS NULL;
```

`definition_json` is one blob rather than columns per shelf. Unlike Persona's
five fixed sections, the definition's parts are variable-length lists of
structured values with no useful query over their interiors — "which outputs
filter on revenue" is not a query anyone runs, and if it becomes one, it wants
a proper index, not a JSON walk.

`binding_id` and `view_kind` are lifted out because both have real queries:
*which charts break if this declaration changes* and *list the tables*.

`ano_${prefix}_outputs_binding` is the index that answers the first one. It is
the capability's contribution to impact analysis when a Structured Data
declaration is renamed or deleted.

## Materializations

```sql
CREATE TABLE IF NOT EXISTS ano_${prefix}_materializations (
  id                    TEXT PRIMARY KEY,
  output_id             TEXT NOT NULL,
  definition_revision   INTEGER NOT NULL,
  definition_digest     TEXT NOT NULL,

  binding_id            TEXT NOT NULL,
  owner_revision        TEXT NOT NULL,
  value_digest          TEXT NOT NULL,
  snapshot_digest       TEXT NOT NULL,
  frozen_value_json     TEXT NOT NULL,   -- the exact FormulaWireValue
  frozen_at             TEXT NOT NULL,

  executor_version      INTEGER NOT NULL,
  result_schema_json    TEXT NOT NULL,
  result_rows_json      TEXT NOT NULL,
  resolved_view_json    TEXT NOT NULL,
  result_digest         TEXT NOT NULL,
  result_row_count      INTEGER NOT NULL DEFAULT 0,
  result_cell_count     INTEGER NOT NULL DEFAULT 0,

  status                TEXT NOT NULL,   -- complete | diagnostic
  diagnostics_json      TEXT NOT NULL DEFAULT '[]',
  published             INTEGER NOT NULL DEFAULT 0,
  idempotency_key       TEXT,
  created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ano_${prefix}_mat_by_output
  ON ano_${prefix}_materializations(output_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ano_${prefix}_mat_idempotency
  ON ano_${prefix}_materializations(output_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

`owner_revision` is `TEXT` because `ResolvedFormulaBinding.ownerRevision` is
`number | string` in the Formula resolver. Storing it as `INTEGER` would work
until the first string-revisioned owner and then fail in a way that is hard to
read.

There is no separate attempt table. A materialization row **is** the attempt: it
is inserted at freeze with its input manifest, and updated once with its result
and `published` flag. A row that exists with no result is a materialization that
was interrupted, and that is exactly what recovery needs to see.

`published` records whether this materialization won its publish race, which
`latest_materialization_id` alone cannot tell you — the pointer holds one
winner, while the flag distinguishes "was superseded" from "never finished".

## Transactions

Two per materialization, and the compute happens between them holding no lock.

**Freeze.**

```sql
BEGIN;
  SELECT revision, definition_digest, definition_json
    FROM ano_${prefix}_outputs WHERE id = ? AND deleted_at IS NULL;
  -- (input read happens through AnalyticInputReader, outside SQL)
  INSERT INTO ano_${prefix}_materializations
    (id, output_id, definition_revision, definition_digest,
     binding_id, owner_revision, value_digest, snapshot_digest,
     frozen_value_json, frozen_at, executor_version, …)
  VALUES (…);
COMMIT;
```

**Publish.**

```sql
BEGIN;
  UPDATE ano_${prefix}_materializations
     SET result_schema_json = ?, result_rows_json = ?, resolved_view_json = ?,
         result_digest = ?, result_row_count = ?, result_cell_count = ?,
         status = ?, diagnostics_json = ?, published = ?
   WHERE id = ?;

  -- advances only if the definition has not moved since freeze
  UPDATE ano_${prefix}_outputs
     SET latest_materialization_id = ?, updated_at = ?
   WHERE id = ? AND revision = ?;
COMMIT;
```

The second statement updating zero rows is the whole race guard. The service
reads `changes()`, sets `published = 0`, and returns `{ published: false }`.
A superseded materialization is still stored, still immutable, still readable by
id — it simply is not current.

**Update** is one compare-and-swap:

```sql
UPDATE ano_${prefix}_outputs
   SET title = ?, description = ?, definition_json = ?, definition_digest = ?,
       view_kind = ?, binding_id = ?, revision = revision + 1,
       updated_by = ?, updated_at = ?
 WHERE id = ? AND revision = ? AND deleted_at IS NULL;
```

Zero rows changed means either a stale revision or a deleted output; the service
distinguishes them with one follow-up read and throws
`StaleAnalyticOutputError` or `AnalyticOutputNotFoundError`. This is why the
endpoint can be concurrent.

Changing the definition does **not** clear `latest_materialization_id`. The
previous result stays visible and readable while the new one computes, which is
what stops a chart blinking to empty the moment someone adjusts a filter. The
frontend can tell it is stale by comparing `definition_revision` against the
output's `revision`.

## Retention

- **Definitions: kept until deleted.** Soft delete only.
- **Materializations: bounded per output**, oldest unpublished pruned first,
  then oldest published beyond a retained count.
- **Never pruned: any materialization referenced by another capability.** A
  Document or Slide embedding an analytic output pins a materialization id.
  Pruning it would break the embed.

That last rule means retention cannot be purely age-based, and this capability
cannot answer the question alone — it does not know who references it. The
first implementation retains a generous fixed count per output and defers
reference-aware pruning, with the constraint written down here so it is not
discovered later by a broken slide.

`frozen_value_json` dominates the storage cost. A pruning pass that wanted to
be cleverer could null out `frozen_value_json` on old published rows while
keeping the result — losing reproducibility but keeping the numbers. That is a
real option and deliberately not taken yet, because a materialization that
cannot be reproduced is a weaker thing than the design claims it is.
