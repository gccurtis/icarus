# Connector

*Verified against source at commit ef6d462, 2026-08-09.*

Connector registers an **external** data source as a project resource, admits its prose items to
the Knowledge lattice, keeps that index reconciled as the source changes, and hands out bounded
readers so a tool can quote from the source without the backend holding a copy. One provider is
implemented — the local filesystem — and it says of itself, in its first line, that it is
development-only and not an authorization boundary. Identity is deterministic:
`sha256("<providerKind>::<locator>")`, so the same path registered twice is the same connector,
and the same path registered again after deletion resumes the revision series it left behind.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Layered — `domain/ application/ ports/ persistence/`, plus a `providers/` directory that no other capability has |
| **Endpoints** | **10**, all `POST`, all `responseMode: "inline"` (8 concurrent, 2 serial) |
| **DB file** | `./data/connector.db` — cwd-relative, opened at [`1-init/create/connector.ts:12`](../../../apps/backend/src/1-init/create/connector.ts) |
| **Tables** | **3** — `conn_<p>_entries`, `conn_<p>_items`, `conn_<p>_history` (`p = sha256(projectId).hex.slice(0,16)`) |
| **Revision model** | Deterministic id + `nextRevisionAfterHistory`. Registration starts at `MAX(history revision)+1`; each successful sync writes `revision+1` and archives the prior aggregate; delete writes snapshot@N then `deleted`@N+1. Purge erases the series, so a later re-registration restarts at 1 |
| **Tests** | [`test/capabilities/connector.test.ts`](../../../apps/backend/test/capabilities/connector.test.ts) — 441 lines, **9 tests**, all passing |
| **Source** | **9 files / 1,535 lines** in the capability directory; plus wiring `registerConnectorEndpointMappings.ts` (266), factory `create/connector.ts` (27), scheduler `create/connectorSyncScheduler.ts` (117) |
| **Config** | None. Connector has no section in `etc/configuration.yaml` and no entry in `BackendConfig`. Every limit is a module constant |
| **Module docs** | `src/3-capabilities/connector/docs/` — six files, 588 lines. Unusually accurate; the one overstatement is `runtime.md:112` on log hygiene (see §8) |
| **Status** | Complete and wired. One provider. **`POST /connector/read-*` reads any absolute path on the host** — the filesystem provider ignores the locator and nothing checks that the `itemKey` belongs to the connector (§8.1, KI-90). Also: three dead exports, one unreachable HTTP status, and one 500 that should be a 400 |

Per-file sizes:

| File | Lines |
| --- | ---: |
| `application/connectorService.ts` | 621 |
| `persistence/sqliteConnectorRepository.ts` | 406 |
| `providers/filesystem.ts` | 176 |
| `domain/model.ts` | 107 |
| `ports/repository.ts` | 63 |
| `domain/provider.ts` | 48 |
| `domain/errors.ts` | 44 |
| `domain/reader.ts` | 38 |
| `index.ts` | 32 |

---

## 2 · Domain model

### 2.1 Identity

[`connectorService.ts:26-29`](../../../apps/backend/src/3-capabilities/connector/application/connectorService.ts):

```ts
function connectorId(providerKind: string, locator: string): string {
  const canonical = `${providerKind}::${locator}`;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
```

Hex SHA-256 of `providerKind`, two colons, and **the locator exactly as supplied** — not
`resolve()`d, not trimmed beyond the non-empty check, not normalised. The provider resolves the
path separately at [`providers/filesystem.ts:148`](../../../apps/backend/src/3-capabilities/connector/providers/filesystem.ts),
so `./data` and `/abs/path/data` are two different connector IDs pointing at one directory, and
both pass the unique `(provider_kind, locator)` index because the stored strings differ.

Storage enforces the shape: `CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*')`
([`sqliteConnectorRepository.ts:34-35`](../../../apps/backend/src/3-capabilities/connector/persistence/sqliteConnectorRepository.ts)).

Knowledge source IDs are derived per item, and the sub-identifier is hashed first
(`connectorService.ts:31-38`): `connector:${entryId}:${sha256(itemKey)}`.

### 2.2 `ConnectorKind` — a four-arm union, enumerated

`domain/model.ts:11-15`:

| Arm | Meaning |
| --- | --- |
| `connector::file::text` | exactly one item, at least one prose item |
| `connector::file::other` | exactly one item, no prose item |
| `connector::directory::text` | zero or ≥2 items, at least one prose item |
| `connector::directory::other` | zero or ≥2 items, no prose item |

`determineKind` (`connectorService.ts:40-47`) computes it from the item list alone:

```ts
const hasProse = items.some(i => i.status === "prose");
const isSingle = items.length === 1;
if (isSingle) return hasProse ? "connector::file::text" : "connector::file::other";
return hasProse ? "connector::directory::text" : "connector::directory::other";
```

Two consequences worth stating plainly:

- **A directory containing exactly one file registers as a `connector::file::*` connector.** It
  then answers `service.getReader(id)` using `items[0]`, and
  `RuntimeResourceRegistry.findConnectorSource` treats it as a single whole-connector resource
  rather than a per-item one ([`1-init/create/resource-reader.ts:296-311`](../../../apps/backend/src/1-init/create/resource-reader.ts)).
  Adding a second file to that directory flips the kind on the next sync.
- **An empty directory yields `connector::directory::other` with zero items** and no Knowledge
  sources.

### 2.3 `ConnectorEntry`

`domain/model.ts:38-60`. Every field is `readonly`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | 64-hex; *"Stable ID: SHA-256(providerKind + "::" + locator), hex-encoded."* |
| `kind` | `ConnectorKind` | recomputed on every sync |
| `providerKind` | `string` | `"filesystem"` is the only registered value |
| `locator` | `string` | provider-specific; the raw string that was hashed |
| `label` | `string` | always set to the locator (`connectorService.ts:130`) — there is no user-supplied label |
| `revision` | `number` | ≥ 1 |
| `syncConfig` | `ConnectorSyncConfig \| null` | `null` unless the provider opted in **and** the caller supplied an interval |
| `syncing` | `boolean` | the persisted claim flag |
| `ingestionState` | `"active" \| "pending" \| "failed"` | reconciliation marker |
| `knowledgeSourceIds` | `readonly string[]` | one per prose item when `active`; a recovery union when not |
| `createdAt`, `updatedAt` | `string` | ISO-8601 from `new Date().toISOString()` |

