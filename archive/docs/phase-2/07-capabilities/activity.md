# Activity

*Verified against source at commit ef6d462, 2026-08-09.*

Activity is a project-scoped, append-only ledger plus a TTL Presence lease registry. It accepts a
*trusted* transaction from an in-process producer, derives the ledger id
`act_<sha256(idempotencyKey)>`, allocates a monotonic project sequence by compare-and-swap on a
singleton meta row, stores a canonical digest beside the row, and answers descending feed queries.
It has exactly one public HTTP read route and one public HTTP write route that **deliberately
always returns 501**. Three producers publish into it today — Document, Comments and Templates —
each through its own local transaction outbox and its own six-line port, and Activity knows about
none of them.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Layered — `domain/ application/ ports/ persistence/`. No `wire/`, no `projections/` |
| **Endpoints** | **2** — `POST /activity/query`, `POST /activity/command`. The second is a permanent 501 |
| **DB file** | `./data/activity.db`, opened at [`1-init/create/activity.ts:9,16`](../../../apps/backend/src/1-init/create/activity.ts) |
| **Tables** | **3** — `activity_<sha256(projectId)[0:16]>_{meta,transactions,presence}`. **No history table**: Activity and Knowledge are the only two stores in the backend without one |
| **Revision model** | **None of its own.** The ledger is append-only through its API — `ActivityStore` has no update or delete for transactions. `revision` and `changeSetId` are opaque copies of the producer's values that Activity never reads or interprets |
| **Test files (tests)** | [`activity.test.ts`](../../../apps/backend/test/capabilities/activity.test.ts) 198 lines (4), [`activity-wiring.test.ts`](../../../apps/backend/test/capabilities/activity-wiring.test.ts) 127 lines (3) — **7 tests, 7 pass, 0 fail** |
| **Source files / lines** | **8 / 957** for `3-capabilities/activity/`. Add `4-job-wiring/activity/registerActivityEndpoints.ts` (173) and `1-init/create/activity.ts` (18) for everything it owns: **10 / 1,148** |
| **Module `docs/`** | 6 files, 793 lines — accurate about the ledger, silent about Presence being unreachable (§10.9) |
| **Status** | Ledger complete and wired. The Presence **write** path has zero non-test callers and nothing sweeps expired leases; `POST /activity/command` always returns 501 by design |

Per-file sizes, `wc -l`:

| File | Lines | What it holds |
| --- | ---: | --- |
| [`application/activityService.ts`](../../../apps/backend/src/3-capabilities/activity/application/activityService.ts) | 344 | Validation, the id derivation, the Presence runtime, `publish`, `query`, the factory |
| [`persistence/sqliteActivityStore.ts`](../../../apps/backend/src/3-capabilities/activity/persistence/sqliteActivityStore.ts) | 339 | The store, the sequence CAS, cursors, paging |
| [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/activity/persistence/sqliteSchema.ts) | 78 | Table names, pragmas, the DDL |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/activity/domain/model.ts) | 76 | Every type |
| [`domain/canonical.ts`](../../../apps/backend/src/3-capabilities/activity/domain/canonical.ts) | 58 | Metadata canonicalisation and the transaction digest |
| [`ports/activityStore.ts`](../../../apps/backend/src/3-capabilities/activity/ports/activityStore.ts) | 28 | The 7-method store port |
| [`domain/errors.ts`](../../../apps/backend/src/3-capabilities/activity/domain/errors.ts) | 21 | Three error classes |
| [`index.ts`](../../../apps/backend/src/3-capabilities/activity/index.ts) | 13 | The barrel |

---

## 2 · Domain model

### 2.1 `ActivityTransaction` and its three shapes

One shared field set (`domain/model.ts:4-14`):

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `string` | yes |
| `resourceId` | `string` | no |
| `operation` | `string` | yes |
| `revision` | `number` | no |
| `changeSetId` | `string` | no |
| `actorId` | `string` | no |
| `origin` | `ActivityOrigin` | yes |
| `occurredAt` | `string` (ISO) | yes |
| `metadata` | `Readonly<Record<string, unknown>>` | no |

`ActivityOrigin = "user" | "agent" | "automation" | "system"` (`model.ts:2`), commented
*"/** The source of an accepted Activity transaction. */"*. **`user`, not `operator`** — a design
that was never built used the other word, and the archived page still does.

Three shapes are derived from that set, and the difference between them is the whole publish
protocol:

```ts
/** Trusted publication input. Activity owns and returns the ledger ID. */
export interface ActivityTransactionInput extends ActivityTransactionFields {
  idempotencyKey: string;                                  // model.ts:16-19
}

/**
 * One accepted action published by a resource or project-level producer.
 * `id` is derived as `act_<sha256(idempotencyKey)>` and remains stable across
 * source transaction-outbox retries.
 */
export interface ActivityTransaction extends ActivityTransactionFields {
  id: string;                                              // model.ts:21-28
}

/** An Activity transaction after the project ledger accepts it. */
export interface StoredActivityTransaction extends ActivityTransaction {
  sequence: number;                                        // model.ts:30-34
  publishedAt: string;
}
```

**`idempotencyKey` is consumed and discarded.** `publish` destructures it off
(`const { idempotencyKey, ...fields } = transaction;`, `activityService.ts:264`) and it is **not a
column** in the transactions table. It survives only as the pre-image of the id hash. A caller who
loses the key cannot recover it from the ledger; it can only re-derive the id by hashing the key
again.

`occurredAt` is the **producer's** time. `publishedAt` is the **Activity clock's** time at
acceptance. They are separate columns and separate concepts.

### 2.2 The query union

```ts
export type ActivityQuery =
  | { type: "activity.transactions"; filter?: ActivityTransactionFilter }
  | { type: "activity.transaction"; transactionId: string }
  | { type: "presence.list"; filter?: ActivityPresenceFilter };

export type ActivityQueryResult =
  | { type: "activity.transactions"; page: ActivityTransactionPage }
  | { type: "activity.transaction"; transaction?: StoredActivityTransaction }
  | { type: "presence.list"; leases: PresenceLease[] };
```

