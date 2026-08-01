# Activity invariants and limits

## Scope of guarantees

The following guarantees apply when callers use `ActivityCapability` with an
`ActivityStore` implementation such as `SQLiteActivityStore`. They describe
the implemented ledger/Presence core and its registered read route. They do not
imply that every producing kind has an outbox publisher, that a client is
authorized to see every transaction, or that a caller has a trusted session.

## Transaction admission and idempotency

- A transaction requires bounded non-empty `id`, `kind`, `operation`, and
  parseable ISO `occurredAt` values.
- Optional `resourceId`, `changeSetId`, and `actorId` must be bounded
  non-empty strings when supplied.
- `origin` is exactly `user`, `agent`, `automation`, or `system`.
- A supplied revision is a non-negative safe integer.
- Metadata must be JSON-compatible; non-finite numbers and unsupported values
  are rejected.
- First publish of a transaction ID stores the normalized transaction.
- Replaying that ID with canonically equal content returns the existing stored
  transaction without allocating another sequence.
- Reusing that ID with different canonical content fails with
  `ActivityTransactionConflictError`.

The digest includes all transaction fields and canonicalized metadata.
Equivalent object-key order therefore does not make a retry conflict.

## Ordering and ledger behavior

- Each newly accepted transaction receives one positive, unique Activity
  sequence from the project-local meta allocator.
- Transaction pages are newest first: descending sequence, then ID as a
  deterministic tie-breaker.
- A continuation cursor asks for records older than the prior page's sequence.
- `publishedAt` is clock time at Activity acceptance; `occurredAt` remains
  the source timestamp.
- The supported runtime API offers no update/delete operation for transactions.
  Through that API, ledger transactions are append-only.

Sequence is not a global source-commit clock. Independent source stores can
commit in a different order from their eventual Activity publication order.

## Project isolation and SQLite atomicity

- Every Activity table name includes a deterministic 16-hex SHA-256 prefix of
  the project ID.
- The project ID is supplied at SQLite store construction, never in a
  transaction/query payload.
- The SQLite adapter enables WAL, foreign keys, five-second busy timeout, and
  NORMAL synchronous mode.
- First-time publication performs ID check, sequence allocation, and insertion
  in one SQLite transaction.
- No user ID participates in the Activity storage partition.

This is not a distributed transaction guarantee with source databases. A source
resource needs a local outbox row in the same transaction as its canonical
mutation, then retryable post-commit Activity publication.

## Query and endpoint behavior

- Transaction queries filter exact kind and/or resource ID when supplied.
- A malformed, wrong-kind, or invalid-sequence cursor raises
  `InvalidActivityCursorError`.
- Store paging defaults to 50 items and caps at 200.
- An invalid explicit store limit is rejected rather than silently changed.
- The registered query route returns 400 for validation/cursor errors and a
  non-sensitive 500 for unexpected errors.
- The current route decoder verifies query type and supported field value types,
  but does not yet require exact object keys. Unknown fields are ignored.
- No public endpoint can append an arbitrary Activity transaction.

Authentication and authorization policy is intentionally outside the current
endpoint. The route does not itself establish a user or project context beyond
the backend's configured project instance.

## Presence guarantees

- Each session ID has at most one current persisted lease; heartbeat upserts it
  instead of appending history.
- Heartbeats validate bounded identity/context fields and JSON-compatible state.
- A lease is absent from reads once `expiresAt <= now`, even before cleanup.
- `leave` removes only its named session and reports whether that row existed.
- Expired cleanup is bounded: default 100 rows, maximum 1,000 rows.
- Heartbeat, leave, expiry, and cleanup never create ledger transactions.
- HTTP Presence writes are intentionally unavailable: `POST /activity/command`
  always returns 501 `presence_transport_unsupported` until trusted session
  transport is wired.

The in-process runtime trusts its heartbeat input. A future transport adapter
must derive session/actor IDs rather than accept caller-supplied identity.

## Explicit non-goals and deferred work

- **Document is the only wired source publisher.** It retains a self-contained
  source outbox row, publishes post-commit, and retries pending rows at startup.
  Slide and every other producer still need their own adapter/recovery path
  before their changes appear in Activity.
- **There is no Activity endpoint for ledger append.** Only trusted producer or
  project code may call `publish`.
- **There is no undo/redo coordinator.** Activity does not choose targets, call
  source compensation, or enforce redo chains yet.
- **There is no cross-database atomic commit.** Activity cannot make source and
  Activity SQLite writes one ACID transaction; the source outbox is recovery
  authority.
- **There is no ledger retention/archival policy.** The core neither compacts
  nor deletes Activity transactions through its API.
- **There is no realtime Presence connection/broadcast subsystem.** Activity
  stores and reads leases; a later transport owns connection lifecycle.

## Tests

Focused tests verify first publish/equal replay/divergent conflict, descending
sequence pagination and kind/resource filtering, and Presence expiry without
ledger writes. Endpoint tests verify query and explicit Presence-write refusal.
Document application/persistence tests verify post-commit delivery, recovery,
and self-contained source-outbox migration. Remaining integration tests should
cover further producer adapters and authenticated session derivation.
