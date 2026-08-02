# Analytic Output — store

## One table

Analytic Output owns one project-scoped SQLite table for saved definitions.
Computed data is never stored.

```sql
CREATE TABLE IF NOT EXISTS ano_${projectPrefix}_outputs (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  definition_json TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_by      TEXT NOT NULL,
  updated_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS ano_${projectPrefix}_outputs_recent
  ON ano_${projectPrefix}_outputs(updated_at DESC, id)
  WHERE deleted_at IS NULL;
```

`projectPrefix` is `SHA-256(projectId).slice(0, 16)`, matching the existing
project-scoped stores. The connection uses the repository's normal WAL,
`busy_timeout`, and synchronous settings.

The entire definition is one JSON column. Its inputs, joins, shelves, filters,
and sorts are always read and replaced together; separate tables would create
more write machinery without supporting a current query.

## Store port

```ts
interface AnalyticOutputStore {
  insert(output: AnalyticOutput): void;
  get(id: string): AnalyticOutput | null;
  list(): readonly AnalyticOutput[];
  update(
    id: string,
    expectedRevision: number,
    replacement: AnalyticOutputReplacement
  ): AnalyticStoreUpdateResult;
  softDelete(
    id: string,
    expectedRevision: number,
    actorId: string,
    deletedAt: string
  ): AnalyticStoreDeleteResult;
}

type AnalyticStoreUpdateResult =
  | { readonly kind: "updated"; readonly output: AnalyticOutput }
  | { readonly kind: "not_found" }
  | { readonly kind: "stale"; readonly actualRevision: number };

type AnalyticStoreDeleteResult =
  | { readonly kind: "deleted" }
  | { readonly kind: "not_found" }
  | { readonly kind: "stale"; readonly actualRevision: number };
```

`AnalyticOutputReplacement` contains the validated title, optional description,
complete definition, actor, and update timestamp. It does not let the caller
select persisted revision values.

The concrete SQLite store also exposes `close()` for tests and shutdown. That
method is not needed by the application runtime contract.

## Create, update, and delete

Create inserts revision 1.

Update is one revision compare-and-swap:

```sql
UPDATE ano_${projectPrefix}_outputs
SET title = ?,
    description = ?,
    definition_json = ?,
    revision = revision + 1,
    updated_by = ?,
    updated_at = ?
WHERE id = ? AND revision = ? AND deleted_at IS NULL;
```

Delete uses the same predicate, sets `deleted_at`, advances `revision`, and
updates attribution. A zero-row update is followed by one read so the store can
distinguish a missing/deleted output from a stale expected revision.

There is no result write after `data()` runs. Consequently the store needs no
definition digest, result table, transaction spanning computation, retry key,
or concurrency rule beyond the ordinary authored revision CAS.

## Reads

- `get` and `list` return live outputs only.
- `list` orders by `updated_at DESC, id ASC`.
- Deleted rows are absent from ordinary use.
- No history or retention operation exists.