`model.ts:68-76`. Three query types, three result types, discriminated on the same literal.

`ActivityTransactionFilter = { kind?, resourceId?, cursor?, limit? }` (`model.ts:36-41`);
`ActivityTransactionPage = { items: StoredActivityTransaction[]; nextCursor?: string }`
(`:43-46`); `ActivityPresenceFilter = { kind?, resourceId? }` (`:63-66`).

### 2.3 Presence types

```ts
/** Trusted Presence update after transport has supplied a session identity. */
export interface ActivityPresenceHeartbeat {
  sessionId: string;
  actorId?: string;
  kind?: string;
  resourceId?: string;
  state: Readonly<Record<string, unknown>>;   // required
}

/** Current Presence state. It is not an immutable Activity transaction. */
export interface PresenceLease extends ActivityPresenceHeartbeat {
  updatedAt: string;
  expiresAt: string;
}
```

`model.ts:48-61`, comments verbatim. Both comments are load-bearing: the first names the
precondition the HTTP transport cannot meet (§9.1); the second says the lease is **not** ledger
data, which is why expiry can simply delete it.

### 2.4 Errors — three

| Class | Declared | Message |
| --- | --- | --- |
| `ActivityValidationError` | `domain/errors.ts:1-6` | as passed |
| `ActivityTransactionConflictError` | `domain/errors.ts:8-14` | `Activity transaction '<id>' was published with different content` |
| `InvalidActivityCursorError` | `domain/errors.ts:16-21` | `Activity cursor is invalid` |

`ActivityTransactionConflictError` carries the doc comment
*"/** A publisher reused a source idempotency key with different content. */"* — it names the
failure mode exactly, and §10.2 describes what actually happens when it fires.

---

## 3 · The digest, the id, and the sequence

### 3.1 The id

```ts
const activityTransactionId = (idempotencyKey: string): string =>
  `act_${createHash("sha256").update(idempotencyKey).digest("hex")}`;
```

`activityService.ts:104-107`. Ids are always `act_` plus 64 lowercase hex characters. A caller
**cannot** choose one: `assertTransaction` rejects any input carrying an `id` at all
(`:82-84`, *"Activity transaction ID is allocated by Activity"*).

### 3.2 The canonical digest

`domain/canonical.ts:40-43`, comment verbatim:

> ```
> /**
>  * Activity owns this digest. A source's own semantic digest may describe its
>  * snapshot rather than the complete transaction being published.
>  */
> ```

`digestActivityTransaction` (`canonical.ts:44-57`) is `sha256(JSON.stringify(normalized))` where
`normalized` is built in a **fixed literal key order** — `id, kind, resourceId, operation, revision,
changeSetId, actorId, origin, occurredAt, metadata` — with `null` substituted for every absent
optional and `metadata` replaced by `canonicalizeMetadata(...)`.

`canonicalizeMetadata` (`canonical.ts:12-38`) recurses:

- `null` / boolean / number / string pass through, but a **non-finite number throws**
  (*"Activity metadata cannot contain a non-finite number"*, `:19-21`);
- arrays map element-wise, order preserved;
- objects sort their keys with `Object.keys(o).sort()` and **drop keys whose value is `undefined`**
  (`:28-29`);
- anything else — a function, a symbol, a `bigint` — throws *"Activity metadata must be
  JSON-compatible"* (`:33`).

The practical consequence is asserted directly by `activity.test.ts`: publishing
`{alpha: 1, beta: ["x"]}` and then `{beta: ["x"], alpha: 1}` under the same key is an **equal
replay**, not a conflict. "Different content" means *semantically* different, not textually
different.

Why Activity computes its own digest rather than trusting the producer's: a Document outbox row
carries a `semantic_digest` of the Document *snapshot*, and the schema comment beside it says so —
*"-- This is the Document source digest, never an Activity ledger digest."*
(`document/persistence/sqliteSchema.ts:205`). Two different objects, two different
digests, and Activity needs one over the transaction it is actually storing.

### 3.3 The monotonic project sequence

```sql
CREATE TABLE IF NOT EXISTS <prefix>_meta (
  singleton_key TEXT PRIMARY KEY CHECK (singleton_key = 'activity'),
  next_sequence INTEGER NOT NULL CHECK (next_sequence >= 1)
);

INSERT INTO <prefix>_meta (singleton_key, next_sequence)
  VALUES ('activity', 1)
  ON CONFLICT(singleton_key) DO NOTHING;
```

`persistence/sqliteSchema.ts:32-39`. The `CHECK (singleton_key = 'activity')` **on the primary key**
makes a second meta row unrepresentable — the table can only ever hold one row.

Allocation happens inside the same `db.transaction` as the insert
(`sqliteActivityStore.ts:156-168`):

```ts
const sequenceRow = ... SELECT next_sequence ... WHERE singleton_key = 'activity';
if (!sequenceRow) throw new Error("Activity sequence is not initialized");
const sequence = Number(sequenceRow.next_sequence);
const advanced = ... UPDATE <meta> SET next_sequence = next_sequence + 1
                     WHERE singleton_key = 'activity' AND next_sequence = ?  ... .run(sequence);
if (advanced.changes !== 1) throw new Error("Activity sequence allocation failed");
```

That is a compare-and-swap on the meta row nested inside the transaction that also inserts the
transaction row. The transactions table then declares
`sequence INTEGER NOT NULL UNIQUE CHECK (sequence >= 1)` (`sqliteSchema.ts:43`), so the database is
the final arbiter. **A replay never reaches this code, so replays consume no sequence numbers** —
the ledger has no gaps from retries.

### 3.4 The re-publish conflict rule

