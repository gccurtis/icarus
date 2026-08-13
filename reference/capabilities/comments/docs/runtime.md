# Comments runtime and persistence

## Construction

The core factory is:

```ts
createCommentsCapability(store, dependencies, limitOverrides?, clock?, idGenerator?)
```

Dependencies are a logger, trusted attribution, and an optional narrow Activity
publisher. Clock and ID generation are injectable for deterministic tests.
Startup creates `SQLiteCommentStore(config.projectId, "./data/comments.db")`,
uses the configured user as trusted `origin: "user"` attribution, and maps the
publisher to Activity.

No user ID participates in table partitioning. The store derives a 16-hex
SHA-256 prefix from project ID and creates that project's tables in the chosen
database.

## Runtime operations

`command` normalizes input, hashes the normalized command, and checks its
receipt before dispatch. Create, update, state changes, and delete write the
Comment revision, receipt, and source transaction outbox in one SQLite transaction. A matching
resolve/reopen writes only a receipt. Post-commit Activity publication is best
effort and never rolls back accepted Comment state.

`query` validates and dispatches get or target-list requests. Both read the
current table only, so logically deleted Comments are absent without lifecycle
filters. Target lists apply an optional state filter, order ascending, and read
one extra row to determine a next cursor.

`publishPendingActivity` reads unpublished source rows in occurred-time/ID
order, publishes each stable transaction, and marks it only after Activity
accepts it. Failures are safely logged and remain pending.

## Limits

| Value | Default |
| --- | --- |
| Trimmed body | 16 KiB UTF-8 |
| Identifier | 4,096 UTF-8 bytes |
| Canonical serialized sub-target | 16 KiB UTF-8 |
| Distinct mentions | 64 |
| Mention handle | 64 ASCII characters |
| Target page | default 50, maximum 200 |

Runtime options can override these defaults. Limits must be positive safe
integers and default page size cannot exceed maximum page size.

## SQLite representation

The adapter enables WAL, foreign keys, five-second busy timeout, and NORMAL
synchronous mode. It creates four tables:

| Table | Authority |
| --- | --- |
| `<prefix>_comments` | Current revision, body, target, state, and attribution for live Comments only. |
| `<prefix>_history` | Superseded Comment snapshots and terminal deletion revisions. |
| `<prefix>_command_receipts` | Project-global request digest and original result. |
| `<prefix>_transaction_outbox` | Immutable source transaction data and publication marker. |

Separate partial indexes support target order, target-plus-state order, and
pending Activity scans. There is no foreign key to a target resource database.

## Public endpoints

| Method/path | Job | Queue | Result |
| --- | --- | --- | --- |
| `POST /comments/command` | `comments.command.v1` | serial, inline | 201 create; otherwise 200 |
| `POST /comments/query` | `comments.query.v1` | concurrent, inline | 200 typed query result |

Both decoders enforce exact top-level and target keys. Actor/origin fields are
therefore rejected rather than ignored. Domain normalization runs again inside
the capability so trusted in-process callers receive the same bounds.

## Logging

The required logger records runtime creation, command completion/replay/failure,
committed mutation metadata, matching-state no-ops, get/list outcomes, Activity
publication and recovery, endpoint rejection, counts, and durations. Comment
bodies, raw mention handles, and `subTarget` values are never logged.