### 2.4 `ConnectorItemEntry` (persisted) and `ConnectorItem` (from the provider)

`ConnectorItemEntry` (`domain/model.ts:67-82`): `itemKey`, `name`, `extension` (may be `""`),
`byteSize`, `revisionToken`, `lastModifiedAt`, `status: "prose" | "other"`,
`knowledgeSourceId: string | null`.

`ConnectorItem` (`domain/provider.ts:3-20`) is the provider-side shape: `key`, `name`,
`extension: string | null`, `byteSize`, `revisionToken`, `status`. The service maps `extension`
`null → ""` (`connectorService.ts:145`), which is why the SQL column is `TEXT NOT NULL` with no
non-empty check.

### 2.5 Sync configuration

`domain/model.ts:17-34`:

```ts
/**
 * Allowed sync intervals. Fixed multiples of each other so the scheduler
 * can batch connectors that share a cadence. Values in milliseconds.
 */
export const SYNC_INTERVALS = {
  "5min":   5 * 60 * 1000,        //   300,000 ms
  "30min": 30 * 60 * 1000,        // 1,800,000 ms  (6 × 5min)
  "2hr":    2 * 60 * 60 * 1000,   // 7,200,000 ms  (4 × 30min)
  "12hr":  12 * 60 * 60 * 1000,   // 43,200,000 ms (6 × 2hr)
} as const;
```

`SyncInterval = keyof typeof SYNC_INTERVALS` — four values, no others.
`ConnectorSyncConfig = { syncType: "scheduled"; interval: SyncInterval; lastSyncedAt?: string }`.

### 2.6 Request and result types

- `RegisterConnectorRequest = { providerKind: "filesystem"; locator: string; syncInterval?: SyncInterval }`
  (`domain/model.ts:84-88`). The `providerKind` field is typed to the literal `"filesystem"`, which
  is the only place in the tree where the single provider leaks into a public type; the runtime
  check is a generic non-empty-string test plus a lookup in the provider map.
- `RegisterConnectorResult = { status: "registered" | "already_exists"; entry; indexResults }`.
- `ItemIndexResult = { itemKey; name; status: "indexed" | "stored"; knowledge?: AddResult }` —
  `"indexed"` for prose, `"stored"` for everything else.
- `ConnectorHistorySnapshot = { entry; items }` (`domain/model.ts:62-65`) is the unit archived to
  history. **It is not exported from `index.ts`**, although it appears in the exported
  `ConnectorStore` signature — a consumer of `#connector` cannot name the type it receives.
- `SyncConnectorJobDefinition = { jobType: "SYNC_CONNECTOR"; connectorId; source: "scheduled" | "manual" }`
  (`domain/model.ts:103-107`) is **referenced by nothing** (§8).

### 2.7 The provider port

`domain/provider.ts:22-26`, verbatim — this is the contract, and it is a contract of behaviour
that the type system cannot express:

```
/**
 * A provider's job: given an external locator, list the items available
 * and produce readers for them. Providers are stateless — every call
 * re-connects to the external system.
 */
```

```ts
export interface ConnectorProvider {
  readonly kind: string;
  readonly label: string;
  readonly syncType?: "scheduled";
  listItems(locator: string): Promise<ConnectorItem[]>;
  getReader(locator: string, itemKey: string): Promise<ConnectorReader>;
}
```

`syncType` is the provider's *opt-in* to the shared scheduler, and the comment at
`domain/provider.ts:34` says who owns the diffing: *"Opt into the shared scheduler; the service
owns snapshot diffing."*

**The provider classifies and the service trusts it.** `ConnectorService` never re-derives
`status` from `PROSE_TEXT_EXTENSIONS`; it reads `item.status` (`connectorService.ts:146, 305`).
The allowlist is consulted in exactly one place — `classifyExtension` at
`providers/filesystem.ts:27-29`.

### 2.8 The reader API

`domain/reader.ts`:

```ts
export interface ByteRange {
  start: number; // 0-based, inclusive
  end: number;   // exclusive
}

export interface ConnectorReader {
  readonly byteSize: number;          // -1 if unknown
  readonly mimeType: string | null;
  read(range: ByteRange): Promise<string>;
  readAll(): Promise<string>;
  readStream(chunkSize?: number): AsyncIterable<string>;
  readLines(startLine: number, endLine: number): Promise<string[]>;  // 1-based, inclusive both ends
}

export interface DirectoryReader {
  listItems(): ConnectorItemEntry[];               // synchronous, from the persisted snapshot
  getItemReader(itemKey: string): Promise<ConnectorReader>;
}
```

`domain/reader.ts:6-9` states the lifetime rule: *"On-demand reader for a connector item.
Constructed per-read — no handles or connections are kept open."* The filesystem implementation
repeats it at `providers/filesystem.ts:44-47`: *"Opens and closes the file handle per read
operation — no handles are kept open between calls."*

The file has an unusual layout: `import type { ConnectorItemEntry }` sits at **line 31**, between
the two interfaces rather than at the top.

Filesystem reader limits (`providers/filesystem.ts:16-19`):

| Constant | Value | Applies to | Enforced at |
| --- | ---: | --- | --- |
| `MAX_RANGE_BYTES` | 1 MiB | `read(range)` | `filesystem.ts:66-68` |
| `MAX_FULL_READ_BYTES` | 16 MiB | `readAll()`, and transitively `readLines()` | `filesystem.ts:84-86` |
| `MAX_STREAM_CHUNK_BYTES` | 1 MiB | `readStream(chunkSize)` | `filesystem.ts:104-106` |
| `MAX_LINE_RANGE` | 10,000 | `readLines` inclusive count | `filesystem.ts:133-135` |

Behaviour that the limits table does not capture:

- `read` also rejects `range.end > this.byteSize` (`filesystem.ts:62`), where `byteSize` was
  captured when the reader was constructed (`getReader` stats the file, `filesystem.ts:173-174`).
  **A file that grew since the reader was made cannot be read past its construction-time size.**
- `readAll` re-stats the *open* handle (`filesystem.ts:83`) and applies the 16 MiB cap to the
  current size, not the construction-time one.