`SQLiteActivityStore.publish` (`sqliteActivityStore.ts:138-201`), all inside one `db.transaction`:

1. `SELECT * FROM <transactions> WHERE id = ?` (`:146-148`).
2. A row exists and `existing.transaction_digest !== digest` →
   **`throw new ActivityTransactionConflictError(transaction.id)`** (`:150-151`).
3. A row exists and the digests match → return `rowToTransaction(existing)`, the **stored** row
   unchanged (`:153`).
4. Otherwise allocate the sequence and insert (`:156-192`), returning
   `{...transaction, metadata, sequence, publishedAt}` (`:194-199`).

So the rule is: **same key + same content ⇒ the original row; same key + different content ⇒
throw.** Because the digest covers the derived `id` and the canonicalised metadata, key-order and
`undefined`-field differences are not "different content".

The service layer adds a **pre-read** (`activityService.ts:266`) purely to set the `replayed` flag
on the `activity.transaction.accepted` log line. `existing?.id ?? generatedId` (`:268`) can never
differ from `generatedId`, because `existing` was fetched *by* `generatedId`. One extra SELECT per
publish, no behavioural effect (§10.5).

---

## 4 · Operations

### 4.1 `ActivityCapability` — three members

`activityService.ts:47-51`:

```ts
publish(transaction: ActivityTransactionInput): Promise<StoredActivityTransaction>;
query(query: ActivityQuery): Promise<ActivityQueryResult>;
presence: ActivityPresenceRuntime;
```

`ActivityPresenceRuntime` (`:40-45`) is four methods: `heartbeat(input)`, `leave(sessionId)`,
`list(filter?)`, `removeExpired(limit?)`.

The factory (`:127-132`):

```ts
createActivityCapability(
  store: ActivityStore,
  dependencies: ActivityDependencies,   // { logger: Logger }
  options: ActivityOptions = {},        // { presenceTtlMs?: number }
  clock: ActivityClock = systemClock    // { now(): string }
): ActivityCapability
```

`systemClock.now()` is `new Date().toISOString()` (`:53-55`). **Production passes neither options
nor a clock** (`1-init/create/activity.ts:17`), so the TTL is the 30-second default and the clock is
the system clock. Both seams exist for tests, and `activity.test.ts` uses both.

### 4.2 `ActivityStore` — the port

`ports/activityStore.ts:12-28`, seven methods with the doc comment
*"/** Durable project-local storage owned by Activity. */"*:

```ts
publish(transaction, publishedAt): Promise<StoredActivityTransaction>
getTransaction(transactionId): Promise<StoredActivityTransaction | undefined>
listTransactions(filter?): Promise<ActivityTransactionPage>

upsertPresence(heartbeat, updatedAt, expiresAt): Promise<PresenceLease>
removePresence(sessionId): Promise<boolean>
listPresence(filter, now): Promise<PresenceLease[]>
removeExpiredPresence(now, limit?): Promise<number>
```

**There is no `updateTransaction` and no `deleteTransaction`.** Append-only is a property of the
port, not a convention someone has to remember. `SQLiteActivityStore.close()`
(`sqliteActivityStore.ts:134-136`) is not on the port and has no production caller.

### 4.3 Validation on `publish`

`assertTransaction` (`activityService.ts:81-102`), in order:

| Rule | Line | Message |
| --- | ---: | --- |
| the caller may not supply `id` | 82-84 | `Activity transaction ID is allocated by Activity` |
| `idempotencyKey`, `kind`, `operation` non-empty and ≤ `MAX_STRING_LENGTH` (4,096) | 85, 86, 88 | `<label> must be a non-empty bounded string` |
| `resourceId`, `changeSetId`, `actorId` — same bound, optional | 87, 89, 90 | same |
| `origin` ∈ the four-value set | 91-93 | `Activity transaction origin is invalid` |
| `revision`, if present, is a non-negative safe integer | 94-99 | `Activity transaction revision must be a non-negative safe integer` |
| `occurredAt` parses via `Date.parse` | 100 | `<label> must be an ISO timestamp` |
| `metadata` is JSON-compatible, via `canonicalizeMetadata` | 101 | `<label> must be JSON-compatible: <inner>` |

Every one throws `ActivityValidationError`. `assertText` also rejects `""`, so an empty string is
not a valid optional value — it is a validation error.

Two further checks run outside `publish`: the clock is validated on **every** read
(`:137-141`, *"Activity clock value must be an ISO timestamp"*), and `presenceTtlMs` is validated at
construction (`:117-121`, `:134`, *"Presence TTL must be a positive safe integer"*).

Heartbeat validation (`assertHeartbeat`, `:109-115`) is `sessionId` required-bounded,
`actorId`/`kind`/`resourceId` optional-bounded, `state` JSON-compatible.

### 4.4 Presence, as implemented

- `DEFAULT_PRESENCE_TTL_MS = 30_000` (`activityService.ts:19`), never overridden in production.
- `heartbeat` computes `expiresAt = new Date(Date.parse(updatedAt) + presenceTtlMs).toISOString()`
  (`:177`) and upserts.
- The upsert (`sqliteActivityStore.ts:258-279`) is
  `INSERT … ON CONFLICT(session_id) DO UPDATE SET actor_id, kind, resource_id, state_json,
  updated_at, expires_at` — **one row per session, never history**. `state` is canonicalised before
  storage (`:257`), through the same function the ledger digest uses.
- `leave(sessionId)` deletes and returns `changes > 0` (`:288-292`).
- `list(filter)` selects `WHERE expires_at > ?` against the **current clock string**, plus optional
  `kind`/`resourceId`, `ORDER BY updated_at DESC, session_id ASC` (`:294-316`). **Expiry is
  effective on read, before any cleanup runs.** The comparison is a lexicographic string
  comparison on ISO timestamps — correct only because every timestamp is same-format UTC
  `toISOString()` output.
