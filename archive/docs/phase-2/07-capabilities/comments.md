# 07 · Comments

*Verified against source at commit ef6d462, 2026-08-09.*

Comments attaches short authored notes to anything else in the project. A comment carries a body,
a server-derived list of `@handle` mentions, a two-state `open`/`resolved` flag, and an **anchor**:
a `{resourceKind, resourceId}` pair plus an optional opaque JSON `subTarget` that the owning
resource — never Comments — is expected to interpret. It verifies nothing about the thing it
points at, has no threading, and depends on no other capability: `grep -rn '#comments' src` finds
exactly two hits, both in Comments' own composition and wiring files. Its one outward edge is an
Activity outbox, drained inline after each commit and again at startup.

The archived design at
[phase-1/capabilities-old/comments.md](../../phase-1/capabilities-old/comments.md) (279 lines)
describes threads, a `threadId` on every comment, a three-value comment state, a three-value thread
state, a `CommentAnchor` carrying `observedTargetRevision` and `selectionHash`, a four-value anchor
state, a `TargetAnchorResolver` registry, an `anchorScanner`, and explicit reattachment commands.
**None of that exists.** Do not read it as a description of this capability.

---

## 1 · At a glance

| Property | Value |
| --- | --- |
| Shape | Layered — `domain/ application/ ports/ persistence/ wire/` |
| Endpoints | **2** — `POST /comments/command` (serial), `POST /comments/query` (concurrent) |
| DB file | `data/comments.db`, opened cwd-relative as `./data/comments.db` |
| Tables | **4** — `_comments`, `_command_receipts`, `_transaction_outbox`, `_history` |
| Revision model | Current row plus the shared history table. `revision` starts at 1; every accepted mutation is an internal read-increment-CAS on `revision - 1`. **No client-facing `expectedRevision`** |
| Idempotency | `request_id` receipts, digest-compared. An exact retry replays the stored result; a divergent reuse is 409 |
| Activity | Source outbox with `source_request_id UNIQUE`; published inline after commit, and drained at startup |
| Test files | `comments.test.ts` (**7 tests**, 398 lines), `comments-wiring.test.ts` (**3 tests**, 159 lines) = **10** |
| Source files / lines | **13 files / 1,588 lines**, plus `4-job-wiring/comments/registerCommentEndpoints.ts` (116) and `1-init/create/comments.ts` (53) |
| Module docs | 6 files, 406 lines, at [`src/3-capabilities/comments/docs/`](../../../apps/backend/src/3-capabilities/comments/docs/) |
| Status | Complete and wired. No known behavioural defect. Two dead exports (§9) |

Per-file line counts:

| File | Lines |
| --- | ---: |
| [`application/commentService.ts`](../../../apps/backend/src/3-capabilities/comments/application/commentService.ts) | 474 |
| [`persistence/sqliteCommentStore.ts`](../../../apps/backend/src/3-capabilities/comments/persistence/sqliteCommentStore.ts) | 398 |
| [`domain/validation.ts`](../../../apps/backend/src/3-capabilities/comments/domain/validation.ts) | 228 |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/comments/domain/model.ts) | 127 |
| [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/comments/persistence/sqliteSchema.ts) | 84 |
| [`wire/common.ts`](../../../apps/backend/src/3-capabilities/comments/wire/common.ts) | 74 |
| [`wire/querySchemas.ts`](../../../apps/backend/src/3-capabilities/comments/wire/querySchemas.ts) | 42 |
| [`ports/commentStore.ts`](../../../apps/backend/src/3-capabilities/comments/ports/commentStore.ts) | 41 |
| [`wire/commandSchemas.ts`](../../../apps/backend/src/3-capabilities/comments/wire/commandSchemas.ts) | 38 |
| [`domain/errors.ts`](../../../apps/backend/src/3-capabilities/comments/domain/errors.ts) | 34 |
| [`index.ts`](../../../apps/backend/src/3-capabilities/comments/index.ts) | 23 |
| [`domain/canonical.ts`](../../../apps/backend/src/3-capabilities/comments/domain/canonical.ts) | 19 |
| [`ports/activityPublisher.ts`](../../../apps/backend/src/3-capabilities/comments/ports/activityPublisher.ts) | 6 |

---

## 2 · Domain model

All from
[`domain/model.ts`](../../../apps/backend/src/3-capabilities/comments/domain/model.ts) unless
noted.

### 2.1 Scalars and unions

| Type | Line | Members |
| --- | ---: | --- |
| `CommentState` | 3 | `open` \| `resolved` |
| `CommentOrigin` | 4 | `user` \| `agent` \| `automation` \| `system` |
| `CommentActivityOperation` | 106 | `created` \| `updated` \| `resolved` \| `reopened` \| `deleted` |
| `JsonPrimitive` | 6 | `null` \| `boolean` \| `number` \| `string` |
| `JsonValue` | 7 | `JsonPrimitive` \| `readonly JsonValue[]` \| `JsonObject` |
| `JsonObject` | 8 | `{ readonly [key: string]: JsonValue }` |
| `IsoTimestamp` | 1 | `string` |