- `readStream` runs its chunks through a `StringDecoder`, so multibyte sequences survive chunk
  boundaries (`filesystem.ts:108, 117-121`). `read(range)` decodes its slice independently, so a
  **byte-range boundary can split a code point** and yield replacement characters. This asymmetry
  is deliberate on the stream side and simply unaddressed on the range side.
- `readLines` calls `readAll` then `full.split("\n")` (`filesystem.ts:136-138`) — **LF only**. A
  CRLF item returns lines with a trailing `\r`. General Files splits on `/\r?\n/u`; see
  [general-files.md](general-files.md) §8 for why that matters.
- `mimeType` is hardcoded `null` (`filesystem.ts:50`).
- All four range validations go through `assertInteger` (`filesystem.ts:21-25`), which throws
  `RangeError` — and `RangeError` is mapped to **400 `bad_request`** by the wiring
  (`registerConnectorEndpointMappings.ts:28-30`). The *provider* is therefore the de-facto wire
  validator; see §8.

### 2.9 The prose allowlist

`domain/model.ts:1-9`:

```
/**
 * Prose-text extensions — standalone copy owned by this capability.
 * Not imported from any other capability. Lists may intentionally diverge.
 */
export const PROSE_TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "org", "tex",
  "html", "htm",
  "log",
]);
```

Nine extensions. Extension derivation is `extname(name).slice(1).toLowerCase()`
(`filesystem.ts:33`): no dot, or a trailing dot, yields `""`, which is falsy, so `status` is
`"other"` and `ConnectorItem.extension` is `null` (`filesystem.ts:37, 40`).

General Files owns a **separate copy of the same nine strings**. The duplication is deliberate and
the comments in both files say so; the pair is quoted side by side in
[general-files.md](general-files.md) §7.

### 2.10 Errors

`domain/errors.ts` — five classes, each carrying a literal `code`:

| Class | `code` | Message | Thrown at |
| --- | --- | --- | --- |
| `ConnectorNotFoundError` | `not_found` | `Connector not found: ${id}` | `connectorService.ts:250, 468, 493, 502, 579, 584, 603` |
| `ConnectorAlreadyExistsError` | `already_exists` | `Connector already exists: ${providerKind}::${locator}` | **nowhere** (§8) |
| `UnsupportedLocatorError` | `unsupported_locator` | caller-supplied | `providers/filesystem.ts:167` |
| `SyncInProgressError` | `sync_in_progress` | `Sync already in progress for connector: ${id}` | `connectorService.ts:255, 260, 504` |
| `ConnectorValidationError` | `bad_request` | caller-supplied | `connectorService.ts:70, 87, 90, 96` |

`connectorService.ts:596` throws a **bare `Error`** — `"Use getDirectoryReader for directory
connectors"` — which the wiring cannot recognise, so it becomes a 500. See §8.

---

## 3 · Operations

`ConnectorService` (`connectorService.ts:49-60`) is the whole application surface. Ten methods; the
synchronous ones are marked.

| Method | Sync? | What it does |
| --- | :-: | --- |
| `register(request)` | async | Validates, looks up the provider, returns the existing entry if `(providerKind, locator)` is already live, otherwise lists items, admits every prose item to Knowledge, then inserts the entry and its items in one transaction |
| `sync(connectorId, lockAlreadyAcquired?)` | async | Acquires or verifies the claim, re-lists items, marks `pending`, adds/updates/removes Knowledge sources, then writes `revision+1` and `ingestionState: "active"` |
| `get(id)` | **sync** | Returns `publicEntry(entry)`; throws `ConnectorNotFoundError` |
| `list()` | **sync** | `store.listAll().map(publicEntry)`, ordered `created_at DESC` |
| `delete(id)` | async | Acquires the claim, marks `pending`, removes every tracked Knowledge source, then archives + tombstones + deletes the row |
| `purge(id)` | async | Erases the history series. `"current"` → `ResourceNotDeletedError`; `"missing"` → `ResourceHistoryNotFoundError` |
| `pruneHistory(cutoff)` | **sync** | Retention port half |
| `purgeExpired(cutoff)` | **sync** | Retention port half |
| `getReader(id)` | async | File connectors only — uses `items[0]`. Throws a bare `Error` for directory connectors |
| `getDirectoryReader(id)` | **sync** | Returns `{ listItems, getItemReader }`. **Does not check the connector kind** — it works on file connectors too |

### 3.1 `register` — the ordering that makes failure recoverable

1. Validate `providerKind` (non-empty string), `locator` (non-empty after trim), `syncInterval`
   (an own property of `SYNC_INTERVALS`, checked with
   `Object.prototype.hasOwnProperty.call`) — `connectorService.ts:86-97`.
2. `store.getByProviderAndLocator` — if a live row exists, log
   `connector.register.already-exists` and return `status: "already_exists"` with **HTTP 200**
   (`connectorService.ts:103-120`).
3. `provider.listItems(locator)`; compute `kind`; build the entry id.
4. For each prose item: derive the source id, open a reader, `knowledge.add({sourceId, label:
   "connector-item", revision: item.revisionToken, text: await reader.readAll()})`. Every admitted
   id is remembered in `admittedSourceIds`.
5. `revision = store.nextRevision(entryId)`, then `store.insert(entry, entryItems)`.
6. On any throw: re-check `getByProviderAndLocator`. If a concurrent writer won, return
   `already_exists` (`connector.register.concurrent-reuse`). Otherwise remove every source this
   call admitted, logging `connector.register.compensation-failed` per failure, then rethrow.

The whole prose loop precedes `store.insert`, so **a row never becomes current before its Knowledge
sources exist**.

### 3.2 `sync` — the reconciliation protocol

`ingestionState` is a persisted three-value marker, and `markIngestionState` is the primitive that
writes it without disturbing the last known-good item snapshot.

1. Acquire the claim (or verify it, when `lockAlreadyAcquired`), log `connector.sync.starting`.
2. `provider.listItems`; read the persisted items; compute `currentProseSourceIds`.
3. Compute `trackedSourceIds` = the union of the entry's existing `knowledgeSourceIds` and every
   current prose source id, then call
   `store.markIngestionState(id, "pending", trackedSourceIds, now())` — `connectorService.ts:288-293`.
   The reason is at `connectorService.ts:284-287`:

   > ```
   > // Persist the recovery boundary before Knowledge changes. Keep the
   > // last active item snapshot, but track every old/current source that a
   > // retry may need to reconcile. A crash or failure can therefore never
   > // present the old snapshot as known-good.
   > ```