- `removeExpired(limit)` is a bounded delete: `DELETE … WHERE rowid IN (SELECT rowid … WHERE
  expires_at <= ? ORDER BY expires_at ASC, session_id ASC LIMIT ?)` (`:318-338`), with
  `DEFAULT_PRESENCE_CLEANUP_LIMIT = 100` and `MAX_PRESENCE_CLEANUP_LIMIT = 1_000` (`:30-31`).

**Presence never writes a ledger transaction.** There is no ledger call anywhere in the `presence`
object (`activityService.ts:171-253`), and `activity.test.ts` asserts the transactions page is empty
after a full heartbeat/expire/cleanup cycle — *"Presence leases expire without becoming Activity
transactions"*.

---

## 5 · Endpoints

`registerActivityEndpoints(registry, activity, logger)` —
[`registerActivityEndpoints.ts`](../../../apps/backend/src/4-job-wiring/activity/registerActivityEndpoints.ts).
Two `registry.register` call sites, both `concurrent` and `inline`.

| Method + path | Job `name` | Queue | Response mode | Line | Does |
| --- | --- | --- | --- | ---: | --- |
| `POST /activity/query` | `activity.query.v1` | concurrent | inline | 123 | decodes the body into an `ActivityQuery`, calls `activity.query(...)`, returns 200 |
| `POST /activity/command` | `activity.command.v1` | concurrent | inline | 149 | **always** returns 501 `presence_transport_unsupported`. The body is never parsed |

Registration logs `activity.endpoints.registered { count: 2, endpoints: ["POST /activity/query",
"POST /activity/command"] }` (`:169-172`). **There is no publish route.** No HTTP path can append to
the ledger, by construction, not by check.

`POST /activity/command` is `concurrent` rather than `serial` — correct, because it never reaches a
mutation.

### 5.1 The query decoder

`decodeActivityQuery` (`:72-98`) requires an object body with a string `type`
(*"Activity query must have a type"*), accepts exactly `activity.transactions`,
`activity.transaction` and `presence.list`, and otherwise throws
`` `Unsupported Activity query '<type>'` ``. Filter fields must be strings if present; `limit` must
be a positive safe integer if present (`:45-50`).

**Unknown keys are silently ignored.** The decoder *picks* known fields (`:52-57`, `:66-69`); there
is no exact-keys check. Persona's `wire/` layer does reject unknown keys; Activity's decoder does
not. The asymmetry is real and the module's own docs acknowledge it.

### 5.2 Error mapping

`errorResponse` (`:100-108`):

| Error | Status | Body `error` |
| --- | ---: | --- |
| `ActivityValidationError` | 400 | `validation_error` |
| `InvalidActivityCursorError` | 400 | `validation_error` |
| anything else | 500 | `internal_error`, message `"Activity query failed"` |

`ActivityTransactionConflictError` is **not** in this ladder — it would map to 500. It is
unreachable from HTTP because there is no publish route, but it is very much reachable in-process
(§10.2).

A `≥ 500` logs `activity.query.failed` at **error**; a `< 500` logs `activity.query.rejected` at
**warn** (`:136-143`). Both carry `{requestId, statusCode, errorName}` and nothing else — no body,
no filter values.

### 5.3 Log events

| Level | Events |
| --- | --- |
| info | `activity.runtime.created`, `activity.transaction.accepted`, `activity.presence.left`, `activity.presence.expired.removed`, `activity.endpoints.registered` |
| debug | `activity.transactions.listed`, `activity.transaction.read`, `activity.query.completed`, `activity.presence.heartbeat`, `activity.presence.listed` |
| warn | `activity.transaction.publish.failed`, `activity.transactions.list.failed`, `activity.query.failed` (service level), `activity.presence.{heartbeat,leave,list,expired.remove}.failed`, `activity.query.rejected` (endpoint), `activity.presence.command.unsupported` |
| error | `activity.query.failed` (endpoint level, `≥ 500` only) |

No transaction metadata, no Presence `state`, and no query body is ever logged. The archived
platform page's claim that *"Activity and Comments are the reference implementations"* for logging
was checked and holds: `activityService.ts` emits a `.created` line, a paired success/failure event
for every operation, and a `durationMs` on all of them.

---

## 6 · Persistence

`SQLiteActivityStore` —
[`sqliteActivityStore.ts`](../../../apps/backend/src/3-capabilities/activity/persistence/sqliteActivityStore.ts).
Table names come from `createActivityTableNames(projectId)` (`sqliteSchema.ts:10-20`):

```ts
const projectPrefix = (projectId) => sha256(projectId).hex.slice(0, 16);
const root = `activity_${projectPrefix(projectId)}`;
{ meta: `${root}_meta`, transactions: `${root}_transactions`, presence: `${root}_presence` }
```

**No user id participates in the partition** — Activity is project-scoped and nothing else.

Pragmas at schema init (`sqliteSchema.ts:26-29`): `journal_mode = WAL`, `foreign_keys = ON`,
`busy_timeout = 5000`, `synchronous = NORMAL`. All four, which puts Activity in the seven-store
majority; six of the backend's thirteen WAL sites set fewer.

### 6.1 `<prefix>_meta`

| Column | Type | Constraint |
| --- | --- | --- |
| `singleton_key` | TEXT | PRIMARY KEY, `CHECK (singleton_key = 'activity')` |
| `next_sequence` | INTEGER | NOT NULL, `CHECK (next_sequence >= 1)`, seeded to 1 |

