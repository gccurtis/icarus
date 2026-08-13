# Structured Analytic — store

## Two tables

Structured Analytic owns one project-scoped current-state table and the shared
resource-history table every revisioned capability now carries. Pull results are
never stored.

```ts
export interface StructuredAnalyticTableNames {
  analytics: string;
  history: string;
}

export const createStructuredAnalyticTableNames = (
  projectId: string
): StructuredAnalyticTableNames => ({
  analytics: `sta_${projectPrefix(projectId)}_analytics`,
  history: `sta_${projectPrefix(projectId)}_history`
});
```

`projectPrefix` is `SHA-256(projectId).slice(0, 16)`, matching every other
project-scoped store. The connection opens with the standard four pragmas
(`journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`,
`synchronous = NORMAL`).

```sql
CREATE TABLE IF NOT EXISTS sta_${prefix}_analytics (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  definition_json TEXT NOT NULL,
  revision        INTEGER NOT NULL CHECK (revision >= 1),
  created_by      TEXT NOT NULL,
  updated_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sta_${prefix}_analytics_recent
  ON sta_${prefix}_analytics(updated_at DESC, id);
```

There is no `deleted_at` column. Under the current model a deleted resource
leaves the current-state table entirely; its final snapshot and a tombstone live
in history.

The history table is created by the shared helper:

```ts
initializeResourceHistorySchema(db, tables.history);
```

The whole definition is one JSON column. Its inputs, joins, shelves, filters,
and sorts are always read and replaced together, and nothing queries into them;
separate tables would add write machinery that supports no current read.

## Store port

```ts
interface StructuredAnalyticStore {
  get(id: string): StructuredAnalytic | undefined;
  /** Ordered by (updated_at DESC, id ASC). */
  list(): StructuredAnalytic[];
  countLive(): number;

  insert(analytic: StructuredAnalytic): void;
  /** Archives the prior revision, then CAS-updates. False means stale. */
  update(analytic: StructuredAnalytic, expectedRevision: number): boolean;
  /** Archives the final snapshot and a tombstone, then removes current state. */
  delete(id: string, expectedRevision: number, deletedAt: string): boolean;

  latestSnapshot(id: string): StructuredAnalytic | undefined;
  purge(id: string): void;
  pruneHistory(cutoff: string): number;
  expiredDeleted(cutoff: string): string[];
}
```

Synchronous, because `better-sqlite3` is synchronous and this capability has no
non-SQLite future to keep open — matching the Templates and Structured Data
stores. The runtime methods stay `Promise`-returning so the transport surface
does not change if that ever needs revisiting.

The boolean CAS results follow Persona and Templates: the store reports success
or staleness, and the service turns a `false` into the typed error after
re-reading to distinguish "gone" from "stale".

## Create, update, delete, purge

**Create** inserts revision 1. No history row is written — the current row *is*
revision 1.

**Update** is one transaction:

```text
SELECT the row WHERE id = ? AND revision = ?     -- the CAS guard
  → miss: return false
insertHistorySnapshot(history, revision = previous.revision, snapshot = previous)
UPDATE … SET title, description, definition_json,
             revision = revision + 1, updated_by, updated_at
       WHERE id = ? AND revision = ?
```

So history accumulates every superseded revision, and the current table always
holds exactly the newest one.

**Delete** is one transaction:

```text
SELECT the row WHERE id = ? AND revision = ?
  → miss: return false
insertHistorySnapshot(history, revision = current.revision, snapshot = current)
insertHistoryDeletion(history, revision = current.revision + 1)
DELETE FROM analytics WHERE id = ? AND revision = ?
```

After this the analytic is absent from `get` and `list`, and its full authored
history — including the final state — remains recoverable until purge or
retention expiry.

**Purge** permanently drops the history for one analytic. It is legal only after
deletion: `purgeResourceHistory` refuses when the latest history record is not a
tombstone, which surfaces as `ResourceNotDeletedError`.

## Retention

Two methods put the capability into the process-wide sweep:

- `pruneHistory(cutoff)` drops superseded snapshots older than the cutoff, while
  keeping history for resources that still exist currently.
- `expiredDeleted(cutoff)` lists deleted resources whose tombstone predates the
  cutoff, which the runtime then purges.

Composition binds them like every other capability:

```ts
bindResourceRetentionPort("structured-analytic", structuredAnalytic)
```

`config.retention` supplies `revisionRetentionDays` and `sweepIntervalHours`.
There is no capability-specific retention setting.

## Reads

- `get` and `list` return current-state rows only.
- `list` orders by `updated_at DESC, id ASC`.
- Deleted analytics are absent from ordinary reads; `latestSnapshot` reaches them
  and exists for purge bookkeeping, not as a public read surface.
- There is no history query endpoint in this version. Nothing in the product
  needs to browse prior analytic revisions yet, and adding one later is a query
  variant over data that is already being kept.

## What the store deliberately does not have

Because a pull never writes back, there is no result table, definition digest,
idempotency claim, transaction spanning computation, or concurrency rule beyond
the ordinary authored revision CAS.

The pull receipt is not persisted either. It is assembled from the resolver
snapshot at read time and returned to the caller; if something later needs to
retain a pull, it retains it in its own store, which is exactly how Research
will hold an analysis result.