4. `forceReconciliation = entry.ingestionState !== "active"` (`connectorService.ts:297`). When set,
   every current prose item is re-read and re-added even if its metadata is unchanged
   (`mustReadProse`, line 342) — that is how a failed attempt heals.
5. Walk the current items: new prose items are admitted; changed prose items are re-admitted;
   an item that changed from prose to other has its old source queued for removal.
6. Walk the persisted items: anything no longer present has its source queued for removal.
7. Remove everything in `trackedSourceIds` that is not in the new current set
   (`connectorService.ts:403-405`). The reason is at `connectorService.ts:400-402`:

   > ```
   > // Failed/pending attempts may have touched sources that were never
   > // part of the last active item snapshot. The persisted union makes
   > // those orphans discoverable and safe to remove on retry.
   > ```

8. `store.update(updatedEntry, newEntries, { entry, items: existingItems })` — one transaction that
   CAS-updates the row, archives the *pre-sync* aggregate at the old revision, deletes all item
   rows and reinserts them.
9. On any throw, attempt `markIngestionState(id, "failed", …)`. If that also throws, log
   `connector.sync.state-failed` and leave `pending` standing —
   `connectorService.ts:443-444`: *"The earlier pending marker remains authoritative even if the
   more specific failed transition cannot be persisted."*
10. `finally { store.clearSyncing(connectorId) }`.

`markIngestionState`'s SQL is `… WHERE id = ? AND syncing = 1` and throws
`Connector ingestion state lost its active sync claim: ${id}` when `changes !== 1`
(`sqliteConnectorRepository.ts:280-288`). It touches `ingestion_state`,
`knowledge_source_ids_json` and `updated_at` and **deliberately not `revision` or the item rows**.

**Public masking.** `publicEntry` (`connectorService.ts:76-81`) returns the entry unchanged when
`ingestionState === "active"` and otherwise blanks `knowledgeSourceIds`:

> ```
>     // Pending/failed source unions are recovery metadata, not a safe
>     // Knowledge scope. Keep the state visible while withholding those IDs.
> ```

It is applied by `get`, `list`, and both `already_exists` return paths of `register`. Because
`RuntimeResourceRegistry.findConnectorEntry` goes through `connector.get(id)`, **a pending or
failed connector contributes zero source IDs to a freshly resolved Knowledge scope**.

### 3.3 The `syncing` claim

Column: `syncing INTEGER NOT NULL DEFAULT 0 CHECK (syncing IN (0,1))`
(`sqliteConnectorRepository.ts:50-51`), with a plain index on it.

| Store method | SQL | Semantics |
| --- | --- | --- |
| `setSyncing(id)` | `UPDATE … SET syncing = 1 WHERE id = ? AND syncing = 0` (`:327-329`) | atomic 0→1 CAS; returns `changes > 0`. Port comment: *"Atomically set syncing = true if currently false. Returns true if the state changed, false if it was already syncing."* |
| `clearSyncing(id)` | `UPDATE … SET syncing = 0 WHERE id = ?` (`:336`) | unconditional; a no-op once the row is gone |
| `resetSyncing()` | `UPDATE … SET syncing = 0 WHERE syncing = 1` (`:342`) | returns the number of rows recovered. Port comment: *"Recover in-process sync locks left set by a previous process crash."* |

Three callers share the claim:

- `ConnectorService.sync(id)` with `lockAlreadyAcquired = false` acquires it
  (`connectorService.ts:258`).
- `ConnectorSyncScheduler.enqueueSyncJob` acquires it **at enqueue time**
  (`connectorSyncScheduler.ts:82`) and then calls `sync(id, true)`, which only *verifies* the flag
  is still set and throws `SyncInProgressError` if it is not (`connectorService.ts:253-256`).
- `ConnectorService.delete(id)` takes the same claim before any async work
  (`connectorService.ts:496-498`):

  > ```
  >       // Delete shares the same persisted claim as sync. Acquire it before any
  >       // asynchronous Knowledge cleanup so a sync cannot begin mid-delete.
  > ```

`resetSyncing()` is called from exactly one place: `ConnectorSyncScheduler.start()`
(`connectorSyncScheduler.ts:42`), logged as `connector.sync.scheduler.recovered { connectors }`.
Without it a process that died mid-sync would leave `syncing = 1` persisted and lock that connector
out permanently.

### 3.4 The sync scheduler

[`1-init/create/connectorSyncScheduler.ts`](../../../apps/backend/src/1-init/create/connectorSyncScheduler.ts),
117 lines, constructed at `startBackend.ts:197-202` and started at `startBackend.ts:214` — after
`app.listen`, for the reason quoted in §7.

`start()` (`:36-62`):

1. Early-return if `intervals.size > 0` (idempotent while running).
2. `store.resetSyncing()`.
3. `refreshEntries()`.
4. **One `setInterval` per key of `SYNC_INTERVALS` — always four timers, whatever the connector
   count.** Each callback calls `refreshEntries()` and then enqueues every entry whose `interval`
   matches that timer.

`refreshEntries()` (`:64-73`) rebuilds the in-memory map from `store.listSyncableEntries()`, whose
SQL is `WHERE syncing = 0 AND sync_config_json IS NOT NULL ORDER BY created_at DESC`
(`sqliteConnectorRepository.ts:347-357`). The SQL does **not** check `syncType`; the
`syncConfig?.syncType === "scheduled"` filter is applied in JavaScript
(`connectorSyncScheduler.ts:68`).

`enqueueSyncJob(id)` (`:75-108`) re-reads the entry, skips if it is missing, has no `syncConfig`,
or is already syncing; acquires the claim; then enqueues an inline **concurrent** job named
`connector.sync.scheduled` with id `sync-${connectorId}-${Date.now()}`. The job body catches sync
errors, logs `connector.sync.scheduled.error`, and returns `500 { status: "error" }` — a result
with no external retrieval endpoint, since nothing issued the request. A rejected `enqueue` promise
clears the claim and logs `connector.sync.scheduler.enqueue-failed`.

`stop()` (`:110-116`) clears the timers and the `intervals` map. It does **not** clear
`this.entries` and does not clear any `syncing` flags.