### 6.2 `<prefix>_transactions` (`sqliteSchema.ts:41-56`)

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY — `act_<64 hex>` |
| `sequence` | INTEGER | NOT NULL **UNIQUE** `CHECK (sequence >= 1)` |
| `kind` | TEXT | NOT NULL |
| `resource_id` | TEXT | nullable |
| `operation` | TEXT | NOT NULL |
| `revision` | INTEGER | `CHECK (revision IS NULL OR revision >= 0)` |
| `change_set_id` | TEXT | nullable |
| `actor_id` | TEXT | nullable |
| `origin` | TEXT | NOT NULL `CHECK (origin IN ('user','agent','automation','system'))` |
| `occurred_at` | TEXT | NOT NULL — the producer's time |
| `metadata_json` | **BLOB** | NOT NULL — UTF-8 JSON of the canonicalised metadata |
| `transaction_digest` | TEXT | NOT NULL — the Activity digest (§3.2) |
| `published_at` | TEXT | NOT NULL — the Activity clock at acceptance |

Indexes: `<prefix>_transactions_feed` on `(sequence DESC, id)`;
`<prefix>_transactions_kind_resource` on `(kind, resource_id, sequence DESC, id)`.

**There is no `idempotency_key` column**, and no history table. Two of the application-layer rules
— the origin vocabulary and the non-negative revision — are duplicated as SQL CHECKs, so a bug in
`assertTransaction` would still be caught at the database.

### 6.3 `<prefix>_presence` (`sqliteSchema.ts:63-76`)

| Column | Type | Constraint |
| --- | --- | --- |
| `session_id` | TEXT | PRIMARY KEY |
| `actor_id` | TEXT | nullable |
| `kind` | TEXT | nullable |
| `resource_id` | TEXT | nullable |
| `state_json` | **BLOB** | NOT NULL |
| `updated_at` | TEXT | NOT NULL |
| `expires_at` | TEXT | NOT NULL |

Indexes: `<prefix>_presence_expiry` on `(expires_at, session_id)`;
`<prefix>_presence_kind_resource` on `(kind, resource_id, expires_at, session_id)`. **In
production this table is never written** (§10.1).

### 6.4 Paging and the cursor

- `DEFAULT_PAGE_SIZE = 50`, `MAX_PAGE_SIZE = 200` (`sqliteActivityStore.ts:28-29`).
- `boundedLimit` (`:52-62`) throws a **plain `Error`** — *"Activity store limit must be a positive
  safe integer"*, which the endpoint ladder maps to **500**, not 400 — for a bad limit, and
  silently `Math.min`s anything above the maximum (§10.6). The endpoint decoder catches the
  *invalid* case first with an `ActivityValidationError`, so the plain `Error` is reachable only
  from an in-process caller.
- The query is `ORDER BY sequence DESC, id ASC LIMIT ?`, fetching `limit + 1` rows to detect
  `hasMore` (`:232-241`). **The `id ASC` tiebreaker is unreachable** because `sequence` is UNIQUE
  (§10.7).
- The cursor is `base64url(JSON.stringify({kind: "activity-transactions", sequence}))` (`:64-65`).
  Decoding validates the `kind` literal and a safe integer `sequence >= 1`, else
  `InvalidActivityCursorError` (`:67-83`).
- Continuation is `sequence < ?` — strictly older (`:226-229`).

### 6.5 No revision model, and no retention

Activity has **no revision model of its own**. `revision` and `changeSetId` are opaque copies of the
producer's values; Activity never reads, validates or interprets them beyond the non-negative
integer check.

**Activity is absent from the retention scheduler.** `startBackend.ts:126-144` binds eleven ports —
document, persona, templates, templates-orphans, investigation, derived-outputs, comments,
connector, general-files, structured-data, context — and Activity is not one of them. Nothing
prunes, purges, compacts or vacuums `activity.db`. It grows for the life of the project (§10.4).

---

## 7 · Invariants

| Invariant | Enforced at |
| --- | --- |
| A caller cannot choose the ledger id | `activityService.ts:82-84` |
| The id is `act_<sha256(idempotencyKey)>` | `activityService.ts:104-107` |
| `origin` is one of exactly four values | `activityService.ts:91-93` **and** `sqliteSchema.ts:50-51` (SQL CHECK) |
| `revision` is a non-negative safe integer | `activityService.ts:94-99` **and** `sqliteSchema.ts:47` (SQL CHECK) |
| Metadata is JSON-only, key-sorted, `undefined`-free, and finite | `canonical.ts:19-22, 28-29, 33` |
| The sequence is unique and ≥ 1 | `sqliteSchema.ts:43` (UNIQUE + CHECK) |
| The sequence is allocated exactly once per accepted transaction, inside the insert transaction | `sqliteActivityStore.ts:145-168` |
| A replay of an equal transaction returns the stored row and allocates nothing | `sqliteActivityStore.ts:149-154` |
| The same key with different content throws `ActivityTransactionConflictError` | `sqliteActivityStore.ts:150-151` |
| Only one meta row can exist | `sqliteSchema.ts:33` |
| One Presence lease per session | `sqliteSchema.ts:64` (PK) + `sqliteActivityStore.ts:263` (`ON CONFLICT DO UPDATE`) |
| An expired lease is invisible to reads before any cleanup runs | `sqliteActivityStore.ts:298` |
| Presence never appends to the ledger | structural — no ledger call in `activityService.ts:171-253` |
| No public HTTP path can append to the ledger | structural — `registerActivityEndpoints.ts` registers no publish route |
| No HTTP path can reach the Presence write runtime | `registerActivityEndpoints.ts:149-167`, asserted by `activity-wiring.test.ts` |
| Project isolation is by table-name prefix, fixed at construction | `sqliteSchema.ts:10-20`, `sqliteActivityStore.ts:127-132` |
| The ledger has no update or delete path | structural — `ports/activityStore.ts` declares neither |

---

## 8 · Producers

There are **exactly three**, all adapted in `1-init/create/*.ts`. Activity has no knowledge of any
of them; each capability declares its own narrow one-method port and never imports the Activity
runtime. The complete list of `activity.publish(` call sites outside the Activity module is three
lines: `1-init/create/document.ts:50`, `1-init/create/comments.ts:38`,
`1-init/create/templates.ts:59`.