Note that `CommentState` has exactly two values and there is **no deleted state**. Deletion
removes the live row and writes a terminal history record; the mechanism is described in §6.

### 2.2 `CommentTarget` — the anchor

```ts
/** A project resource and an optional resource-owned opaque location hint. */
export interface CommentTarget {
  resourceKind: string;
  resourceId: string;
  subTarget?: JsonObject;
}
```

— `domain/model.ts:12-17`

The anchor is those three fields and nothing else. There is no `observedTargetRevision`, no
`selectionHash`, no anchor state, and no resolver.

### 2.3 `Comment`

```ts
export interface Comment {
  id: string;
  body: string;
  mentions: string[];
  target: CommentTarget;
  state: CommentState;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}
```

— `domain/model.ts:19-30`

`mentions` is **derived, never supplied** — it is re-parsed from the body on every create and
update (`commentService.ts:237`, `:263`). `createdBy` and `updatedBy` come from composition, never
from the payload.

### 2.4 `CommentAttribution`

```ts
/** Trusted attribution supplied by composition, never by the public payload. */
export interface CommentAttribution {
  actorId: string;
  origin: CommentOrigin;
}
```

— `domain/model.ts:32-36`

Fixed at `{ actorId: config.userId, origin: "user" }` in `1-init/create/comments.ts:50`. A caller
cannot set either field: no command schema accepts `actorId` or `origin`, and
`comments-wiring.test.ts` test 3 (*"Comments public commands reject caller-controlled
attribution and scalar sub-targets"*) pins that.

### 2.5 `CommentCommittedTransaction` — the outbox record

```ts
/** Self-contained source-outbox record used to publish immutable Activity. */
export interface CommentCommittedTransaction {
  sourceTransactionId: string;
  sourceRequestId: string;
  operation: CommentActivityOperation;
  commentId: string;
  resourceKind: string;
  resourceId: string;
  state: CommentState;
  mentionCount: number;
  actorId: string;
  origin: CommentOrigin;
  occurredAt: IsoTimestamp;
  publishedAt?: IsoTimestamp;
}
```

— `domain/model.ts:113-127`

"Self-contained" is literal: the record carries `mentionCount`, not the handles, and carries no
body and no sub-target. Publishing never reads the comment row again.

### 2.6 `CommentCommandReceipt`

`{ requestId, requestDigest, result, createdAt }` (`:99-104`). The stored `result` is the exact
`CommentCommandResult` that was returned the first time.

---

## 3 · Commands and queries

### 3.1 The command envelope is flat

Unlike [Templates](templates.md), there is no `{requestId, origin, command}` wrapper. `requestId`
is a field of the command itself, and neither `origin` nor `actorId` can be supplied at all.

`CommentCommand` (`domain/model.ts:38-70`) is a six-arm union; `decodeCommentCommand`
(`wire/commandSchemas.ts:5-38`) enforces an exact key set per arm with
`exactKeys`, so an unknown field is a 400 rather than a silently dropped one.

| Command | Exact allowed keys | Result | HTTP |
| --- | --- | --- | ---: |
| `comment.create` | `type, requestId, body, target` (target may carry `subTarget`) | `comment.created` + the Comment | **201** |
| `comment.update` | `type, requestId, commentId, body` | `comment.updated` + the Comment | 200 |
| `comment.resolve` | `type, requestId, commentId` | `comment.resolved` + the Comment | 200 |
| `comment.reopen` | `type, requestId, commentId` | `comment.reopened` + the Comment | 200 |
| `comment.delete` | `type, requestId, commentId` | `comment.deleted` + `{commentId, revision}` | 200 |
| `comment.purge` | `type, requestId, commentId` | `comment.purged` + `{commentId}` | 200 |

An unrecognised `type` is `Unsupported Comment command '<type>'`
(`wire/commandSchemas.ts:36`).

**Note what is absent: there is no command that changes a target.** `comment.update` accepts only
a new `body`; the service rebuilds the comment as `{...current, body, mentions, revision + 1,
updatedBy, updatedAt}` (`commentService.ts:260-267`), so `target` is carried over untouched.

### 3.2 Queries

`CommentQuery` (`:80-88`) is a two-arm union; `decodeCommentQuery`
(`wire/querySchemas.ts:5-38`).

| Query | Exact allowed keys | Result |
| --- | --- | --- |
| `comment.get` | `type, commentId` | `{type: "comment.get", comment}`; 404 if absent or deleted |
| `comment.listByTarget` | `type, target, state, cursor, limit` — `target` may carry `resourceKind` and `resourceId` **only** | `{type: "comment.listByTarget", page: {items, nextCursor?}}` |

`wire/common.ts:66` refuses a sub-target on a query target with the message
`"Comment query target cannot include subTarget"` — a location hint narrows nothing, so accepting
one would imply a filter that does not exist.

### 3.3 `CommentsCapability` — the service surface

```ts
export interface CommentsCapability {
  command(command: CommentCommand): Promise<CommentCommandResult>;
  query(query: CommentQuery): Promise<CommentQueryResult>;
  /** Retries source-outbox rows left unpublished after failure or restart. */
  publishPendingActivity(limit?: number): Promise<number>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}
```

— `application/commentService.ts:47-54`

Factory:
`createCommentsCapability(store, dependencies, options = {}, clock = systemClock, createId = randomUUID)`
(`:468-474`). The `CommentService` class itself is not exported.

`CommentDependencies` is `{ logger, attribution, activityPublisher? }` (`:41-45`). The publisher is
optional; when absent, `publishActivity` logs `comments.activity.publish.skipped` at debug and
returns `false` without failing the command.

### 3.4 `CommentStore` — the port

> `/** Durable project-local storage owned by Comments. */`
> — `ports/commentStore.ts:23`

Eleven methods, **all `Promise`-returning** even though `better-sqlite3` is synchronous:
`getComment`, `listComments`, `getReceipt`, `commitCreation`, `commitMutation`, `recordReceipt`,
`purge`, `listUnpublishedTransactions`, `markTransactionPublished`, `pruneHistory`, `purgeExpired`.

`SQLiteCommentStore.close()` exists (`sqliteCommentStore.ts:211`) but is **not on the port** and
is called only by tests.

### 3.5 Mentions

> `/** Parses standalone ASCII @handles, excluding the @ in an email address. */`
> — `domain/validation.ts:116`

`parseCommentMentions` (`:117-139`) runs
`/(^|[^A-Za-z0-9._%+\-])@([A-Za-z0-9][A-Za-z0-9._-]*)/g` over the body, lowercases each handle,
strips trailing periods, and deduplicates in first-appearance order. The leading character class is
what excludes the `@` inside an email address. The trailing-period rule has its own comment:

```ts
// A terminal period is prose punctuation, while interior periods remain
// part of a handle (for example, @ada.lovelace).
```

— `domain/validation.ts:125-126`

A handle longer than `maxMentionLength` (64) throws `CommentValidationError`; more than
`maxMentions` (64) distinct handles throws. **There is no directory lookup and no notification** —
a mention is a parsed string, not a verified principal.

### 3.6 Limits

`DEFAULT_COMMENT_LIMITS`, `domain/validation.ts:22-30`:

| Key | Default | Applied to |
| --- | ---: | --- |
| `maxBodyBytes` | 16,384 | the trimmed body, measured in UTF-8 bytes |
| `maxIdentifierBytes` | 4,096 | `requestId`, `commentId`, target kind and id, `actorId`, cursor |
| `maxSubTargetBytes` | 16,384 | the canonical serialised sub-target |
| `maxMentions` | 64 | distinct handles |
| `maxMentionLength` | 64 | one handle |
| `defaultPageSize` | 50 | `comment.listByTarget` |
| `maxPageSize` | 200 | `comment.listByTarget` |

Overridable through the factory's `options` parameter and validated by `assertCommentLimits`
(`:219-228`): every value must be a positive safe integer, and `defaultPageSize <= maxPageSize`.
**`1-init/create/comments.ts` passes no overrides**, so production always runs the defaults. There
is no `comments:` section in `etc/configuration.yaml` and no `config.comments` in
`loadBackendConfig.ts`.

Every inbound string passes `boundedText` (`:40-49`): trimmed, non-empty, UTF-8 byte-bounded. The
injected clock is checked too — a non-parsable timestamp raises
`CommentValidationError("Comment clock must return an ISO timestamp")` (`commentService.ts:58-63`).

---

## 4 · Endpoints

[`4-job-wiring/comments/registerCommentEndpoints.ts`](../../../apps/backend/src/4-job-wiring/comments/registerCommentEndpoints.ts),
116 lines, registers exactly two routes and logs
`comments.endpoints.registered { count: 2, endpoints: [...] }` (`:112-115`) — a manifest that,
unlike Investigation's, matches reality.

| Method | Path | Job name | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- | --- |
| POST | `/comments/command` | `comments.command.v1` | **serial** | inline | Decodes and dispatches one of the six commands. 201 for `comment.created`, 200 otherwise |
| POST | `/comments/query` | `comments.query.v1` | concurrent | inline | Decodes and dispatches one of the two queries. Always 200 on success |

There is **no comment in the Comments wiring explaining the serial choice** — Templates and Persona
both justify theirs in place, Comments does not.

### 4.1 Error mapping

`errorResponse` (`:19-40`), in evaluation order:

| Error | Status | Body `error` |
| --- | ---: | --- |
| `CommentNotFoundError` | 404 | `not_found` |
| `CommentIdempotencyMismatchError` | 409 | `idempotency_mismatch` |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `CommentValidationError` \| `CommentWireError` \| `InvalidCommentCursorError` | 400 | `validation_error` |
| anything else | 500 | `internal_error`, message fixed at `"Comment operation failed"` |

Rungs three and four are the cross-capability retention contract shared by all ten wiring files
that handle those errors.

**Every non-2xx outcome is logged** (`:45-59`): `>= 500` at error, everything else at warn, with
distinct event names per outcome — `comments.command.failed` versus `comments.command.rejected`,
and the same pair for queries. That is stricter than Persona, which logs only 5xx.

### 4.2 Composition

[`1-init/create/comments.ts`](../../../apps/backend/src/1-init/create/comments.ts) opens
`./data/comments.db`, fixes attribution, and wraps Activity in a translation adapter:

```ts
export const toCommentActivityTransaction = (
  transaction: CommentCommittedTransaction
): ActivityTransactionInput => ({
  idempotencyKey: transaction.sourceTransactionId,
  kind: "comment",
  resourceId: transaction.commentId,
  operation: transaction.operation,
  actorId: transaction.actorId,
  origin: transaction.origin,
  occurredAt: transaction.occurredAt,
  metadata: {
    target: { resourceKind: transaction.resourceKind, resourceId: transaction.resourceId },
    state: transaction.state,
    mentionCount: transaction.mentionCount
  }
});
```

— `1-init/create/comments.ts:14-32`

In `startBackend.ts`, Comments is constructed at `:55`, immediately after Activity and before every
other capability; its retention port is bound at `:140`; the readiness flag `commentsReady` is
logged at `:170`; endpoints are registered at `:182`; and the startup Activity drain runs at
`:192-193`, before the HTTP transport is registered.

---

## 5 · Persistence

Four tables in `data/comments.db`, prefix
`` cmt_${sha256(projectId).digest("hex").slice(0, 16)} ``
(`persistence/sqliteSchema.ts:12-23`). Pragmas (`:29-32`): `journal_mode = WAL`,
`foreign_keys = ON`, `busy_timeout = 5000`, `synchronous = NORMAL` — all four, which only seven of
the backend's thirteen WAL sites set (see
[04-state-and-persistence.md](../04-state-and-persistence.md)).