Because these are `setInterval` timers with no leading tick, **the first scheduled sync for a
connector happens one full interval after `start()`**.

---

## 4 · Endpoints

All ten are registered by
[`registerConnectorEndpoints`](../../../apps/backend/src/4-job-wiring/connector/registerConnectorEndpointMappings.ts).
All are `POST`, all `responseMode: "inline"`, all paths are string literals — there are no template
literals and no path parameters.

| # | Method + path | Job name | Queue | Line | Success | What it does |
| --: | --- | --- | --- | --: | --- | --- |
| 1 | `POST /connector/register` | `connector.register` | concurrent | 50 | 200 `RegisterConnectorResult` | Registers or returns the existing connector for `(providerKind, locator)` |
| 2 | `POST /connector/refresh` | `connector.refresh` | concurrent | 66 | 200 `{status:"synced"}` | Manual sync. **The 200 means the sync completed**, not that it was queued |
| 3 | `POST /connector/get` | `connector.get` | concurrent | 83 | 200 `ConnectorEntry` | Masked entry |
| 4 | `POST /connector/list` | `connector.list` | concurrent | 100 | 200 `ConnectorEntry[]` | Bare array, `created_at DESC` |
| 5 | `POST /connector/read-all` | `connector.read-all` | concurrent | 116 | 200 `{text}` | Whole item, ≤ 16 MiB |
| 6 | `POST /connector/read-range` | `connector.read-range` | concurrent | 148 | 200 `{text}` | Byte range `[start, end)`, ≤ 1 MiB |
| 7 | `POST /connector/read-lines` | `connector.read-lines` | concurrent | 183 | 200 `{lines}` | 1-based inclusive line range, ≤ 10,000 lines |
| 8 | `POST /connector/list-items` | `connector.list-items` | concurrent | 218 | 200 `ConnectorItemEntry[]` | From the persisted snapshot; no provider call |
| 9 | `POST /connector/delete` | `connector.delete` | **serial** | 235 | 200 `{status:"deleted", id}` | Logical delete |
| 10 | `POST /connector/purge` | `connector.purge` | **serial** | 251 | 204 `null` | Physical erase of the history series |

The capability's own `docs/flows.md:5` states the queue split — *"Register, refresh, reads, get,
list, and list-items use the concurrent queue. Delete and purge use the serial queue"* — and it is
correct at HEAD.

**Error ladder** (`registerConnectorEndpointMappings.ts:18-35`), in evaluation order:

| Error | Status | `error` code |
| --- | ---: | --- |
| `ConnectorNotFoundError` | 404 | `not_found` |
| `ConnectorAlreadyExistsError` | 409 | `already_exists` — **unreachable, see §8** |
| `SyncInProgressError` | 409 | `sync_in_progress` |
| `ConnectorValidationError` \| `UnsupportedLocatorError` \| `RangeError` | 400 | `bad_request` |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| anything else | 500 | `internal_error` |

Every caught error is also logged as `connector.<operation>.error` with `errorName` and `error`
(`registerConnectorEndpointMappings.ts:37-42`). The last two rows are the shared cross-capability
contract described in [07-capabilities/README.md](README.md) §5.

**Body handling.** `register` is `service.register(request.body as any)` (line 56) — the service is
the only validator. The other nine destructure `(request.body ?? {}) as { … }` at lines 72, 89,
123, 155, 190, 224, 241, 257 with no runtime checking, so:

- A missing `id` becomes `undefined`, which produces a `ConnectorNotFoundError` → **404**, not a
  400.
- `read-range`'s `start`/`end` and `read-lines`'s `startLine`/`endLine` are cast to `number` with no
  check and land in `assertInteger` inside the filesystem reader. That is why `RangeError` is on
  the error ladder. A future provider that skipped `assertInteger` would have **no wire-level
  guard at all**.

---

## 5 · Persistence

`SQLiteConnectorStore`
([`persistence/sqliteConnectorRepository.ts`](../../../apps/backend/src/3-capabilities/connector/persistence/sqliteConnectorRepository.ts))
opens `./data/connector.db`, sets `journal_mode = WAL` and `synchronous = NORMAL`, creates the
schema, then sets `foreign_keys = ON` (`:135-144`). **It does not set `busy_timeout`** — eight of
the thirteen store constructors in the backend do; see
[04-state-and-persistence.md](../04-state-and-persistence.md).

File header (`:1-2`): *"SQLite implementation of ConnectorStore. Table prefix =
SHA-256(projectId).slice(0,16)."*

### 5.1 `conn_<p>_entries` — one row per live connector

| Column | Type / constraint |
| --- | --- |
| `id` | `TEXT PRIMARY KEY CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*')` |
| `kind` | `TEXT NOT NULL CHECK (kind IN (…4 connector kinds…))` |
| `provider_kind` | `TEXT NOT NULL CHECK (length(provider_kind) > 0)` |
| `locator` | `TEXT NOT NULL CHECK (length(locator) > 0)` |
| `label` | `TEXT NOT NULL CHECK (length(trim(label)) > 0)` |
| `revision` | `INTEGER NOT NULL CHECK (revision >= 1)` |
| `sync_config_json` | `TEXT` nullable, `CHECK (json_valid(…) AND json_type(…) = 'object')` |
| `syncing` | `INTEGER NOT NULL DEFAULT 0 CHECK (syncing IN (0,1))` |
| `ingestion_state` | `TEXT NOT NULL DEFAULT 'active' CHECK (ingestion_state IN ('active','pending','failed'))` |
| `knowledge_source_ids_json` | `TEXT NOT NULL CHECK (json_valid(…) AND json_type(…) = 'array')` |
| `created_at`, `updated_at` | `TEXT NOT NULL` |

Indexes: `conn_<p>_entries_active_locator` **UNIQUE** on `(provider_kind, locator)`;
`conn_<p>_entries_syncing` on `(syncing)`; `conn_<p>_entries_kind_created` on
`(kind, created_at DESC)`.

### 5.2 `conn_<p>_items` — the persisted item snapshot