| Producer | Outbox table | `idempotencyKey` (= `sourceTransactionId`) | `kind` | `operation` values | Delivery |
| --- | --- | --- | --- | --- | --- |
| **Document** | `doc_<hex>_transaction_outbox` | `` `document:${documentId}:${sourceRequestId}:${kind}` `` (`documentService.ts:2115-2116`) | `document` | `created`, `changed`, `compensated`, `deleted` | inline post-commit (`documentService.ts:885, 946, 1163`) **and** a startup drain (`:801-808`) |
| **Comments** | `cmt_<hex>_transaction_outbox` | a fresh `randomUUID()` (`commentService.ts:370`) | `comment` | `created`, `updated`, `resolved`, `reopened`, `deleted` | inline post-commit (`commentService.ts:250, 390`) **and** a startup drain (`:194-216`) |
| **Templates** | `tpl_<hex>_transaction_outbox` | `` `${requestId}:${kind.slice("template.".length)}` `` (`templateService.ts:631`) | `template` | `registered`, `updated`, `deleted` | **startup drain only** (`templateService.ts:232-256`), and it `break`s on the first failure (§10.3) |
| *Slides* | `slides_<hex>_transaction_outbox` — the table and four store-port methods exist | — | — | — | **not wired at all**; see [slides.md](slides.md) |

Origin mapping: Document's own vocabulary is `interactive | agent | automation`, and the adapter
remaps `interactive → "user"` (`1-init/create/document.ts:24-25`). Comments and Templates already
use Activity's four-value vocabulary and pass through unchanged. Comments fixes attribution at
composition time: `{actorId: config.userId, origin: "user"}` (`1-init/create/comments.ts:50`).

Metadata each producer attaches:

| Producer | `metadata` |
| --- | --- |
| Document | `{operationTypes, sourceSemanticDigest, compensation?}` (`create/document.ts:39-43`) |
| Comments | `{target: {resourceKind, resourceId}, state, mentionCount}` (`create/comments.ts:24-31`) |
| Templates | `{resourceKind, resourceId}` (`create/templates.ts:49-52`) |

Every outbox carries a partial index `…_unpublished` on
`(occurred_at, source_transaction_id) WHERE published_at IS NULL`, so a drain scans only what is
pending.

The startup drains run at `1-init/startBackend.ts:190-195`, each logging a `*.activity.recovered`
count.

---

## 9 · Design decisions worth preserving

### 9.1 The 501 is a recorded security decision, not a TODO

This is the most important comment in the capability. The docblock on `registerActivityEndpoints`,
[`registerActivityEndpoints.ts:110-117`](../../../apps/backend/src/4-job-wiring/activity/registerActivityEndpoints.ts),
quoted in full and verbatim:

> ```
> /**
>  * Registers the public read surface for Activity.
>  *
>  * Presence writes are deliberately rejected for now: the HTTP transport only
>  * provides per-request IDs and untrusted headers/body, not a stable
>  * authenticated session identity. Realtime/auth transport can replace this
>  * handler once it can supply a trusted session and actor.
>  */
> ```

The handler itself, `registerActivityEndpoints.ts:149-167`, verbatim:

```ts
  registry.register({ method: "POST", path: "/activity/command" }, (request) => ({
    name: "activity.command.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      logger.warn("activity.presence.command.unsupported", {
        requestId: request.requestId,
        reason: "trusted_session_context_unavailable"
      });
      return {
        statusCode: 501,
        body: {
          error: "presence_transport_unsupported",
          message:
            "Presence commands require a trusted session-aware transport; HTTP does not provide one yet."
        }
      };
    }
  }));
```

Four things to preserve about it:

- **The body is never parsed.** The handler does not touch `request.body` at all, so no
  caller-supplied `sessionId` or `actorId` can reach any code path. That is the point: a
  `sessionId` from an untrusted body would let any client impersonate any session.
- It logs `activity.presence.command.unsupported` at **warn** with
  `reason: "trusted_session_context_unavailable"` — the refusal is observable, and the reason is a
  machine-readable literal, not prose.
- `activity-wiring.test.ts` asserts the 501, the exact JSON body, **and** that the double's
  heartbeat counter is still `0` — the test name is *"Activity Presence commands reject
  caller-supplied identities until trusted transport exists"*. The route provably does not touch
  the Presence runtime.
- The exit condition is stated: a realtime/auth transport that can supply a trusted session and
  actor replaces this handler. Nothing has to be redesigned; one handler has to be rewritten.

This is a 501 that means "the transport cannot meet the precondition", not "unimplemented".

### 9.2 Activity owns the digest

`canonical.ts:40-43`, quoted in §3.2. A producer's own digest describes the producer's snapshot; the
ledger needs one over the whole transaction it is storing. Trusting the source digest would have
made a Document snapshot digest into the ledger's conflict key, which would have made two
semantically different Activity transactions look identical whenever the underlying snapshot did
not change.

### 9.3 The id is derived, not stored

`model.ts:21-25`, quoted in §2.1: *"`id` is derived as `act_<sha256(idempotencyKey)>` and remains
stable across source transaction-outbox retries."* Because the id is a pure function of the
producer's key, a producer that retries after a crash — with no record of what it sent — lands on
the same row. There is no allocation table, no reservation, and no key column to keep in sync.

### 9.4 A lease is not a transaction

`model.ts:57`: *"/** Current Presence state. It is not an immutable Activity transaction. */"* One
sentence, and it justifies everything about the presence table: one row per session, an in-place
upsert, deletion on expiry, no sequence, no digest, no history. Presence data is allowed to
disappear; ledger data is not.

### 9.5 Activity is constructed first, and depends on nothing

`1-init/startBackend.ts:52-53`, verbatim:

> ```
> // Activity has no resource dependency and is created before resource
> // integrations eventually publish their accepted transactions into it.
> ```

and `1-init/create/activity.ts:11`:

> `/** Constructs the one project-scoped Activity runtime before resource integration. */`

Activity is the first capability constructed (`startBackend.ts:54`). Its only dependency is its
store.

### 9.6 The producer keeps the retry, not the ledger

Document's port docblock, `document/ports/activityPublisher.ts:3-8`, verbatim:

> ```
> /**
>  * Narrow integration port for delivering Document's already-committed outbox
>  * records. The Document capability owns retries and publication marking; an
>  * adapter outside Document maps the source record into Activity's transaction
>  * model and performs the trusted Activity call.
>  */
> ```

Comments' and Templates' equivalents are one line each and say the same thing:
*"/** Narrow source-side Activity port; Comments never imports the Activity runtime. */"* and
*"/** Narrow source-side Activity port; Templates never imports the Activity runtime. */"*.

Document's delivery helper adds the reason it never fails a command,
`documentService.ts:2120-2124`, verbatim:

> ```
> /**
>  * Source state is already committed when this runs. Delivery failures stay in
>  * the local outbox for `publishPendingActivity()` rather than changing the
>  * accepted Document command result.
>  */
> ```

Templates' `publishPendingActivity` carries the same reasoning inline
(`templateService.ts:244-245`): *"Source state is already committed. Delivery failures stay in the
outbox for the next drain rather than changing an accepted result."*

### 9.7 A derived source-transaction id beats a generated one

`templateService.ts:616-621`, verbatim:

> ```
> /**
>  * The source transaction ID is derived from the request rather than freshly
>  * generated, so it is stable across retries. Paired with the outbox's
>  * INSERT OR IGNORE, a request yields at most one source transaction per kind
>  * even if the command is re-run.
>  */
> ```

Document does the same. **Comments does not** — its `sourceTransactionId` is a fresh `randomUUID()`,
and stability across command retries comes from its command-receipt table replaying the whole
result instead. Two valid designs; worth knowing which one a given outbox uses before reasoning
about its retries.

---

## 10 · Known gaps and defects

Collected, with everything else in the backend, in [11-known-issues.md](../11-known-issues.md).

### 10.1 The Presence write path is unreachable in production

`presence.heartbeat`, `presence.leave` and `presence.removeExpired` have **zero non-test callers**.
Verified directly: `grep -rn "presence\." src` outside the Activity module returns only
`registerActivityEndpoints.ts`'s three hits — two `"presence.list"` query-type literals and one log
message string. Every real call site is in `test/capabilities/activity.test.ts`. The only HTTP door
to the write runtime returns 501.

**One nuance the summaries get wrong**: the Presence *read* path **is** reachable.
`POST /activity/query` with `{type: "presence.list"}` decodes (`registerActivityEndpoints.ts:91-93`)
and reaches `presence.list` through `activityService.ts:323-331`. It is a live, unauthenticated
endpoint that always returns `{type: "presence.list", leases: []}`, because nothing ever writes a
lease.

Consequence: `<prefix>_presence` is never written in production, so its never-scheduled cleanup is
moot **today**. If a trusted transport is added, the sweep must be scheduled at the same time —
see §10.2 below.

### 10.2 Nothing sweeps expired leases

`removeExpiredPresence` is implemented, bounded, indexed and correct. **Nothing calls it.**
`startBackend.ts` arms no Presence timer, and Activity is not one of the eleven retention ports
(§6.5). Expired leases are invisible to `list` because of the `expires_at > ?` predicate, so they
would not be *returned* — they would simply accumulate as rows forever. The mechanism exists; the
schedule does not.

### 10.3 The poison-pill retry-forever failure mode

`ActivityTransactionConflictError` has no HTTP mapping and would be a 500. It is unreachable from
HTTP, and it is a live in-process failure mode:

If a producer ever reuses a `sourceTransactionId` with **different** content, `store.publish`
throws on every attempt. The producer catches, logs a warn, and leaves the row unpublished for the
next drain. The row can never be marked published, and **there is no dead-letter path, no attempt
counter, and no operator lever**. It is retried forever.

Templates makes this strictly worse in two ways:

- **Templates never publishes outside startup.** `templates.publishPendingActivity()` is called from
  exactly one place, `startBackend.ts:194`. `templateService.ts` has no inline post-commit publish.
  Every template registration, update and deletion made during a run stays invisible in the ledger
  until the next restart. Document and Comments both publish inline.
- **Templates' drain `break`s on the first failure** (`templateService.ts:252`) rather than
  continuing. Document (`documentService.ts:801-808`) and Comments (`commentService.ts:207-210`)
  both continue past a failure. So one bad Templates row blocks every later Templates row in the
  same drain — and, given the previous point, permanently.

The module's own `docs/concepts.md:111-113` and `docs/invariants.md:98-102` describe Templates as
publishing post-commit and retrying through recovery. **That is false**; see §10.9.

### 10.4 No ledger retention or compaction, anywhere

`activity.db` grows without bound. There is no pruning, no archival, no partitioning and no
`VACUUM`. The retention scheduler governs deleted *resources* in other capabilities and is not
wired to Activity at all. This is a deliberate consequence of "append-only", not an oversight, but
it is unbounded growth with no operator control and nothing documents an intended ceiling.

### 10.5 A redundant read on every publish

`activityService.ts:266` reads the row purely to set the `replayed:` field on one log line, and
`existing?.id ?? generatedId` at `:268` can never differ from `generatedId`. One extra SELECT per
publish. Harmless, and worth removing rather than explaining.

### 10.6 A valid limit above 200 is silently clamped

`boundedLimit` (`sqliteActivityStore.ts:52-62`) throws for an *invalid* limit and
`Math.min(value, maximum)`s a **valid** one. `{limit: 500}` returns 200 items with no error, no
warning, and no field in the response saying the limit was reduced — the caller sees a full page
and a `nextCursor` and cannot tell its limit was ignored. The module's `docs/invariants.md:68-69`
says an invalid limit "is rejected rather than silently changed", which is only half the story.