### 5.1 `<prefix>_comments` — live rows only

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `body` | TEXT | NOT NULL |
| `mentions_json` | BLOB | NOT NULL |
| `resource_kind` | TEXT | NOT NULL |
| `resource_id` | TEXT | NOT NULL |
| `sub_target_json` | BLOB | nullable |
| `state` | TEXT | NOT NULL `CHECK (state IN ('open','resolved'))` |
| `revision` | INTEGER | NOT NULL `CHECK (revision >= 1)` |
| `created_by`, `updated_by`, `created_at`, `updated_at` | TEXT | NOT NULL |

Two indexes, **both plain, neither partial** (`:50-53`):

- `<prefix>_comments_target` on `(resource_kind, resource_id, created_at, id)`
- `<prefix>_comments_target_state` on `(resource_kind, resource_id, state, created_at, id)`

The two index shapes are the two list queries: by target, and by target plus state. Both cover the
`(created_at, id)` keyset order exactly.

### 5.2 `<prefix>_command_receipts`

`request_id TEXT PRIMARY KEY`, `request_digest TEXT NOT NULL`, `result_json BLOB NOT NULL`,
`created_at TEXT NOT NULL` (`:55-60`).

**There is no `command_type` column**, unlike Templates. Comments compares digests only
(`commentService.ts:399-404`). In practice the digest covers `type` — `digestCommentCommand` is
`sha256(JSON.stringify(command))` over the *normalised* command
(`domain/canonical.ts:18-19`), and normalisation rebuilds the object with `type` first — so reuse
of one `requestId` across two command types surfaces as a digest mismatch anyway.

