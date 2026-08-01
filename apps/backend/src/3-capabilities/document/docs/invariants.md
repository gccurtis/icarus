# Document guarantees and invariants

## Outcome guarantees

For a wire-valid command whose domain preconditions hold:

- create yields exactly revision 0 with a loadable Base;
- an accepted mutation yields exactly one new revision and a replayable
  ChangeSet with exact inverse operations;
- repeated `(documentId, requestId)` with identical canonical input returns the
  stored result, while different input yields an idempotency conflict;
- historical load yields the exact validated snapshot if a contiguous retained
  Base/ChangeSet path exists, otherwise `HistoryPrunedError`;
- prompt and Formula asynchronous work can settle only onto the frozen target
  conditions; a changed target is stale rather than retargeted.

## Aggregate and representation invariants

- `representationVersion === 1`; revision is a non-negative safe integer.
- Title is non-empty; lifecycle is closed.
- Page dimensions are positive integers, margins non-negative, margins leave
  positive usable space, and orientation agrees with dimensions.
- Exactly one heading Style exists for each level 1–6.
- Every Block kind has a resolvable default Style; Style inheritance is acyclic.
- Every Row is non-empty; tracks exactly parallel Block order with positive
  width units; gaps leave positive width where container width is known.
- No nested callout; configured recursion and content counts are enforced.

## Identity invariants

- Every governed local ID is unique across Styles, Rows, Blocks, nested
  structures, table parts, and Rich Text atoms/marks.
- The ledger permanently records claimed IDs. Ordinary mutation cannot reuse a
  tombstone or change an identity's kind.
- Exact compensation may reactivate a tombstoned ID only with the same kind.
- External Derived Output/media IDs are references, not ledger identities.
- One live Prompt Block owns one dedicated output; a Derived Output cannot be
  shared by multiple live Prompt Blocks in one snapshot.

## List, table, media, and layout invariants

- Checklist items require `checked`; other list kinds cannot carry it; only
  numbered lists may carry a positive start.
- Table cells cover every row/column coordinate exactly once and are stored in
  row-major order.
- Merges reference existing, non-overlapping cells and form a complete
  contiguous rectangle.
- Image sources carry file/version/digest; visual heights and supplied widths
  are positive integers.
- `computeAssignedBlockWidth` removes total gaps before proportional track
  division and rejects impossible or non-finite geometry.

## History and digest invariants

- Creation co-commits head, initial identities, Base, receipt, and source
  transaction. The source transaction's stable Activity ID and source request
  ID are allocated before that commit.
- Mutation CAS updates only the expected current revision and co-commits head,
  identity transitions, ChangeSet, attempts/settlements, ownership, receipt,
  and source transaction. Its copied ChangeSet and compensation fields are not
  foreign keys and remain usable after history compaction.
- `ChangeSet.seq === ChangeSet.revision === priorRevision + 1`.
- Canonical digests recursively sort record keys and omit undefined fields.
- Rebase is allowed only when incoming touched IDs are disjoint from every
  intervening ChangeSet.
- Compensation requires a retained target, complete contiguous intervening
  sequence, and disjoint touched IDs.
- Pruning retains enough Base/tail state for its selected cutoff and does not
  prune active attempts; retained counts must be positive.

## Prompt and Formula ownership invariants

- Generic public submit cannot create Prompt Blocks or call
  `prompt.apply-derived-output`.
- Prompt creation reserves one Block ID and creates a new dedicated output.
- Definition update freezes the target output in a local claim before the
  external call, preventing retries from retargeting after Block edits.
- Prompt refresh adopts only a newer revision of the same frozen output.
- Formula settlement targets the same atom and expression digest and refuses an
  atom touched since its frozen revision.
- Formula errors are represented as diagnostic settlements, distinct from
  accepted null values.

## Concurrency, idempotency, and atomicity

- Public command jobs and internal settlement/compaction jobs use the serial
  queue; queries and compute stages may run concurrently.
- Queue choice reduces contention but SQLite revision CAS is the correctness
  authority.
- Attempt stage claims are unique by `(attemptId, stage)` and idempotency key.
- Completed/running claims cause duplicate stage work to no-op; failed stages
  can be reclaimed after consistent digest checks.
- External Derived calls use deterministic idempotency keys.
- Dispatch returns on admission, so a queued job is not proof of successful
  work; persisted state remains recoverable.

## Recovery and failure

- Startup converts interrupted running receipts to failed, then redispatches
  recoverable attempts.
- Stage actions retry after 10 ms and 50 ms. Queue-capacity admission retries
  exponentially from 25 ms up to 2 seconds in process.
- Prompt creation failure atomically detaches any pending output with attempt/
  receipt failure when ownership already exists.
- A stage effect whose completion receipt fails remains non-terminal/running so
  startup can retry safely.
- Startup retries unpublished Activity source transactions through the optional
  publisher. A failed publisher leaves the source transaction durable and
  unpublished; Activity's idempotent transaction ID makes retry safe.

## Limits

Current configured defaults:

| Limit | Value |
| --- | ---: |
| Rows per Document | 10,000 |
| Blocks per Row | 32 |
| Styles per Document | 256 |
| Nested content depth | 16 |
| Rich Text atoms per text-bearing Block | 10,000 |
| Table rows | 1,000 |
| Table columns | 256 |
| Retained Bases | 5 |
| Retained ChangeSets | 1,000 |
| Retained terminal attempts | 1,000 |

Wire budgets are independent and listed in [Types](types.md). SQLite pagination
defaults to 50 and caps at 200; maintenance batches default to 100 and cap at
1,000. The query wire allows history limits 1–1,000, while store pagination
still caps the returned page at 200.

## Security and observability

- Wire decoding rejects non-JSON values, cycles, non-finite numbers,
  non-plain objects, unknown fields, oversized payloads, and invalid enums.
- Project IDs derive isolated SHA-256-prefixed table names; project/user IDs
  are construction scope, not client-selected fields.
- Endpoint 500 responses do not expose internal error messages; Logger records
  the error name. Command logs include request ID/type/duration but no document
  content.
- The capability itself implements no authentication or authorization.

## Test coverage

Current tests exercise all operation families/inverses, recursive validation,
styles/projections, layout, identity transitions, strict wire admission and
budgets, project isolation, transaction/CAS behavior, stage recovery, history
pruning, idempotency, rebase/compensation, prompt ownership/delegation, Formula
attempts, and internal queue selection. They are strong executable evidence,
but not a proof against every SQLite/process-failure interleaving.

## Explicit non-goals and absent behavior

- exact pagination, page count, font-manifest rendering, or export;
- a Document hard-delete command;
- an Activity-mediated undo/redo coordinator or a Document Activity endpoint;
- automatic deletion of detached Derived Outputs;
- collaboration/Presence or distributed multi-process serialization;
- live media resolution or chart execution;
- client-controlled actor attribution (wire does not admit `actorId`);
- capability-level shutdown/closing of its store.