### 10.7 The `id ASC` tiebreaker can never fire

`ORDER BY sequence DESC, id ASC` (`sqliteActivityStore.ts:236`) reads as though ties are possible.
`sequence` is declared `UNIQUE` (`sqliteSchema.ts:43`), so there are none. The module's
`docs/invariants.md:36-37` presents it as a live deterministic tie-breaker.

### 10.8 Other dead and unwired surface

| Symbol | Status |
| --- | --- |
| `SQLiteActivityStore.close()` (`sqliteActivityStore.ts:134-136`) | Not on the `ActivityStore` port, no production caller — it exists for test lifecycle. The running backend never closes the handle |
| `ActivityOptions.presenceTtlMs` | Never set in production; the 30-second default always applies |
| `ActivityClock` | Never injected in production; `systemClock` always applies |
| The `compensation` metadata descriptor | Document's outbox carries `{intent, targetChangeSetId}` into Activity metadata, and the Document type comment calls it *"Immutable compensation information needed by future Activity undo/redo"* (`document/domain/model.ts:487`). **Nothing consumes it.** There is no undo/redo coordinator |
| Slides' outbox | `slides_<hex>_transaction_outbox` and four store-port methods exist; there is no Slides activity-publisher port, no factory, and no mention of Slides in `startBackend.ts` |

### 10.9 Where the module's own `docs/` package is wrong

`3-capabilities/activity/docs/` is 6 files, 793 lines. A later pass owns those files; the
contradictions are recorded here so a reader of both is not misled.

| File | Claim | Reality |
| --- | --- | --- |
| `flows.md:130` | Document's adapter maps to operation `created`, `changed` or `compensated` | **Four.** `DocumentCommittedTransaction["kind"]` also includes `"document.deleted"` (`document/domain/model.ts:468-472`) and `create/document.ts:33` slices the prefix mechanically |
| `concepts.md:111-113`, `invariants.md:98-102` | Templates "publishes post-commit, and retries pending rows through its recovery path" | False for Templates. There is no inline post-commit publish; `publishPendingActivity()` is called only from `startBackend.ts:194` (§10.3) |
| — | Nothing anywhere | No Activity doc records the Templates drain `break` (§10.3) or the poison-pill retry-forever path |
| `invariants.md:36-37` | Pages are ordered by descending sequence "then ID as a deterministic tie-breaker" | The tie-breaker can never fire; `sequence` is UNIQUE (§10.7) |
| `invariants.md:68-69` | "An invalid explicit store limit is rejected rather than silently changed" | Half true: an invalid limit throws, a **valid** limit above 200 is silently clamped (§10.6) |
| `runtime.md:62-78`, `flows.md:90-93`, `invariants.md:80-94` | Presence described as though "a trusted adapter *may* call `presence.heartbeat`" | No such adapter exists, and nothing schedules `removeExpired`. `runtime.md:75-78` correctly says the *route* returns 501, but a reader would still conclude the Presence store is live and swept. It is neither (§10.1, §10.2) |
| `types.md:147` | Notes that `ActivityTransactionConflictError` has no HTTP mapping | Correct, and it never draws the consequence (§10.3) |
| `README.md:67-70` | Links to a design draft under `scratch/` | That is the owner's live draft, deliberately ahead of the code. The README does say runtime code takes precedence, which is the right posture |

---

## 11 · Where to look for what

| Concern | File |
| --- | --- |
| Every type and the query union | [`domain/model.ts`](../../../apps/backend/src/3-capabilities/activity/domain/model.ts) |
| The digest and metadata canonicalisation | [`domain/canonical.ts`](../../../apps/backend/src/3-capabilities/activity/domain/canonical.ts) |
| Validation, the id, Presence, the factory | [`application/activityService.ts`](../../../apps/backend/src/3-capabilities/activity/application/activityService.ts) |
| The store port | [`ports/activityStore.ts`](../../../apps/backend/src/3-capabilities/activity/ports/activityStore.ts) |
| The sequence CAS, cursors, paging | [`persistence/sqliteActivityStore.ts`](../../../apps/backend/src/3-capabilities/activity/persistence/sqliteActivityStore.ts) |
| DDL, pragmas, table names | [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/activity/persistence/sqliteSchema.ts) |
| HTTP, the decoder, the 501 | [`registerActivityEndpoints.ts`](../../../apps/backend/src/4-job-wiring/activity/registerActivityEndpoints.ts) |
| Construction | [`1-init/create/activity.ts`](../../../apps/backend/src/1-init/create/activity.ts) |
| The three producer adapters | [`1-init/create/document.ts:24-52`](../../../apps/backend/src/1-init/create/document.ts), [`1-init/create/comments.ts:14-40`](../../../apps/backend/src/1-init/create/comments.ts), [`1-init/create/templates.ts:39-61`](../../../apps/backend/src/1-init/create/templates.ts) |

Related pages: [document.md](document.md), [comments.md](comments.md) and
[templates.md](templates.md) for the three outboxes,
[04-state-and-persistence.md](../04-state-and-persistence.md) for why Activity is the one wired
store outside the retention sweep, and [08-conventions.md](../08-conventions.md) for the
narrow-port-plus-adapter pattern all three producers use.

The superseded design pages are at
[phase-1/capabilities-old/activity.md](../../phase-1/capabilities-old/activity.md) and
[phase-1/capabilities-old/presence.md](../../phase-1/capabilities-old/presence.md). The first
describes `GET /activity`, `/activity/targets/:kind/:id`, `/activity/actors/:kind/:id`,
`POST /internal/activity/{facts,rebuild}`, tables `activity_facts` and `activity_items`, a
`CommittedActivityFact` type, and an actor vocabulary of `operator | agent | automation | system`.
The second describes Presence as a separate capability with three REST routes. **None of that
exists.** Do not cite either.