Inserts are plain `INSERT` (`sqliteCommentStore.ts:131-146`), not `INSERT OR IGNORE`. That is safe
because Comments has exactly one receipt write per accepted command and no generic post-command
receipt path.

### 5.3 `<prefix>_transaction_outbox`

| Column | Type | Constraint |
| --- | --- | --- |
| `source_transaction_id` | TEXT | PRIMARY KEY |
| `source_request_id` | TEXT | NOT NULL **UNIQUE** |
| `operation` | TEXT | NOT NULL `CHECK (operation IN ('created','updated','resolved','reopened','deleted'))` |
| `comment_id`, `resource_kind`, `resource_id` | TEXT | NOT NULL |
| `state` | TEXT | NOT NULL `CHECK (state IN ('open','resolved'))` |
| `mention_count` | INTEGER | NOT NULL `CHECK (mention_count >= 0)` |
| `actor_id` | TEXT | NOT NULL |
| `origin` | TEXT | NOT NULL `CHECK (origin IN ('user','agent','automation','system'))` |
| `occurred_at` | TEXT | NOT NULL |
| `published_at` | TEXT | nullable |

One **partial** index, `<prefix>_transaction_outbox_unpublished` on
`(occurred_at, source_transaction_id) WHERE published_at IS NULL` (`:79-81`) — sized to the drain
query, not to the table.

