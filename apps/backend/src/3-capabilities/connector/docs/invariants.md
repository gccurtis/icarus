# Connector invariants, guarantees, and limits

## Preconditions → guaranteed outcomes

| Preconditions | Current guaranteed outcome | Boundary |
|---|---|---|
| Valid known provider, nonblank locator, allowed optional interval | Register derives deterministic ID and provider snapshot | Service/provider |
| Exact active provider+locator already exists | Register returns `already_exists` without changing entry/schedule or relisting | Store live lookup |
| Register completes | Every persisted prose item was successfully added to Knowledge before entry activation | Service sequencing |
| Initial persistence fails and no concurrent winner exists | Every source admitted by that call is attempted for removal | Best-effort compensation |
| Sync/delete acquires claim | No other current claimant can start through `setSyncing` | Atomic SQLite CAS |
| Sync reaches first Knowledge mutation | A persisted pending boundary already tracks the old/current source union | Guarded state update |
| Sync completes | Entry/items form one SQLite snapshot, state active, source list equals current prose items, revision +1 | Transactional store update |
| Sync fails after pending | State remains pending or becomes failed; public source list is empty | Reconciliation marker/public filter |
| Retry starts from pending/failed | All current prose is re-added and all tracked non-current sources are removed before active publication | Forced reconciliation |
| Delete completes | All tracked Knowledge sources were removed before tombstone | Service ordering + guarded delete |
| Active deterministic connector is deleted then re-registered | Same ID is restored at prior revision +1 | Store restore transaction |

## Identity and revision

- Connector ID hashes the exact locator string, not the filesystem-resolved canonical path. Equivalent path spellings can therefore produce different connector IDs.
- Item source ID hashes the item key under connector ID.
- Active exact `(providerKind, locator)` uniqueness is enforced by a partial SQLite index.
- Connector revision starts at 1 and increments on restore or every successful sync.
- `register` of an existing active row does not increment revision.
- Every item in one connector's Derived resource manifest currently shares connector revision, not its provider revision token.
- Provider revision tokens govern Knowledge add/upsert and metadata-change detection.

## Ingestion consistency and atomicity

Entry+item insert/restore/update is atomic inside Connector SQLite. Claim/state/delete guards are atomic individual statements. No transaction spans provider state, Knowledge, and Connector SQLite.

The `active | pending | failed` protocol guarantees visibility of uncertainty, not all-or-nothing distributed rollback:

- Knowledge may be partially changed after a failure.
- Tracked union makes those touched IDs discoverable to a later retry.
- Pending/failed source IDs are withheld from new Context/Derived scope.
- Existing Knowledge windows may remain until reconciliation; the public manifest exclusion prevents this Connector from advertising them as known-current.
- A crash after Knowledge completion but before active store update is recovered by the same forced retry.

## Sync/delete concurrency

- `setSyncing` is the shared sync/delete claim across manual calls, timer jobs, direct service callers, and processes on the same database.
- Scheduler claims at enqueue; `sync(id,true)` verifies it remains held.
- Final snapshot update requires `deleted_at IS NULL AND syncing=1`.
- Delete also holds the claim through its guarded tombstone write.
- `finally` clears the flag; startup clears flags left by process crashes.
- In-process timers are not durable job records; a process restart relies on persisted connector config and state, not queued timer work.

## Reader limits

| Limit | Value | Applied by filesystem reader |
|---|---:|---|
| byte range | 1 MiB | `read` selected range |
| full read | 16 MiB | `readAll`, and therefore `readLines` |
| stream chunk | 1 MiB | caller-selected chunk size |
| line range | 10,000 lines | inclusive requested count |

Offsets/counts must be safe integers. Byte range is `[start,end)`, within the reader's construction-time byte size. Line range is one-based and inclusive. Stream decoding preserves UTF-8 across chunks; a byte-range boundary may split a multibyte code point because the selected bytes are decoded independently.

## Provider and filesystem scope

- The provider port is generic, but only `filesystem` is registered.
- Filesystem directories are shallow and include direct regular files only.
- Empty/trailing-dot extensions are accepted and classified other.
- PDF/DOCX are other until an extractor exists.
- The adapter follows paths readable by the backend process and does not enforce a root, ACL, symlink policy, or tenant boundary.
- DirectoryReader's direct `getItemReader(itemKey)` does not validate membership before provider delegation. This is acceptable only under the explicitly development-only adapter assumption; it is not a production security guarantee.
- A production provider must add authenticated/policy-constrained access rather than inheriting filesystem behavior.

## Scheduled behavior

- A connector is scheduled only when provider opted in and registration included an allowed interval.
- Scheduler discovers persisted registrations at start and every tick.
- Four interval timers run while scheduler is started, even with no entries.
- Register/unregister scheduler methods exist but database rediscovery is the active integration.
- Manual refresh is inline: HTTP 200 means sync completed, not merely enqueued.

## Failure and logging

- Provider stat/read/list errors propagate to endpoint 500 unless typed unsupported locator/range.
- Knowledge/store failure during sync records failed state when possible and rethrows.
- If failed-state write itself fails, the earlier pending marker remains.
- Scheduled job catches sync failure and returns internal 500 result; scheduler enqueue rejection clears claim.
- Logs contain connector/item/source identities, counts, state, durations, and error metadata; file content is excluded.

## Context/Derived scope

- Only active entries expose source IDs.
- Other items have no source ID and are excluded from Knowledge scope.
- Directory items map individually; file connector maps as one resource.
- Frozen reads enforce exact descriptor membership and connector revision.
- This scope is retrieval containment, not end-user authorization.

## Regression coverage

[`connector.test.ts`](../../../../test/capabilities/connector.test.ts) covers absolute list-route registration, extensionless classification, reader bounds/stream UTF-8, prose→other Knowledge removal, failed-sync reconciliation and retry, scheduler startup discovery/recovery, deterministic resurrection, delete/sync race safety, and inline manual-refresh errors.

## Non-goals

Current non-goals are remote providers, production filesystem security, recursive directory walking, watcher-driven sync, provider push events, durable timer jobs, streaming Knowledge admission, binary extraction, MIME detection, per-item endpoint authorization, global outbox/distributed transactions, and fine-grained source ACLs.