| Column | Type / constraint |
| --- | --- |
| `entry_id`, `item_key` | `TEXT NOT NULL`, composite `PRIMARY KEY (entry_id, item_key)` |
| `name` | `TEXT NOT NULL CHECK (length(trim(name)) > 0)` |
| `extension` | `TEXT NOT NULL` — may be the empty string |
| `byte_size` | `INTEGER NOT NULL CHECK (byte_size >= 0)` |
| `status` | `TEXT NOT NULL CHECK (status IN ('prose','other'))` |
| `revision_token` | `TEXT NOT NULL CHECK (length(revision_token) > 0)` |
| `last_modified_at` | `TEXT NOT NULL CHECK (length(last_modified_at) > 0)` |
| `knowledge_source_id` | `TEXT` nullable |

`FOREIGN KEY (entry_id) REFERENCES conn_<p>_entries(id) ON UPDATE CASCADE ON DELETE CASCADE`;
index `conn_<p>_items_status` on `(entry_id, status)`.

### 5.3 `conn_<p>_history` — the shared revision-history table

Created by `initializeResourceHistorySchema`
([`0-utils/persistence/resourceHistory.ts:43-65`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts)):
`(resource_kind, resource_id, revision, record_type, snapshot_json, recorded_at)`, primary key
`(resource_kind, resource_id, revision)`, a `CHECK` that a `snapshot` row has JSON and a `deleted`
row does not, and an index on `(recorded_at, resource_kind, resource_id)`. Connector's
`resource_kind` is the literal `"connector"`. The stored snapshot is a
`ConnectorHistorySnapshot` — the entry **and** its full item list.

### 5.4 The revision model, spelled out

- A fresh registration takes `store.nextRevision(entryId)` = `nextRevisionAfterHistory`, i.e.
  `MAX(revision) + 1` over the history rows for that ID, or `1` when there are none
  (`sqliteConnectorRepository.ts:209-211`).
- A successful sync writes `entry.revision + 1` and archives the *pre-sync* aggregate at the old
  revision. The archived snapshot is the in-memory entry read at the **start** of `sync`
  (`connectorService.ts:426`) — the last *active* state, never the intermediate `pending` row.
- The final update's `WHERE` is `id = ? AND revision = ? AND syncing = 1`
  (`sqliteConnectorRepository.ts:223`); a mismatch throws `Connector entry lost its current sync
  state: ${id}`.
- Delete archives the final snapshot at revision `N`, appends a `deleted` record at `N + 1`, and
  removes the row — all inside one transaction that first re-selects
  `WHERE id = ? AND revision = ? AND syncing = 1` (`sqliteConnectorRepository.ts:290-315`).
- **Re-registering the same `(providerKind, locator)` before purge produces the same ID at
  `terminal + 1`.** Pinned by `connector.test.ts:313`, *"deterministic Connector registration
  advances history until physical purge"*.
- **After purge the history is gone, so re-registration restarts at revision 1.**

`purge(id)` (`sqliteConnectorRepository.ts:372-377`) returns `"current"` when a live row exists →
`ResourceNotDeletedError` → 409; `"missing"` when `purgeResourceHistory` found no terminal
`deleted` record → `ResourceHistoryNotFoundError` → 404; otherwise `"purged"`.

Retention: `bindResourceRetentionPort("connector", connector)` at `startBackend.ts:141`, eighth of
the eleven ports. `pruneHistory` passes an `isCurrent` callback
(`(_kind, id) => Boolean(this.getById(id))`, `:388-395`), which is what lets a deterministic-ID
capability drop a tombstone once the same ID is live again.

---

## 6 · Invariants

| Invariant | Enforced at |
| --- | --- |
| Connector ID is 64 lowercase hex | `sqliteConnectorRepository.ts:34-35` (SQL CHECK) + `connectorService.ts:26-29` |
| At most one live connector per `(providerKind, locator)` | `sqliteConnectorRepository.ts:60-61` (UNIQUE index) + `connectorService.ts:103` (pre-check) |
| `providerKind` is a non-empty string | `connectorService.ts:86-88` |
| `locator` is non-empty after trim | `connectorService.ts:89-91` |
| `syncInterval` must be an own key of `SYNC_INTERVALS` | `connectorService.ts:92-97` |
| The provider must be registered | `connectorService.ts:68-72` |
| Only one claim holder (sync or delete) at a time | `sqliteConnectorRepository.ts:324-332` (CAS) |
| `sync(id, true)` requires the claim to still be held | `connectorService.ts:253-256` |
| Delete takes the claim before any Knowledge work | `connectorService.ts:496-505` |
| `pending` is persisted before the first Knowledge mutation | `connectorService.ts:292` |
| A state marker requires a live, claimed row | `sqliteConnectorRepository.ts:283-287` |
| The final sync write requires the exact prior revision **and** `syncing = 1` | `sqliteConnectorRepository.ts:223`, throw at `:249-251` |
| Delete requires the exact prior revision **and** `syncing = 1` | `sqliteConnectorRepository.ts:292-296` |
| Non-active entries expose no `knowledgeSourceIds` | `connectorService.ts:76-81` |
| Prose items are admitted to Knowledge before the row becomes current | `connectorService.ts:143-199` |
| A failed registration removes the sources that call admitted | `connectorService.ts:230-241` |
| `purge` refuses a live connector | `sqliteConnectorRepository.ts:373` → `connectorService.ts:562` |
| `purge` requires a terminal `deleted` record | `resourceHistory.ts` `purgeResourceHistory` → `connectorService.ts:563` |
| Byte range within construction-time `byteSize`, ≤ 1 MiB | `providers/filesystem.ts:57-68` |
| Full read ≤ 16 MiB | `providers/filesystem.ts:83-86` |
| Line range 1-based, `end >= start`, ≤ 10,000 lines | `providers/filesystem.ts:128-135` |
| Stream chunk ≥ 1 and ≤ 1 MiB | `providers/filesystem.ts:103-106` |
| Item rows cascade-delete with their entry | `sqliteConnectorRepository.ts:85-87` + `pragma foreign_keys = ON` at `:143` |

**Not enforced anywhere**: that `itemKey` belongs to the connector it is read through (§8); that a
locator resolves inside any root; that `byteSize` is non-negative before it reaches SQL (§8).

---

## 7 · Design decisions worth preserving

**The provider is stateless by contract** — `domain/provider.ts:22-26`:

```
/**
 * A provider's job: given an external locator, list the items available
 * and produce readers for them. Providers are stateless — every call
 * re-connects to the external system.
 */
```

**The filesystem adapter is not an authorization boundary, and says so first** —
`providers/filesystem.ts:1-6`, the entire file header:

```
// Local filesystem connector provider.
// DEVELOPMENT ONLY: this adapter deliberately exposes paths readable by the
// backend process. Production deployments should use an authenticated,
// policy-constrained provider instead.
// The ConnectorService calls listItems() and diffs against stored items for sync.
// mtime-based revision tokens enable selective sync (only changed items re-read).
```

Its `label` repeats the warning where an operator will see it:
`label: "Local Filesystem (development only)"` (`providers/filesystem.ts:144`). The capability's
own `docs/invariants.md:69` states the consequence without softening it:

> *"DirectoryReader's direct `getItemReader(itemKey)` does not validate membership before provider
> delegation. This is acceptable only under the explicitly development-only adapter assumption; it
> is not a production security guarantee."*

**Sub-identifiers are hashed into Knowledge source IDs** — `connectorService.ts:31-34`:

```
/**
 * Derive a stable Knowledge source ID. Sub-identifiers are hashed before
 * inclusion to avoid issues with arbitrary filenames/URLs/keys.
 */
```

**Recovery metadata is not a Knowledge scope** — `connectorService.ts:78-79`:

```
    // Pending/failed source unions are recovery metadata, not a safe
    // Knowledge scope. Keep the state visible while withholding those IDs.
```

**The recovery boundary is written before Knowledge is touched** — `connectorService.ts:284-287`:

```
        // Persist the recovery boundary before Knowledge changes. Keep the
        // last active item snapshot, but track every old/current source that a
        // retry may need to reconcile. A crash or failure can therefore never
        // present the old snapshot as known-good.
```

**Orphans from a failed attempt are made discoverable** — `connectorService.ts:400-402`:

```
        // Failed/pending attempts may have touched sources that were never
        // part of the last active item snapshot. The persisted union makes
        // those orphans discoverable and safe to remove on retry.
```

**A failed state transition does not erase the earlier one** — `connectorService.ts:443-444`:

```
            // The earlier pending marker remains authoritative even if the
            // more specific failed transition cannot be persisted.
```

**Delete borrows the sync claim** — `connectorService.ts:496-497`, and the cleanup note at `:548`:

```
      // Delete shares the same persisted claim as sync. Acquire it before any
      // asynchronous Knowledge cleanup so a sync cannot begin mid-delete.
```

```
        // Releasing the claim after the current row is removed is a no-op.
```

**Why `markIngestionState` exists at all** — `ports/repository.ts:29-32`:

```
  /**
   * Persist a reconciliation boundary without replacing the last active item
   * snapshot. Tracked source IDs are the union that a retry must reconcile.
   */
```

**Why intervals are fixed multiples** — `domain/model.ts:17-20`:

```
/**
 * Allowed sync intervals. Fixed multiples of each other so the scheduler
 * can batch connectors that share a cadence. Values in milliseconds.
 */
```

**Why the scheduler rediscovers rather than being told** — `connectorSyncScheduler.ts:39-41`:

```
    // Load persisted registrations immediately. Every tick refreshes this
    // snapshot so connectors registered after startup join without requiring a
    // composition-layer callback.
```

**Why the scheduler starts after `listen`** — `startBackend.ts:210-212`:

```
    // Start recurring work only after the transport has bound successfully.
    // Otherwise a listen failure would leave interval timers keeping the
    // failed startup process alive.
```

`runtime-wiring.test.ts:218` reads `startBackend.ts` as text and asserts that
`syncScheduler.start()` appears after `app.listen` — one of three source-scanning regression tests
in the suite.

---

## 8 · Known gaps and defects

Items with an entry in [11-known-issues.md](../11-known-issues.md) are cross-referenced there.

### 8.1 Security: `read-*` accepts any `itemKey`, and the filesystem provider ignores the locator

`filesystemProvider.getReader(_locator, itemKey)` **ignores the locator entirely**
(`providers/filesystem.ts:172-175`) and stats `itemKey` directly. `DirectoryReader.getItemReader`
does not check that `itemKey` is one of the connector's persisted items
(`connectorService.ts:614-617`). The item key produced by the provider is the **resolved absolute
path** (`fileToItem`, `providers/filesystem.ts:35`).

Therefore `POST /connector/read-all`, `/read-range` and `/read-lines`, given any registered
connector `id` and an arbitrary absolute path as `itemKey`, read that path from disk with the
backend process's privileges. There is no root confinement, no ACL check, no tenant check and no
symlink policy. The capability documents this as acceptable *only* under the development-only
adapter assumption. **Nothing in the code enforces that assumption**: `filesystemProvider` is
registered unconditionally at `1-init/create/connector.ts:25`, and it is the only entry in the
provider map. → [11-known-issues.md](../11-known-issues.md)

### 8.2 Log hygiene: `itemKey` is logged on every read, and it is an absolute path

`registerConnectorEndpointMappings.ts:133-138, 166-173, 201-208` log `itemKey` at `info` on every
`read-all`, `read-range` and `read-lines`. For the filesystem provider that value is an absolute
filesystem path. Six debug logs in the service do the same (`connectorService.ts:154, 316, 351,
359-363, 385-389, 587-592`). `connector.delete.removing-source` (`:521-524`) is the one read-path
log that does **not** — it carries `connectorId` and `sourceId`, and `sourceId` embeds
`sha256(itemKey)` rather than the path itself (`connectorService.ts:35-38`).

None of these records carries a `detail` label. `grep -rn "detail:"` across
`3-capabilities/connector`, `3-capabilities/general-files`, `3-capabilities/context`, their wiring
files and their factories returns **nothing** — the whole slice predates the `LogOptions.detail`
mechanism introduced in this very commit, so every one of these records is written unlabelled and
is therefore treated as `shape` and never dropped, even when `logging.detail: "shape"` is
configured. The logger's own taxonomy classifies names, titles and field values as `content`.

The capability's own `docs/runtime.md:112` — *"Logs include locator-derived labels only in
persisted/public entry data; normal operation logs avoid file content"* — is true about file
*content* and reads as a stronger guarantee than the code gives about paths.
→ [11-known-issues.md](../11-known-issues.md), [09-configuration.md](../09-configuration.md)

### 8.3 `ConnectorAlreadyExistsError` is never thrown — the 409 branch is unreachable