`source_request_id … UNIQUE` is a hard database-level guarantee of **at most one Activity row per
request**.

### 5.4 `<prefix>_history`

The shared table from `0-utils/persistence/resourceHistory.ts`, with `resource_kind = 'comment'`
throughout. Columns, checks and the `_recorded` index are identical everywhere the helper is used;
see [04-state-and-persistence.md](../04-state-and-persistence.md).

### 5.5 The revision model, spelled out

- **Create** writes `revision: 1` (`commentService.ts:240`), and `commitCreation`
  (`sqliteCommentStore.ts:268-274`) inserts the comment, the receipt and the outbox row in **one**
  transaction. No history row is written at creation.
- **Every accepted mutation is an internal CAS.** `commitMutation`
  (`sqliteCommentStore.ts:276-328`) selects `WHERE id = ? AND revision = ?` using
  `commit.comment.revision - 1`, returns `false` if the row is gone or has moved, archives the
  previous row as a history `snapshot` at its own revision, then either updates (checking
  `changes === 1`) or, for `operation === "deleted"`, writes a history `deleted` row at the new
  revision and `DELETE`s the live row. Receipt and outbox row go in the same transaction.
- The service turns a `false` into `CommentNotFoundError` (`commentService.ts:385-391`), so a lost
  race is reported as a 404, not a 409.
- **There is no caller-supplied `expectedRevision`.** The revision is read, incremented and
  re-checked entirely inside the capability, which means a client cannot express optimistic
  concurrency at all: two clients editing the same comment produce last-writer-wins across the
  serial queue rather than a conflict. This is the sharpest contrast with
  [Persona](persona.md) and [Templates](templates.md), which both take one.
- **A matching-state no-op writes no history.** `comment.resolve` on an already-resolved comment
  (or `comment.reopen` on an open one) writes *only* a receipt, logs `comments.state.noop` at info,
  and returns the unchanged comment — no revision bump, no history row, no Activity row
  (`commentService.ts:283-298`).
- **Deletion removes the row.** After `comment.delete`, `comment.get` is 404 and every mutation is
  404. The history chain ends with `snapshot@N` followed by `deleted@N+1`.
- **Purge** requires a terminal `deleted` history record. `store.purge`
  (`sqliteCommentStore.ts:334-353`) returns `"current" | "missing" | "purged"`, which the service
  maps to `ResourceNotDeletedError` (409), `ResourceHistoryNotFoundError` (404) and success
  (`commentService.ts:346-355`). The purge receipt is written inside the same transaction that
  removes the history.
- **Retention.** `pruneHistory` (`:377-386`) delegates to `pruneHistoryBefore` with a liveness
  predicate; `purgeExpired` (`:388-397`) walks expired deleted resources and skips any whose id is
  live again.

### 5.6 Paging

`listComments` (`:223-259`): `WHERE resource_kind = ? AND resource_id = ?`, optional `state = ?`,
keyset predicate `(created_at > ? OR (created_at = ? AND id > ?))`,
`ORDER BY created_at ASC, id ASC`, `LIMIT limit + 1`.

