# Document guarantees and invariants

## Outcome guarantees

For a wire-valid command whose domain preconditions hold:

- create yields exactly revision 1 with a loadable Base;
- an accepted mutation yields exactly one new revision and a replayable
  ChangeSet with exact inverse operations;
- `document.create` allocates the document id; a repeated `requestId` with
  identical canonical input replays the original result, including the same
  allocated id, and does not create a second document. A different `requestId`
  is a different logical create and gets its own document;
- `document.delete` requires a current Document whose `expectedRevision`
  matches head. It logically deletes owned Derived Outputs first, then archives
  head revision `N`, appends terminal deletion revision `N + 1`, records a
  source transaction, and removes the current head atomically;
- logical deletion removes current-scoped receipts, attempts, prompt ownership,
  and stage receipts while retaining the resource root, head history,
  Bases/ChangeSets, structural identity ledger, source transaction, and owned
  Derived Output references;
- an exact deletion retry replays `document.deleted` from the retained source
  transaction; another request against the absent current Document is not
  treated as restore or reactivation;
- `document.purge` requires no current head and a terminal deletion record. It
  purges retained Derived Outputs and all retained Document state, returns
  `document.purged`, and emits no Activity transaction;
- neither revision retention nor purge removes committed transaction-outbox
  rows; pending delivery of `document.deleted` remains independently
  recoverable;
- repeated `(documentId, requestId)` with identical canonical input returns the
  stored result, while different input yields an idempotency conflict;
- historical load yields the exact validated snapshot if a contiguous retained
  Base/ChangeSet path exists, otherwise `HistoryPrunedError`;
- prompt and Formula asynchronous work can settle only onto the frozen target
  conditions; a changed target is stale rather than retargeted.

## Aggregate and representation invariants

- Revision is a non-negative safe integer. There is no representation version:
  the shape is whatever the code says, and the database is deleted when it
  changes, so a version field only ever named a version that never coexisted
  with another.
- Title is non-empty; lifecycle is closed.
- `isTemplate` is set once by `markAsTemplate` and never cleared. It lives on the
  head rather than the snapshot because mode does not vary by revision —
  rewinding history must not un-seal a Document.
- Context Variable names are non-empty and case-insensitively unique within a
  Document, because a template binding addresses them **by name** and whoever
  writes that binding cannot know the author's casing.
- Variable IDs join the retained-history non-reuse ledger. A Prompt Block
  addresses a variable by ID, so reusing a deleted one would silently re-point a
  Block in retained history at a different variable.
- A Prompt Block always carries exactly one context, so its scope can never
  collapse to a zero-length entry list by accident. A `direct` context names one
  `ContextEntry` — the project sentinel `{ id: "*", kind: "project" }` included,
  which is how a Block grounds on the whole project. A `variable` context must
  resolve to a variable that exists, and an unbound one is refused.
- **Deleting a bound variable cascades and changes no grounding.** Every
  referencing Block is re-pointed at the variable's current target — the same
  thing it already resolved to — so deletion removes a level of indirection
  rather than the grounding underneath it. The inverse restores the variable
  *and* re-points the Blocks back at it.
- Deleting an **unbound** referenced variable is refused, because there is
  nothing to substitute. Only reachable on a template, where an unbound variable
  is a declared parameter.
- A Prompt Block's `appliedRevision` is **non-negative**. `0` means declared but
  never answered, which is the state every Prompt Block in a fresh copy is in.
  `prompt.apply-derived-output` still requires a positive revision: applying
  revision 0 would mean un-answering.
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
- The ledger records claimed IDs for the retained lifetime of the Document.
  Ordinary mutation cannot reuse a structural tombstone or change an identity's
  kind; purge removes the ledger with the resource root.
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

- Creation co-commits the resource root, current head, initial identities,
  Base, receipts, and source transaction. Its stable `sourceTransactionId` and
  source request ID are allocated before that commit.
- Mutation CAS archives the prior head, updates only the expected current
  revision, and co-commits head, identity transitions, ChangeSet,
  attempts/settlements, ownership, receipt, and source transaction. Its copied
  ChangeSet and compensation fields are not foreign keys and remain usable
  after history compaction.
- `ChangeSet.seq === ChangeSet.revision === priorRevision + 1`.
- Canonical digests recursively sort record keys and omit undefined fields.
- Rebase is allowed only when incoming touched IDs are disjoint from every
  intervening ChangeSet.
- Compensation requires a retained target, complete contiguous intervening
  sequence, and disjoint touched IDs.
- Pruning retains enough Base/tail state for its selected cutoff and does not
  prune active attempts; retained counts must be positive.
- Revision retention prunes old `document_history` snapshots for live
  Documents. Once a terminal deletion record crosses the shared cutoff, the
  retention scheduler invokes the same purge path as `document.purge`.

## Prompt and Formula ownership invariants

- Generic public submit cannot create Prompt Blocks or call
  `prompt.apply-derived-output`.
- Prompt creation reserves one Block ID and creates a new dedicated output.
- Definition update freezes the target output in a local claim before the
  external call, preventing retries from retargeting after Block edits.
- Prompt refresh adopts only a newer revision of the same frozen output.
- A detached ownership row older than the retention cutoff has its Derived
  Output logically deleted and the row removed. `listDetachedOutputs(cutoff)`
  reports those rows and `releaseDetachedOutput` forgets each one, both called by
  the `derived-outputs-orphans` retention port, which deletes the output first
  and only then releases the row. `deletePromptOutputOwnership` refuses an
  attached row, so a live Prompt Block can never be stranded.
- The grace period is load-bearing rather than cautious: compensation
  re-attaches a detached output by ID, so a recently detached row may still come
  back and only rows past the cutoff are beyond its reach.
- The sweep logically deletes rather than purges. The `derived-outputs`
  retention port clears the history that deletion leaves behind on the same
  schedule, so there is one retention mechanism, not two.
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
  unpublished; Activity derives the same ledger ID from `sourceTransactionId`
  on every retry.

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
- restore or resource reactivation after logical deletion;
- an Activity-mediated undo/redo coordinator or a Document Activity endpoint;
- deletion of Derived Outputs this capability never owned; the orphan sweep acts
  only on outputs a claimant positively released, so a standalone output
  declared through the Derived Outputs API is never reaped;
- collaboration/Presence or distributed multi-process serialization;
- live media resolution or chart execution;
- client-controlled actor attribution (wire does not admit `actorId`);
- capability-level shutdown/closing of its store.

## Template-mode invariants

- Every public command and query naming an `isTemplate` Document is refused,
  reads included. `document.list` excludes it rather than erroring.
- The refusal is checked once on the document, not per command type.
- `duplicate` is a **pure copy**: new ID, same content, Context Variables and
  their targets verbatim. It applies no bindings and sets no template flag, which
  is what lets registration and instantiation be the same call with different
  follow-up.
- A copy's Prompt Blocks get **new** Derived Outputs — one live Block owns one
  dedicated output, so a copy cannot point at the source's — declared at
  `appliedRevision: 0` and owned from birth in the same commit.
- `duplicate` replays on its idempotency key: the Templates key *is* the
  create-receipt key, so a retried registration yields one copy.
- `applyBindings` commits the variable change before re-pointing Derived Output
  definitions. A crash in between leaves the declaration correct and an output
  stale — which the next refresh corrects — rather than an output grounded on a
  target the Document does not hold.
- A binding naming a variable the Document does not have is refused, or the
  Template record's declaration and its backing content would silently disagree.