Defined at `domain/errors.ts:10-17`, exported at `index.ts:24`, mapped to
**409 `already_exists`** at `registerConnectorEndpointMappings.ts:22-24`. `grep -rn
ConnectorAlreadyExistsError src test` finds only the definition, the barrel, the import and the
mapping — **no `throw`**. `register` returns `{status: "already_exists"}` with HTTP **200**
instead. A client that branches on 409 will never see it. The capability's own `docs/types.md:76`
already records this.

### 8.4 `getReader` on a directory connector returns 500, not 400

`connectorService.ts:596` throws `new Error("Use getDirectoryReader for directory connectors")` —
an untyped `Error`, so the ladder falls through to **500 `internal_error`**. The trigger is a
plain client mistake: `POST /connector/read-all` (or `read-range`, `read-lines`) against a
directory connector with no `itemKey` in the body. → [11-known-issues.md](../11-known-issues.md)

### 8.5 Dead and unreachable code

| Symbol | Where | Status |
| --- | --- | --- |
| `updateSyncTimestamp` | port `ports/repository.ts:62`, impl `sqliteConnectorRepository.ts:359-370` | **No caller.** `lastSyncedAt` is written through the full `store.update` in `sync` (`connectorService.ts:421-423`). Self-reported at `docs/types.md:94` |
| `ConnectorSyncScheduler.register()` / `.unregister()` | `connectorSyncScheduler.ts:23-34` | **Unreachable.** `startBackend.ts` calls only `start()` (`:214`) and `stop()` (`:222`); nothing else constructs the scheduler. Even if called, `refreshEntries()` clears the map on the next tick (`:66`), so a registration would be erased |
| `SyncConnectorJobDefinition` | `domain/model.ts:103-107` | **Referenced by nothing**, and not on the barrel. The scheduler builds a plain `JobDefinition` named `connector.sync.scheduled`. The scheduler's own header still says it *"enqueues SYNC_CONNECTOR Jobs"* — descriptive only |
| `ConnectorReader.readStream` | port `domain/reader.ts:23`, impl `providers/filesystem.ts:102-125` | **No production caller.** No service method, endpoint or resource reader invokes it; only `connector.test.ts:104` does |
| `ConnectorStore.history(id)` | port `:41`, impl `:379-386` | **No production caller.** Used only by `connector.test.ts:331, 343, 403`. There is no history endpoint and no service method — history is write-only from a client's point of view, observable only through the 409/404 that `purge` returns |
| `ConnectorHistorySnapshot` | `domain/model.ts:62-65` | Not exported from `index.ts`, though it appears in the exported `ConnectorStore` signature |
| unused import | `ports/repository.ts:4` imports `ConnectorSyncConfig`; the file never uses it | compiles because `noUnusedLocals` is off |
| unused local | `registerConnectorEndpointMappings.ts:126` — `const entry = service.get(id);` inside the `itemKey` branch of `read-all` | The value is discarded **and the check is redundant**: `service.getDirectoryReader(id)` on the next line performs the same lookup and throws the same `ConnectorNotFoundError`. The only effect is one extra `SELECT`. `read-range` and `read-lines` omit it and behave identically |

### 8.6 Four interval timers run forever, whether or not anything is scheduled

`ConnectorSyncScheduler.start()` creates one `setInterval` per key of `SYNC_INTERVALS`
(`connectorSyncScheduler.ts:46-61`) — four timers at 5 min, 30 min, 2 h and 12 h — **even with zero
registered connectors**. They are **not** `unref()`ed. The only two `unref()` calls in the whole of
`src/` are `documentService.ts:2185` and `resourceRetentionScheduler.ts:66`, so the connector
timers alone are enough to keep the event loop alive. Every tick performs a `listSyncableEntries()`
query regardless. The capability's own `docs/invariants.md:76` states this correctly.

### 8.7 `byteSize: -1` is documented and rejected by SQL

`ConnectorItem.byteSize` is documented as *"Byte size, if known. -1 if unknown"*
(`domain/provider.ts:10-11`), but `conn_<p>_items.byte_size` carries `CHECK (byte_size >= 0)`
(`sqliteConnectorRepository.ts:75-76`). A provider that returned `-1` would fail the insert with a
constraint error surfaced as a 500. The filesystem provider always supplies `st.size`, so the
conflict is latent. Self-reported at `docs/types.md:67`.

### 8.8 Line semantics differ from General Files behind the same tool

`ConnectorReader.readLines` splits on `"\n"` only (`providers/filesystem.ts:137`), while the
General Files path in `resource-reader.ts:37` splits on `/\r?\n/u`. Both feed
`ResourceReader.read(resourceId, resourceKind, startLine, endLine, scope)`, so **a CRLF connector
item returns lines with a trailing `\r` and a CRLF General File does not**. Neither module's `docs/`
mentions the divergence. Detailed in [general-files.md](general-files.md) §8.

### 8.9 Weak wire validation

Nine of ten endpoints destructure `(request.body ?? {}) as { … }` with no runtime check, and
`register` uses `request.body as any`. Concretely: a missing `id` produces a 404 rather than a 400;
`start`/`end`/`startLine`/`endLine` are validated only inside the filesystem reader; and no
endpoint rejects unknown keys.

### 8.10 What no test covers

The suite is 9 tests. Not covered: `MAX_FULL_READ_BYTES`; `MAX_LINE_RANGE`; `readStream`
chunk-size validation; the `itemKey` membership hole (§8.1); the `getReader`-on-a-directory 500
(§8.4); and the scheduler's interval timers actually firing — `connector.test.ts:279` asserts only
that `start()` calls `resetSyncing` and `listSyncableEntries` once each.

### 8.11 Module docs pointing into `scratch/`

`src/3-capabilities/connector/docs/README.md:51-52` links to `scratch/connector-design.md` and
`scratch/recent-capabilities-fixes-2026-08-01.md`. Those are the owner's live drafts, deliberately
ahead of the code, and are not authority for anything on this page.

---

**See also**: [03-capability-anatomy.md](../03-capability-anatomy.md) for the layered shape ·
[04-state-and-persistence.md](../04-state-and-persistence.md) for the shared history table and the
retention sweep · [06-platform-services.md](../06-platform-services.md) for Knowledge ·
[general-files.md](general-files.md) and [context.md](context.md) for the two capabilities Connector
shares a resource surface with.
