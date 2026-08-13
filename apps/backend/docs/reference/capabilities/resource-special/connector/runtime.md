# Connector runtime

## Construction and provider registry

`createConnectorInstance` creates `SQLiteConnectorStore(config.projectId, "./data/connector.db")`, constructs a provider map containing only `filesystemProvider`, and passes store, Knowledge, providers, and Logger to `createConnectorService`. It returns both service and store because the recurring scheduler needs the narrow persistence port.

Startup registers the service with the runtime resource registry and starts `ConnectorSyncScheduler` only after the HTTP listener binds.

## Public service methods

### `register(request)`

- validates provider kind/locator/optional interval;
- resolves provider or throws validation error;
- returns active exact provider+locator as `already_exists` without provider work;
- lists all provider items, derives connector kind and deterministic ID;
- reads and admits each prose item to Knowledge;
- builds complete entry/item results;
- inserts a current deterministic row at the next revision after retained history;
- on failure, returns a concurrently created active entry if present, otherwise best-effort removes every admitted source and rethrows.

The sync config is created only when the provider opts into scheduled sync and the request supplies an interval.

### `sync(connectorId, lockAlreadyAcquired=false)`

1. Load active entry.
2. Acquire the SQLite sync claim, or verify the scheduler already acquired it.
3. List current provider items and load prior snapshot.
4. Compute current prose IDs and persist `pending` with old/current union before Knowledge changes.
5. Process every current item: add new prose; re-add changed prose; force re-add all prose after prior non-active state; queue prose→other removals; preserve unchanged metadata/timestamps.
6. Queue removed prior items and tracked orphans for removal.
7. Await every removal.
8. Recompute complete kind/source list, increment revision, set state active and timestamp, then transactionally replace entry/items while claim is held.
9. On failure, try to persist `failed` with tracked union, log, rethrow.
10. Always clear the sync claim.

`lockAlreadyAcquired=true` is used only by the scheduled job. A successful sync increments revision even if no item metadata changed.

### Reads

- `get(id)`: active row, public-state filtering, debug log.
- `list()`: all live rows, public-state filtering, debug log.
- `getReader(id)`: only file-kind connectors; uses first persisted item and provider reader.
- `getDirectoryReader(id)`: captures current persisted items, lists them synchronously, and delegates any requested item key to provider `getReader`.

The current directory reader does not itself verify that a supplied `itemKey` appears in its captured item list before delegating. Resource-registry reads use stored keys, but the development HTTP item-read paths accept caller-supplied keys.

### `delete(id)`

Delete loads the current entry and items, acquires the same persisted claim as sync, builds a source union, persists `pending`, and removes all sources. It then archives the aggregate snapshot, appends the terminal deletion revision, and removes the current entry in one transaction. Failure leaves pending/failed reconciliation metadata when possible; `finally` clears the claim after the attempt.

### `purge(id)` and retention

Purge refuses a current Connector, requires retained deletion history, and then physically removes that history. `pruneHistory(cutoff)` removes old superseded history for current Connectors; `purgeExpired(cutoff)` purges Connectors whose terminal deletion predates the cutoff. Composition invokes these through the shared retention scheduler.

## Service helpers

| Helper | Responsibility |
|---|---|
| `connectorId` | SHA-256 exact provider kind + `::` + locator |
| `connectorKnowledgeSourceId` | Hash item key and namespace under connector ID |
| `determineKind` | File/directory × contains prose classification |
| `getProvider` | Map lookup or typed unknown-provider error |
| `publicEntry` | Withhold source-ID union when pending/failed |
| `now` | ISO timestamps |

## Store methods and transaction boundaries

- `insert`: entry plus all items in one SQLite transaction.
- `nextRevision`: returns 1 without history or one after the maximum retained revision.
- `update`: expected-revision/claimed entry update, previous aggregate history snapshot, and complete item replacement in one transaction.
- `markIngestionState`: one guarded update requiring live claimed row.
- `delete`: final aggregate snapshot, terminal revision, and current-row removal in one transaction.
- `purge`/`pruneHistory`/`purgeExpired`: irreversible history maintenance.
- `setSyncing`: atomic compare-and-set `0→1` on a live row.
- `clearSyncing`: set zero by ID, including after deletion.
- `resetSyncing`: clear crash-left claims on live rows at scheduler start.
- `listSyncableEntries`: live, unclaimed rows with non-null sync config.

Provider and Knowledge operations remain outside these transactions.

## Filesystem provider and reader

`filesystemProvider` resolves the locator, stats it, returns one item for a file or direct regular-file children for a directory, and rejects other filesystem object types. Filenames determine lowercased extension/classification. Paths are not constrained to a workspace root.

`FileConnectorReader` opens/closes a handle per method:

| Method | Behavior |
|---|---|
| `read({start,end})` | Validate safe byte offsets and max range; pread exact range; decode actual bytes read as UTF-8 |
| `readAll()` | Re-stat open handle, enforce full-read maximum, loop reads, concatenate/decode |
| `readStream(chunkSize=65536)` | Validate chunk, stream with `StringDecoder` to preserve UTF-8 sequences |
| `readLines(start,end)` | Validate one-based inclusive range/count; call `readAll`, split LF, slice |

MIME type is always null in this provider.

## Recurring scheduler

`ConnectorSyncScheduler.start` is idempotent while timers exist. It clears stale sync flags, discovers persisted scheduled entries, and starts one timer for each allowed interval. Every tick refreshes entries from SQLite and tries each matching connector:

1. recheck active/configured/unclaimed state;
2. atomically set the claim at enqueue time;
3. enqueue generic job `connector.sync.scheduled` on concurrent queue;
4. job calls `service.sync(id, true)`;
5. service clears the claim in its own `finally`;
6. enqueue rejection also clears the claim and logs.

`register`/`unregister` mutate the scheduler's in-memory map and log, but current composition relies on database rediscovery rather than calling them after service registration/deletion.

## Logging

Service logs registration/sync/delete/reader outcomes and structured reconciliation failures. Endpoint reads log requested ranges/counts and returned sizes. Scheduler logs recovery, discovery, timer lifecycle, and failures. Logs include locator-derived labels only in persisted/public entry data; normal operation logs avoid file content.
