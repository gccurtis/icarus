# Activity type reference

Canonical type authority is [`domain/model.ts`](../domain/model.ts). The
application service validates trusted inputs before it calls the store; the
SQLite adapter persists the same model families.

## Transaction family

| Type | Purpose |
| --- | --- |
| `ActivityOrigin` | `user | agent | automation | system`, describing who or what initiated accepted work. |
| `ActivityTransactionInput` | Trusted source payload with a stable `idempotencyKey`; it cannot select an Activity ID. |
| `ActivityTransaction` | Accepted action with the Activity-owned returned `id`. |
| `StoredActivityTransaction` | An Activity transaction after first acceptance, including Activity `sequence` and `publishedAt`. |
| `ActivityTransactionFilter` | Optional kind/resource filter plus descending-feed cursor and page limit. |
| `ActivityTransactionPage` | Descending transaction items and optional cursor for the next older page. |

Publication accepts:

```ts
interface ActivityTransactionInput {
  idempotencyKey: string;
  kind: string;
  resourceId?: string;
  operation: string;
  revision?: number;
  changeSetId?: string;
  actorId?: string;
  origin: "user" | "agent" | "automation" | "system";
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}
```

`ActivityTransaction` replaces `idempotencyKey` with the Activity-owned `id`,
derived as `act_<sha256(idempotencyKey)>`.

`kind` and `operation` provide the event label, for example
`document.changed`. `resourceId`, `revision`, and `changeSetId` are
optional because project/runtime work can have no individual resource or source
history entry. `metadata` is display/audit data only; it must remain
JSON-compatible rather than holding a copied resource body.

`StoredActivityTransaction` adds:

```ts
interface StoredActivityTransaction extends ActivityTransaction {
  sequence: number;
  publishedAt: string;
}
```

The Activity-generated digest covers all transaction fields, including
canonicalized metadata. It is internal storage detail, not part of the public
transaction object.

## Query family

`ActivityQuery` is a closed union:

| Query discriminant | Input | Result |
| --- | --- | --- |
| `activity.transactions` | optional `ActivityTransactionFilter` | `ActivityTransactionPage` |
| `activity.transaction` | `transactionId` | stored transaction or `undefined` |
| `presence.list` | optional `ActivityPresenceFilter` | unexpired `PresenceLease[]` |

`ActivityQueryResult` mirrors the discriminant so callers can narrow its
result safely. `activity.transactions` lists newest Activity sequence first.
Its opaque cursor carries the last sequence from the previous page; callers
must not construct or reinterpret it.

The registered HTTP query decoder recognizes these same three discriminants and
the documented filter fields. It rejects an unsupported query type or a
non-object query/filter with `ActivityValidationError`; it currently ignores
unknown object keys rather than enforcing exact-key admission.

## Presence family

| Type | Purpose |
| --- | --- |
| `ActivityPresenceHeartbeat` | Trusted upsert input for a session's current Presence state. |
| `PresenceLease` | Stored heartbeat data plus `updatedAt` and `expiresAt`. |
| `ActivityPresenceFilter` | Optional kind/resource filter for current Presence. |
| `ActivityPresenceRuntime` | Heartbeat, leave, list, and expired-lease cleanup methods. |

```ts
interface ActivityPresenceHeartbeat {
  sessionId: string;
  actorId?: string;
  kind?: string;
  resourceId?: string;
  state: Readonly<Record<string, unknown>>;
}

interface PresenceLease extends ActivityPresenceHeartbeat {
  updatedAt: string;
  expiresAt: string;
}
```

The term *trusted* matters: these are runtime inputs after transport has
derived session/actor context. They are not a browser-facing authentication
contract. The current HTTP command endpoint deliberately does not decode or
accept a heartbeat/leave command because it lacks that context.

## Runtime and configuration family

| Type | Purpose |
| --- | --- |
| `ActivityCapability` | Core runtime: trusted `publish`, typed `query`, and `presence`. |
| `ActivityDependencies` | Required shared `logger`. |
| `ActivityOptions` | Currently only optional `presenceTtlMs`. |
| `ActivityClock` | Injected `now(): string` for deterministic time/expiry behavior. |
| `ActivityStore` | Durable port implemented by the SQLite adapter. |

`ActivityPresenceRuntime` methods:

```ts
heartbeat(input: ActivityPresenceHeartbeat): Promise<PresenceLease>
leave(sessionId: string): Promise<{ removed: boolean }>
list(filter?: ActivityPresenceFilter): Promise<PresenceLease[]>
removeExpired(limit?: number): Promise<number>
```

## Store family

`ActivityStore` owns persistence operations, not source publication policy:

- `publish(transaction, publishedAt)` atomically replays or inserts one ledger
  transaction;
- `getTransaction(transactionId)` retrieves one stored transaction;
- `listTransactions(filter)` returns a cursor page;
- `upsertPresence`, `removePresence`, and `listPresence` maintain/read
  current leases; and
- `removeExpiredPresence` deletes a bounded expired batch.

`SQLiteActivityStore` is the adapter and adds `close()` for process/test
lifecycle. It is not on the `ActivityStore` interface because another adapter
need not own a SQLite connection.

## Error family and HTTP mapping

| Error | Meaning | Current query endpoint mapping |
| --- | --- | --- |
| `ActivityValidationError` | Invalid trusted input, clock value, TTL, metadata/state, or query shape. | 400 `validation_error` |
| `InvalidActivityCursorError` | Malformed, wrong-kind, or invalid-sequence transaction cursor. | 400 `validation_error` |
| `ActivityTransactionConflictError` | A source idempotency key was replayed with different canonical content. | No public publish endpoint currently maps this. |

Unexpected query errors are logged without exposing internal details and return
a 500 `internal_error` response. The registered command endpoint returns 501
`presence_transport_unsupported` until a trusted session-aware transport
exists.

Runtime logs cover creation, publication/replay/failure, transaction/list
queries, Presence heartbeat/list/leave/cleanup, and endpoint rejection. They
record IDs, kinds, operations, counts, outcomes, and timing, but never metadata
or Presence state payloads.

## Persistence representation

`ActivityTableNames` contains a project-hashed `meta`, `transactions`, and
`presence` table name. The transactions table holds transaction fields plus an
internal digest; the meta singleton holds the next sequence. Presence stores
only current lease rows. Details and indexes are in [Runtime](runtime.md).
