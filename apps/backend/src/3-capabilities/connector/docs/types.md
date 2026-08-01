# Connector types and persistence

## Connector model

[`domain/model.ts`](../domain/model.ts) defines four `ConnectorKind` strings and these key types.

### Sync types

```ts
const SYNC_INTERVALS = {
  "5min": 300_000,
  "30min": 1_800_000,
  "2hr": 7_200_000,
  "12hr": 43_200_000
} as const;

type SyncInterval = keyof typeof SYNC_INTERVALS;
interface ConnectorSyncConfig {
  syncType: "scheduled";
  interval: SyncInterval;
  lastSyncedAt?: string;
}
type ConnectorIngestionState = "active" | "pending" | "failed";
```

### `ConnectorEntry`

```ts
interface ConnectorEntry {
  id: string;
  kind: ConnectorKind;
  providerKind: string;
  locator: string;
  label: string;
  revision: number;
  syncConfig: ConnectorSyncConfig | null;
  syncing: boolean;
  ingestionState?: ConnectorIngestionState;
  knowledgeSourceIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
```

`ingestionState` is optional in the TypeScript interface for legacy callers; persisted rows map it to an explicit state. The service returns an entry copy with empty source IDs whenever state is not active.

### `ConnectorItemEntry`

This is the persisted item snapshot: `itemKey`, display name, normalized-or-empty extension, byte size, provider revision token, capability timestamp, prose/other status, and nullable Knowledge source ID.

The prose source ID is `connector:${connectorId}:${sha256(itemKey)}`. Arbitrary external keys never appear raw in source IDs.

### Request/result types

| Type | Shape / behavior |
|---|---|
| `RegisterConnectorRequest` | Provider kind statically `filesystem`, locator, optional allowed interval |
| `RegisterConnectorResult` | `registered` or `already_exists`, public entry, per-item results |
| `ItemIndexResult` | Item key/name, `indexed` or `stored`, optional Knowledge result |
| `SyncConnectorJobDefinition` | Descriptive `{jobType, connectorId, source}` type; current scheduler builds generic job definitions directly |

## Provider and reader ports

[`ConnectorProvider`](../domain/provider.ts) has `kind`, `label`, optional scheduled-sync opt-in, `listItems(locator)`, and `getReader(locator,itemKey)`. Providers are expected to be stateless.

`ConnectorItem` is a provider snapshot item. Its extension may be null and byte size may be `-1` by port comment, although current SQLite item constraints require persisted byte size ≥0; the filesystem provider always supplies a non-negative size.

[`ConnectorReader`](../domain/reader.ts) exposes byte size, nullable MIME type, byte-range `read`, `readAll`, async text `readStream`, and inclusive one-based `readLines`. `DirectoryReader` lists persisted items and opens an item reader.

## Errors

| Error | Code | Meaning | HTTP |
|---|---|---|---:|
| `ConnectorNotFoundError` | `not_found` | Missing/deleted connector or missing single item | 404 |
| `ConnectorAlreadyExistsError` | `already_exists` | Exported conflict type; current register returns an `already_exists` result instead of throwing | 409 if thrown |
| `UnsupportedLocatorError` | `unsupported_locator` | Provider cannot use locator | 400 |
| `SyncInProgressError` | `sync_in_progress` | Persisted sync/delete claim unavailable | 409 |
| `ConnectorValidationError` | `bad_request` | Unknown provider, invalid register input/interval | 400 |
| `RangeError` | standard | Reader bound violation | 400 |
| other | none | Provider/fs/Knowledge/SQLite/unexpected failure | 500 |

## Store contract

[`ConnectorStore`](../ports/repository.ts) groups:

- reads: `getById`, live provider+locator lookup, live list, item list;
- snapshot writes: transactional `insert`, `restore`, `update`;
- reconciliation: guarded `markIngestionState`, guarded `softDelete`;
- claim lifecycle: atomic `setSyncing`, `clearSyncing`, startup `resetSyncing`;
- scheduling: `listSyncableEntries`, `updateSyncTimestamp`.

`updateSyncTimestamp` exists on the current port/adapter but service sync writes `lastSyncedAt` through full `update`; it is not used by current runtime wiring.

## SQLite representation

[`SQLiteConnectorStore`](../persistence/sqliteConnectorRepository.ts) opens `./data/connector.db` in WAL mode, `synchronous=NORMAL`, with foreign keys enabled. Tables use `conn_${sha256(projectId).slice(0,16)}`.

### Entry table

Stores kind/provider/locator/label/revision, optional JSON sync config, boolean sync claim, ingestion state, JSON source-ID array, timestamps, and tombstone. A partial unique index enforces one active exact provider+locator pair.

### Item table

Composite primary key `(entry_id,item_key)`, metadata/status/source ID, and `ON DELETE CASCADE` foreign key. Extensions may be empty. Full snapshot replacement deletes then reinserts item rows inside the entry transaction.

The constructor migrates an early required-extension check by rebuilding the item table and adds `ingestion_state` to older entry tables with default `active`.

## Wire/resource representations

HTTP endpoints return `ConnectorEntry`, item arrays, or `{text}`/`{lines}` directly. There is no separate runtime wire validator. Resource descriptors used by Derived Outputs contain the Knowledge source ID, public resource identity/kind, and connector revision; they never include locator or item key.