The cursor is base64url JSON
`{kind: "comments-target", resourceKind, resourceId, state | null, createdAt, id}`
and is **validated against the query it is replayed into** (`:105-129`): a cursor whose `kind`,
`resourceKind`, `resourceId` or `state` does not match the current filter raises
`InvalidCommentCursorError` → 400. That is stricter than Templates, whose cursor carries only a
`kind` tag. `comments.test.ts` test 3 (*"Comments paginates by target and binds cursors to the
original filter"*) pins it.

---

## 6 · The anchor model, threading, and the Activity outbox

### 6.1 What an anchor is, and what happens to it

The anchor is `{resourceKind, resourceId}` plus an optional opaque `subTarget`. Three measured
facts about it:

1. **Nothing else in the backend reads a sub-target.**
   `grep -rn "subTarget" --include=*.ts apps/backend/src | grep -v 3-capabilities/comments` returns
   **no matches**. Not Document, not any other capability.
2. **Comments never checks that the target exists.** There is no resource registry import, no
   existence probe, and no `resourceKind` allowlist — any two non-empty strings are a valid target.
   The capability's own `docs/concepts.md:17-19` gives the reason: *"Comments does not verify that
   the target exists. This keeps it independent of Document, Slides, General, Connector, and future
   kinds, and allows a resource level fallback when a location hint becomes stale."*
3. **The anchor is immutable for the life of the comment**, enforced by the absence of a command
   rather than by a check (§3.1).

So the honest answer to "how do anchors survive edits" is: **they are never re-evaluated.** If a
Document edit moves the text a `subTarget` pointed at, the sub-target silently goes stale; nothing
detects it, nothing repairs it, and nothing marks it. The design expects the owning resource or the
UI to notice and fall back to a resource-level comment. That fallback is described in
`docs/concepts.md` and **is not implemented anywhere in the backend** — there is no consumer of
sub-targets to implement it in.

The module's own non-goals list says the same thing in one line:

> *"No resource existence, anchor freshness, or reattachment system."*
> — `src/3-capabilities/comments/docs/invariants.md:48`

**Sub-target validation** happens twice, once at the wire and once in the domain. `wire/common.ts`
(`:34-74`) walks the value rejecting non-finite numbers, cycles and non-JSON types.
`domain/validation.ts` (`:51-103`) repeats the walk, additionally rejects non-plain prototypes,
**sorts object keys recursively**, and byte-bounds the canonical serialisation. Key sorting is what
makes the sub-target — and therefore the command digest — stable across client key ordering.

### 6.2 Threading and resolution

**There is no threading.** No `parentId`, `threadId`, `replyTo` or `rootId` appears in the model,
the schema, the wire layer or the store. Comments on one resource are a flat list ordered by
`(createdAt, id)`. The module states this as an explicit non-goal:

> *"No threads, replies, body revision history, or undo/redo."*
> — `src/3-capabilities/comments/docs/invariants.md:46`

Resolution is a two-state flag on the comment itself:

```text
create              → open
open                → resolved   (comment.resolve)
resolved            → open       (comment.reopen)
open | resolved     → gone       (comment.delete removes the row, writes history)
gone                → purged     (comment.purge removes the history)
```

Resolve and reopen bump `revision`, `updatedBy` and `updatedAt` and publish Activity; a no-op
transition does none of those (§5.5).

### 6.3 The Activity outbox

> `/** Narrow source-side Activity port; Comments never imports the Activity runtime. */`
> — `ports/activityPublisher.ts:3`

One method, `publish(transaction)`. The adapter that satisfies it is hand-written in
`1-init/create/comments.ts` (§4.2) — Comments has no knowledge of Activity's types.

Delivery is **best-effort and inline after commit** (`commentService.ts:406-441`): on success it
marks the outbox row published and logs `comments.activity.published`; on failure it logs
`comments.activity.publish.failed` at warn and returns `false`, leaving the row pending. It
**never** rolls back accepted comment state.

`publishPendingActivity(limit?)` (`:194-219`) drains pending rows in
`(occurred_at, source_transaction_id)` order and **continues past a failure** (`:208-210`) — a
deliberate difference from Templates, whose drain `break`s on the first failure
(`templateService.ts:252`) and therefore lets one bad row block every later transaction
permanently. Outbox limits: default 100, maximum 1,000 (`sqliteCommentStore.ts:33-34`); a
non-positive limit throws a plain `Error` (`:356-358`).

`markTransactionPublished` uses `SET published_at = COALESCE(published_at, ?)` (`:369-375`), so a
re-publish never rewrites the first publication time.

`sourceTransactionId` is a fresh `randomUUID()` minted at commit time
(`commentService.ts:370`) — Templates derives its from the request id instead. Both are stable
across *publish* retries because the id is persisted with the row; Comments additionally has the
`source_request_id UNIQUE` constraint.

**What the ledger sees:** `idempotencyKey = sourceTransactionId`, `kind: "comment"`,
`resourceId = commentId`, the operation, actor, origin, timestamp, and metadata carrying only the
target ids, the state and the mention *count*. No body, no handles, no sub-target. Asserted by
`comments.test.ts` test 6 (*"Comment Activity mapping omits body, handles, and opaque sub-target
content"*).

---

## 7 · Invariants

| Invariant | Enforced at |
| --- | --- |
| A caller can never set `actorId` or `origin` | absence from every command schema (`wire/commandSchemas.ts:5-38`); attribution fixed at `1-init/create/comments.ts:50` |
| Unknown fields are a 400, not a silent drop | `exactKeys`, `wire/common.ts:11-21`, applied in every decoder branch |
| A query target cannot carry a sub-target | `wire/common.ts:66` |
| A sub-target must be a JSON **object**, finite, acyclic, plain-prototyped, and byte-bounded | `wire/common.ts:34-74` and `domain/validation.ts:51-103` |
| Sub-target keys are sorted recursively before storage and hashing | `domain/validation.ts:82` |
| Mentions are server-derived on every create and update | `commentService.ts:237`, `:263` |
| A handle is at most 64 characters; a comment has at most 64 distinct handles | `domain/validation.ts:128-136` |
| Every string is trimmed, non-empty and UTF-8 byte-bounded | `boundedText`, `domain/validation.ts:40-49` |
| The clock must return a parsable ISO timestamp | `commentService.ts:58-63` |
| Limits must be positive safe integers with `defaultPageSize <= maxPageSize` | `assertCommentLimits`, `domain/validation.ts:219-228` |
| `state` is `open` or `resolved`, at the type level and in SQL | `domain/model.ts:3`; `persistence/sqliteSchema.ts:42` |
| `revision >= 1` | `persistence/sqliteSchema.ts:43` and the shared history DDL |
| A mutation only commits against the exact prior revision | `sqliteCommentStore.ts:278-282`, `:322` |
| Comment, receipt and outbox row are written in one transaction | `sqliteCommentStore.ts:268-274`, `:277-327` |
| An exact retry replays the stored result; a divergent reuse is 409 | `commentService.ts:399-404` |
| A no-op resolve/reopen writes a receipt and nothing else | `commentService.ts:283-298` |
| At most one Activity row per request | `source_request_id … UNIQUE`, `persistence/sqliteSchema.ts:64` |
| Publication time is never rewritten | `COALESCE`, `sqliteCommentStore.ts:371` |
| A failed Activity publish never rolls back the comment | `commentService.ts:431-440` |
| Purge requires a terminal `deleted` history record | `sqliteCommentStore.ts:342-348` |
| Cursors are bound to the exact filter they were minted for | `sqliteCommentStore.ts:105-129` |
| No body, handle or sub-target value ever enters a log record or an Activity row | `commentService.ts:443-455` (logs `mentionCount` and `hasSubTarget` booleans only); asserted by `comments.test.ts` tests 5 and 6 |

### 7.1 Logging

| Level | Events |
| --- | --- |
| info | `comments.runtime.created` (carries the resolved limits), `comments.command.completed`, `comments.command.replayed`, `comments.mutation.committed`, `comments.state.noop`, `comments.purged`, `comments.activity.published`, `comments.activity.recovery.completed`, `comments.endpoints.registered` |
| debug | `comments.read`, `comments.listed`, `comments.activity.publish.started`, `comments.activity.publish.skipped`, `comments.activity.recovery.started`, `comments.activity.recovery.skipped` |
| warn | `comments.command.failed`, `comments.query.failed` (service-level), `comments.activity.publish.failed`, and the wiring's `comments.command.rejected` / `comments.query.rejected` for 4xx |
| error | the wiring's `comments.command.failed` / `comments.query.failed` for 5xx |

`grep -rn 'detail: "content"' src/3-capabilities/comments` returns **no matches**: Comments emits
zero content-labelled records because it logs no authored content at all. Note the service and the
wiring both use the name `comments.command.failed`, at different levels and with different fields.

---

## 8 · Design decisions worth preserving

**The anchor is deliberately opaque, and that buys independence.**

> *"Comments does not verify that the target exists. This keeps it independent of Document, Slides,
> General, Connector, and future kinds, and allows a resource level fallback when a location hint
> becomes stale."*
> — `src/3-capabilities/comments/docs/concepts.md:17-19`

This is why Comments has zero capability dependencies and zero capability consumers, and why it
could be constructed second in `startBackend.ts`, immediately after Activity.

**Attribution is a composition concern, stated in the type.**

> `/** Trusted attribution supplied by composition, never by the public payload. */`
> — `domain/model.ts:32`

**The outbox record is self-contained by design.**

> `/** Self-contained source-outbox record used to publish immutable Activity. */`
> — `domain/model.ts:113`

Publishing never re-reads the comment, so a body edited between commit and publish cannot change
what the ledger records, and a deleted comment can still have its transaction published.

**The Activity port is one method wide.**

> `/** Narrow source-side Activity port; Comments never imports the Activity runtime. */`
> — `ports/activityPublisher.ts:3`

**The recovery contract is in the interface.**

> `/** Retries source-outbox rows left unpublished after failure or restart. */`
> — `application/commentService.ts:50`

**Mention parsing states its one hard case.**

> `/** Parses standalone ASCII @handles, excluding the @ in an email address. */`
> — `domain/validation.ts:116`

```ts
// A terminal period is prose punctuation, while interior periods remain
// part of a handle (for example, @ada.lovelace).
```

— `domain/validation.ts:125-126`

**The target is the anchor, and the hint is the resource's business.**

> `/** A project resource and an optional resource-owned opaque location hint. */`
> — `domain/model.ts:12`

**Unknown keys are a client error.** `exactKeys` (`wire/common.ts:11-21`) rejects unexpected
fields rather than ignoring them, and names the first offender in the message
(`` `${label} contains unexpected field '${unexpected[0]}'` ``). The same primitive appears in
Persona's wire layer with an explicit rationale comment; Comments implements the rule without
restating it.

---

## 9 · Known gaps and defects

Comments has no known behavioural defect. What follows is dead surface, missing capability, and
one drift note.

### 9.1 No client-facing optimistic concurrency

Stated in §5.5 and repeated here because it is the design's main functional limit: no request
carries an `expectedRevision`, so a client cannot detect that it is editing a stale body. The
serial queue orders the writes; it does not tell the loser anything happened. A lost internal CAS
surfaces as `CommentNotFoundError` → **404**, which is indistinguishable from "someone deleted it".

### 9.2 Dead exports

| Symbol | Site | Status |
| --- | --- | --- |
| `canonicalizeJsonObject` | `domain/canonical.ts:15` | **Dead.** `grep -rn "canonicalizeJsonObject" src test` finds only its own definition. It is not even re-exported by `index.ts`. Key-sorting for sub-targets is done independently by `canonicalJsonValue` in `domain/validation.ts` |
| `normalizeSubTarget` | exported from `index.ts:11` | No external consumer; used only internally by `normalizeCommentTarget` |

Both are listed in the repository-wide dead-surface inventory in
[11-known-issues.md](../11-known-issues.md).

### 9.3 `CommentQueryResult.comment` is unreachably optional

`domain/model.ts:96` declares `{ type: "comment.get"; comment?: Comment }`, but
`commentService.ts:150-151` throws `CommentNotFoundError` when the row is missing. The field is
never absent in practice, so every consumer has to handle a case that cannot occur.

### 9.4 The connection is never closed

`SQLiteCommentStore.close()` (`:211-213`) is not on the `CommentStore` port and is called only by
`comments.test.ts`. Shutdown (`startBackend.ts:220-227`) closes Fastify and the logger and exits
with every database handle open. Backend-wide; see
[11-known-issues.md](../11-known-issues.md).

### 9.5 No cross-database transaction with Activity

The outbox makes this recoverable rather than atomic, and the module says so in its own non-goals:
*"No cross-database transaction with Activity; the Comments outbox is recovery authority"*
(`docs/invariants.md:50-51`). A publish failure leaves a durable pending row that the next inline
publish or the next startup drain retries. The failure mode Comments **does** share with the other
producers is Activity's poison pill: a `sourceTransactionId` reused with different content raises
`ActivityTransactionConflictError` on every retry forever, with no dead-letter path (see
[activity.md](activity.md)). Comments' fresh-UUID identity makes that essentially unreachable in
practice.

### 9.6 Module-doc drift

The Comments `docs/` package is accurate in every substantive claim — the limits table, the
endpoint table, the lifecycle diagram, the no-op receipt rule, the Activity-metadata guarantee and
the non-goals list all match the code. Three exceptions, recorded so the next reader does not
re-derive them:

| File:line | Claim | Reality |
| --- | --- | --- |
| `docs/runtime.md:63-65` | "Separate **partial** indexes support target order, target-plus-state order, and pending Activity scans" | Only the outbox index is partial. `<prefix>_comments_target` and `<prefix>_comments_target_state` are plain (`persistence/sqliteSchema.ts:50-53`) |
| `docs/types.md:74-85` | error table | Omits the two shared retention errors the endpoint actually maps — `ResourceNotDeletedError` → 409 and `ResourceHistoryNotFoundError` → 404 (`registerCommentEndpoints.ts:26-31`), both reachable through `comment.purge` |
| `docs/flows.md:44-53`, `docs/invariants.md:22, 39` | queries select "non-deleted rows" | There is no deleted flag; deletion physically removes the row (`sqliteCommentStore.ts:299-300`). The observable behaviour matches; the mechanism described does not |

`docs/README.md:39` also points at a `scratch/` file for "the broader rationale". Those drafts are
private working documents that run ahead of the code and are not part of this documentation set.

### 9.7 Coverage

Ten tests across two files, all passing.

`comments.test.ts` (7): opaque sub-targets, mentions, lifecycle and replay; durable Activity
delivery and stable-transaction retry; pagination and cursor binding; project-table isolation when
stores share one database; log hygiene; the Activity mapping omission guarantee; and the purge
precondition.

`comments-wiring.test.ts` (3): alias availability, command and target-query decoding, and the
rejection of caller-controlled attribution and scalar sub-targets.

Not covered:

- **`pruneHistory` / `purgeExpired` for Comments specifically** — the retention contract is tested
  generically in `resource-retention.test.ts`.
- **Concurrency.** Every test is single-threaded; the internal CAS's losing branch is exercised
  only through a deleted-row path, not through a genuine interleave.
- **A non-`user` origin.** Composition hard-codes `"user"`, and no test constructs the capability
  with `agent`, `automation` or `system`, so three quarters of the `CommentOrigin` union and its
  SQL `CHECK` are never exercised end to end.

---

## See also

- [07-capabilities/README.md](README.md) — the capability inventory
- [activity.md](activity.md) — the ledger Comments publishes into, and the producer comparison table
- [templates.md](templates.md) — the other outbox producer, with the opposite drain-failure policy
- [persona.md](persona.md) — the same `exactKeys` wire discipline with a client-facing `expectedRevision`
- [04-state-and-persistence.md](../04-state-and-persistence.md) — the shared history table and the retention sweep
- [11-known-issues.md](../11-known-issues.md) — dead surface and unclosed connections
