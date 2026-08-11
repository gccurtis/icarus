# sqlite_connector.go

Persistence for connectors — the records that bind a project to an external
source (a local folder, an HTTP endpoint) so its contents can be pulled into the
knowledge lattice. One table, `connectors`, keyed on `(project_id, id)`.

A connector row is definition plus sync bookkeeping. The definition (name,
subkind, path, creator) is set at creation and edited by hand. The sync state is
written only by the sync path and comes in two halves: `fingerprint`, `sync_seq`
and `synced_at` describe the last **success** — what lets the capability decide an
external source has not changed and skip the work — while `failed_attempts`,
`last_error` and `retry_after` describe a sync that is **failing**, and are what
stop a broken connector from being re-read and re-embedded on every detector tick.
The actual snapshotting, provider dispatch, and change detection all live in the
`connector` capability — this file only stores the outcome.

## Code breakdown

### File header: one Store, one connection, split by capability

The package clause repeats the note carried by every file in this split: all of
these methods hang off the same `*Store` over a single connection, so the file
boundary is organizational and mirrors `core/capability`. Note this file formats
and parses timestamps with `time.RFC3339Nano` written out literally rather than
the package's `timeLayout` alias; the two are the same layout, so stored values
are interchangeable with the rest of the store.

### `InsertConnector` — the definition only

Inserts project, id, name, subkind, path, creator, and the two timestamps — and
deliberately omits every sync column, letting them take their schema defaults
(empty fingerprint, `sync_seq` 0, empty `synced_at`, zero attempts, no error, no
retry time). A `sync_seq` of zero is therefore the durable marker for "never
synced", which the capability's `SyncIfChanged` reads as a reason to sync even when
the fingerprint happens to match; a fresh connector likewise starts with a clean
retry budget without this statement having to say so.

### `ConnectorByID` — one connector within a project

A single-row read always scoped by `project_id` as well as `id`, delegating the
decode (and the not-found mapping) to `scanConnector`.

### `ConnectorSummaries` — a project's connectors

Despite the name this selects the same full column set as `ConnectorByID`; the
"summary" is about how the result is used above, not about a narrower row. No
`ORDER BY`, so ordering is left to the caller.

### `AllConnectors` — the one deliberately unscoped read

The same query with no project predicate at all, returning every connector in
the database. This exists for the background change detector:
`Connectors.DetectChanges` calls it, then re-syncs each connector whose
fingerprint moved, so external changes propagate without anyone asking. It is
the one read here that intentionally crosses project boundaries, and it belongs
to a background worker rather than to any request path.

### `UpdateConnector` — rename and repoint

Writes only `name`, `path`, and `updated_at`. The subkind and creator are fixed
at creation, and the sync columns are untouched — editing a connector's path
leaves the old fingerprint in place, so the next detection run sees the source
as changed and re-syncs. A zero `RowsAffected` becomes `connector.ErrNotFound`.

### `DeleteConnector` — scoped delete that reports a miss

Deletes the `(project_id, id)` row and, unlike the more forgiving deletes
elsewhere in this package, returns `ErrNotFound` when nothing matched.

### `SetConnectorSyncState` — success, and the end of a failure

Records the outcome of a sync: fingerprint, sequence, and timestamp. The same
formatted instant is written to both `synced_at` and `updated_at`, so a sync counts
as touching the connector and the two never drift.

It also clears the three failure columns in the **same statement**:

```go
`UPDATE connectors
 SET fingerprint=?,sync_seq=?,synced_at=?,updated_at=?,
     failed_attempts=0,last_error='',retry_after=''
 WHERE project_id=? AND id=?`
```

Success is what ends a failure, so it is one fact and gets one write. Splitting it
into "record the success" and "clear the failure" would introduce a window in which
a connector had both a fresh sync and an armed retry counter — and the counter is
what suppresses future syncs, so the disagreement would be silent and would end in
the connector stopping itself for a failure that is over.

A missing row is `ErrNotFound` — a sync completing against a connector deleted
underneath it should not silently succeed.

### `SetConnectorSyncFailure` — the memory a reconciliation loop lacks

Writes the consecutive-failure count, the cause, and the earliest the automatic
path may try again (empty when there is none, which is how the capability records
"stopped retrying" without inventing a distant timestamp). Passing zeroes clears
the failure, so one method serves both directions.

It deliberately leaves `updated_at` alone. A failed attempt did not change the
connector a person configured, and stamping it would make every backoff tick look
like an edit in any listing ordered by that column.

### `scanConnector` — the shared row decoder

Takes the package's `rowScanner` interface (declared in `sqlite.go`, satisfied by
both `*sql.Row` and `*sql.Rows`) so the single-row and listing paths decode
identically, and maps `sql.ErrNoRows` to `connector.ErrNotFound`. It converts the
stored subkind text to `connector.SubKind` and parses the timestamps, guarding
`synced_at` and `retry_after` with an emptiness check first — a never-synced
connector stores `""` in the first and a healthy one stores `""` in the second, and
parsing either would only produce the zero time the guard already leaves in place.
