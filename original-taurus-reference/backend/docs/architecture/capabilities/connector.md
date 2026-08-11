# CONNECTOR — external sources synced into the lattice

CONNECTOR owns **project-scoped bindings to content that lives outside Omega**.
A connector is a resource that names *where* external content is (a folder on the
user's machine, reached through a watcher; later, a cloud drive) and tracks *when
Omega last pulled it in*. Sync feeds that content into the per-project
[knowledge](knowledge/README.md) lattice, so external material becomes citable
retrieval material alongside the project's own documents.

The capability owns only the connector record, its config, and the sync
*algorithm*. It reads no filesystem and speaks no provider protocol itself: the
source sits behind a `Provider` port, the lattice behind a `LatticeWriter` port,
the refresh behind a `Cascader` port. It imports no other capability.

- **Domain** —
  [`core/capability/connector/connector.go`](../../../core/capability/connector/connector.go)
  (record + `Store` + CRUD),
  [`sync.go`](../../../core/capability/connector/sync.go) (the ports and the sync
  algorithm), [`provider.go`](../../../core/capability/connector/provider.go)
  (the source abstraction), with two providers shipped:
  [`localfolder.go`](../../../core/capability/connector/localfolder.go) and
  [`httpprovider.go`](../../../core/capability/connector/httpprovider.go).
  In-memory `Store` in [`memory.go`](../../../core/capability/connector/memory.go).
- **Application handlers** —
  [`core/handlers/connector/connector.go`](../../../core/handlers/connector/connector.go)
  — connector-specific creation and config the generic resource catalog cannot
  express.

## The model

```go
type Connector struct {
	ID, ProjectID, Name string
	SubKind             SubKind    // closed vocabulary; "local-folder" today
	Path                string     // the provider endpoint Omega polls; empty until Configure
	CreatorID           string
	Fingerprint         string     // the content fingerprint last synced
	SyncSeq             int64      // monotonic; 0 before the first sync
	SyncedAt            time.Time
	CreatedAt, UpdatedAt time.Time
}
```

## The provider abstraction

```go
type FileEntry struct{ Path, Content string }        // path is relative to the connector root
type Snapshot  struct{ Files []FileEntry; Fingerprint string }
type Provider  interface{ Snapshot() (Snapshot, error) }
```

A `Snapshot` is the source's whole current content plus **one fingerprint that
changes iff any file's path or content changes**. That single value is the change
detector: `SyncIfChanged` compares it against the stored `Fingerprint` and, if it
matches (and the connector has synced at least once), does nothing at all.

Two providers satisfy the port. `localFolder` walks a directory recursively over
regular files, sorts by path, and hashes `path\0len\0content` per file into a
SHA-256 fingerprint — this is what the out-of-process
[`cmd/connector-watcher`](../../../cmd/connector-watcher/main.go) runs.
`httpProvider` GETs `{endpoint}/snapshot` and decodes `{files:[{path,content}],
fingerprint}`. Wiring's `connectorProviderFactory` always builds the **HTTP**
provider over the connector's `Path`, so even the local-folder subkind is served
by the external watcher — filesystem access and change detection stay outside the
Omega process, and the same shape works for a real cloud provider later.

## Per-file source ids

A connector does not become one lattice source; each of its files does.
`FileSourceID(connectorID, relpath)` joins them with `FileSeparator = "\x1f"` —
a unit-separator control character chosen precisely because it can never occur in
a real path segment. Every source a connector owns is therefore prefixed
`connectorID + "\x1f"`, so
`SourcesUnder(projectID, connectorID+"\x1f")` enumerates exactly the files
currently synced for that connector — which is what makes pruning possible, and
what lets [contexts](contexts.md) expand a connector member to its files.

## Sync — add and prune

`applySync` is the reconciler:

1. For each file in the snapshot, `lattice.AddSource(projectID,
   FileSourceID(rec.ID, f.Path), f.Content, seq)` with `seq = SyncSeq + 1`, and
   accumulate the returned embedding `Usage`.
2. `lattice.SourcesUnder(projectID, rec.ID+FileSeparator)` for what the lattice
   currently holds, and `RemoveSource` every id the snapshot no longer contains.
3. `SetConnectorSyncState(fingerprint, seq, at)`.
4. Report the summed token cost to the `CostRecorder`.
5. Fire the cascade (below).

So the whole-connector fingerprint gates *whether* a sync happens; once it does,
reconciliation runs at file granularity. Three entry points drive it: `Sync`
(always re-syncs — the manual endpoint), `SyncIfChanged` (fingerprint-gated), and
`DetectChanges` (every connector across every project, best-effort — a connector
whose provider cannot be reached is skipped, not fatal). Wiring runs
`runConnectorDetector` as a goroutine ticking every 2s, outside the durable job
queue (tracked as `JOB-1` in [issues-and-gaps](../issues-and-gaps.md)).

## The refresh cascade

`applySync` is reached only on a real (re)sync, so the `Cascader` call at its end
fires **exactly on change, never on a no-op**. Wiring's `refreshCascader`
translates it into work: `docs.DependentPrompts(projectID, ScopeOrigin{Kind:
"connector", ID: connectorID})` finds every prompt block whose scope reaches this
source, and each one is enqueued as a `document.JobTypeResolve` job in `"reload"`
mode. Refresh is best-effort by contract — `RefreshDependents` returns nothing
and must never fail the sync that triggered it; failures are logged. The result
is that editing a file in a connected folder re-resolves the prompt blocks that
depend on it, with no user action.

## Ports and who satisfies them

| Port | Satisfied by (all in `core/wiring`) |
|---|---|
| `Store` | the one `*sqlite.Store`; `MemoryStore` for tests |
| `ProviderFactory` | `connectorProviderFactory` → `NewHTTPProvider(c.Path)` |
| `LatticeWriter` | `connectorLatticeWriter` over `*knowledge.Knowledge` (`SourceTypeConnector`) |
| `CostRecorder` | `connectorCostRecorder` over the telemetry sink, tagged `connector.sync` |
| `Cascader` | `refreshCascader` over `*document.Documents` + the job queue |

Each is injected post-construction (`NewWithSync`, `UseCostRecorder`,
`UseCascader`) and is nil-safe, so a focused test can build a connector service
with no lattice at all.

## HTTP surface

Connectors also appear in the unified [resource](resources/README.md) catalog via
wiring's `connectorResourceFamily` (list/get/create/rename/delete under
`kind=connector`). These four routes carry what the generic catalog cannot:

| Method & path | Handler | Purpose |
|---|---|---|
| `POST /connectors` | `Create` | Create of a given `subkind`, with no path yet. → `201`. |
| `GET /connectors/:connectorID` | `Get` | Metadata + config + `syncSeq`/`syncedAt`. |
| `PUT /connectors/:connectorID/config` | `Configure` | Set the provider endpoint. Non-empty is the only check — format is the provider's concern. |
| `POST /connectors/:connectorID/sync` | `Sync` | Force a re-sync; returns `{seq, changed, usage}`. |

Errors map `ErrNotFound` → `404`; `ErrInvalidName` / `ErrInvalidSubKind` / `ErrInvalidPath` → `400`.

## Persistence

One table in the one SQLite [store](../persistence.md): `connectors`, primary key
`(project_id, id)`, carrying name, subkind, path, creator, and the three sync
state columns. Synced content itself lives in the knowledge lattice, not here.

## Related

- [Knowledge](knowledge/README.md) — where synced content lands and is retrieved from.
- [Contexts](contexts.md) — expands a connector member to its synced files.
- [Documents](documents/README.md) — prompt blocks are what the cascade refreshes.
