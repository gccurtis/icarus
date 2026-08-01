# Activity runtime and function map

## Construction

The core factory is:

```ts
createActivityCapability(
  store: ActivityStore,
  options: ActivityOptions = {},
  clock: ActivityClock = systemClock
): ActivityCapability
```

The default Presence TTL is 30 seconds. `presenceTtlMs` must be a positive safe
integer. The clock must return a parseable ISO timestamp every time it is read.
Injecting a clock keeps lease-expiry behavior deterministic in tests.

[`createActivityInstance`](../../../1-init/create/activity.ts) constructs
`SQLiteActivityStore(config.projectId, "./data/activity.db")` and passes it to
the core factory. Startup creates that instance before resource kinds, then
registers Activity routes through
[`registerActivityEndpoints`](../../../4-job-wiring/activity/registerActivityEndpoints.ts).

`SQLiteActivityStore(projectId, dbPath)` creates the containing directory,
derives a 16-hex SHA-256 prefix from the project ID, creates that project's
tables, and configures WAL, foreign keys, a five-second busy timeout, and NORMAL
synchronous mode.

## `ActivityCapability`

### `publish(transaction)`

`publish` is trusted internal ingestion. It validates required bounded strings,
optional bounded strings, origin, non-negative safe revision, occurred timestamp,
and JSON-compatible metadata. It then calls
`ActivityStore.publish(transaction, now())`.

The method returns the original stored transaction for an equal replay. It does
not assign a new transaction ID, rewrite source data, or call a producing kind.
It is deliberately not an arbitrary public append API.

### `query(query)`

`query` dispatches the closed `ActivityQuery` union:

| Query | Runtime action |
| --- | --- |
| `activity.transactions` | asks the store for a filtered descending cursor page |
| `activity.transaction` | validates the ID then retrieves one transaction |
| `presence.list` | delegates to `presence.list`, using the current clock time |

The public endpoint maps `POST /activity/query` to an inline concurrent job
named `activity.query.v1`. Its decoder admits only the three typed query
variants and reads their documented filter fields, while currently ignoring
unknown object keys. Validation/cursor errors return 400; unexpected failures
are logged and return a non-sensitive 500 response.

### `presence`

| Method | Behavior |
| --- | --- |
| `heartbeat(input)` | validates trusted lease input, calculates `expiresAt = now + TTL`, then upserts the session. |
| `leave(sessionId)` | validates ID, deletes that lease, and returns whether a row existed. |
| `list(filter?)` | reads only leases with `expiresAt > now`; expiry filtering works before cleanup. |
| `removeExpired(limit?)` | deletes one expired batch and returns its count. |

Heartbeat/state validation uses the same canonical JSON admission as transaction
metadata. A session can update kind, resource, actor, and state on each
heartbeat because a lease represents current state, not history.

No transport currently establishes a trusted stable session identity. The
registered `POST /activity/command` route therefore logs a warning and returns
501 without invoking any Presence runtime method. This is intentional and must
remain true until an authenticated session-aware transport supplies context.

## SQLite store methods

`SQLiteActivityStore` implements the `ActivityStore` port:

| Method | Persistence behavior |
| --- | --- |
| `publish` | hashes canonical transaction data; in one SQLite transaction, returns equal existing ID, rejects changed existing ID, or allocates/records sequence and transaction. |
| `getTransaction` | reads by stable transaction ID. |
| `listTransactions` | filters exact kind/resource, applies older-than-sequence cursor, reads `limit + 1`, and emits an opaque next cursor when needed. |
| `upsertPresence` | canonicalizes state and atomically inserts/overwrites the session row. |
| `removePresence` | deletes by session ID. |
| `listPresence` | applies `expires_at > now` plus optional kind/resource filters. |
| `removeExpiredPresence` | deletes oldest expired rows using a bounded rowid subquery. |

The transaction list defaults to 50 items and caps requests at 200. Presence
cleanup defaults to 100 rows and caps at 1,000. A bad store-level limit throws
an error; endpoint admission normally rejects bad client limits earlier.

## SQLite tables and indexes

For a project prefix `activity_<hash>`, the adapter creates:

| Table | Authority |
| --- | --- |
| `<prefix>_meta` | Singleton `next_sequence` allocator, initialized to 1. |
| `<prefix>_transactions` | Stable transaction data, unique ID/sequence, canonical digest, and receipt time. |
| `<prefix>_presence` | One mutable current-state lease per session ID. |

The transaction feed index supports descending `(sequence, id)` scans. A
kind/resource/sequence index supports narrowed feeds. Presence has expiry and
kind/resource/expiry indexes. All names are project-hashed in the chosen SQLite
database; no user ID is part of the storage partition.

## Canonical helpers

[`canonicalizeMetadata`](../domain/canonical.ts) recursively accepts JSON
values, sorts object keys, omits `undefined` object members, and rejects
non-finite numbers and non-JSON values. It ensures equivalent key order has the
same stored representation and digest.

[`digestActivityTransaction`](../domain/canonical.ts) SHA-256 hashes the
complete normalized transaction, including nulls for omitted optional fields
and canonical metadata. It distinguishes harmless replay from reuse of one ID
for different content.

## Source-publisher and management boundaries

The core/runtime does not define a source-specific outbox schema or publisher.
Document currently supplies the first composition adapter:

- its accepted create/change/compensate work co-commits a self-contained local
  outbox record;
- [`createDocumentInstance`](../../../1-init/create/document.ts) maps that
  record into an Activity transaction and calls trusted `activity.publish`;
- Document marks the local row published only after that call succeeds;
- delivery failure only logs a warning, leaving accepted Document state intact;
  and
- startup calls `document.publishPendingActivity()` to retry unpublished rows.

The adapter maps Document's `interactive` origin to Activity's `user` origin,
uses the source record's stable ID as the Activity transaction ID, and carries
operation types plus any compensation descriptor as Activity metadata. This
still does not make Document and Activity SQLite writes a distributed
transaction. Slide and other producer adapters are not wired yet.

Likewise, undo/redo, Presence connection management, and session derivation are
not runtime methods. They need separate trusted adapters at their respective
boundaries.
