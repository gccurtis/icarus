# memory.go

An in-memory `Store` for tests and non-persistent runs. Connector records are held
in a mutex-guarded map keyed by `projectID + "\x00" + id`, so lookups, listing,
updates and deletes are all project-scoped. Missing records surface `ErrNotFound`.
See repo conventions (AGENTS.md).

## Code breakdown

### The map and its key

`byKey` is keyed by `projectID + "\x00" + id`. The NUL separator cannot appear in
either half, so the composite key can never be ambiguous between two projects. A
mutex guards every method because the change detector sweeps connectors from a
background goroutine while requests read and write the same records.

`now` is carried for parity with the persisted store, which stamps times, and is
unused here.

### CRUD

`InsertConnector` writes unconditionally; `ConnectorByID`, `UpdateConnector` and
`DeleteConnector` return `ErrNotFound` for a key that is absent.
`ConnectorSummaries` filters by project; `AllConnectors` returns every record
across all projects, which is what the change detector sweeps.

Both listings return records in map order — unspecified, deliberately. The
resource catalog sorts what it shows, and a store that happened to return
insertion order would let a caller depend on an order the persisted store does
not promise either.

### `SetConnectorSyncState` clears the failure fields

It records the fingerprint, sequence and timestamps of a successful sync, and
resets `FailedAttempts`, `LastError` and `RetryAfter` in the same call. This
mirrors the SQLite store, which does it in one statement: a connector that has
just synced is not also mid-retry, and the two facts must not be able to
disagree.

### `SetConnectorSyncFailure` records one, or forgets it

It writes the consecutive-failure count, the cause and the retry time. Passing
`0`, `""` and a zero time clears the failure — the same call serves both
directions, so there is one place where this state changes rather than two that
could drift.
