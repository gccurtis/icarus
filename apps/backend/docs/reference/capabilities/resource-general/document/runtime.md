# Document runtime and function map

## Construction

`createDocumentInstance` opens a
`SQLiteDocumentStore(config.projectId, "./data/documents.db")` and calls
`createDocumentCapability` with Rich Text, Formula, the Formula resolver,
Derived Outputs, an Activity publisher adapter, internal jobs, Logger,
configured Document options, and trusted `config.userId` attribution.

`createDocumentCapability` returns the
private `DocumentService` behind the public `DocumentCapability` interface.
Startup registers internal intents and public endpoints, then invokes
`recoverPendingAttempts()` and `publishPendingActivity()` before listening.

## Public `DocumentCapability` methods

### `command(request)`

Rejects the reserved `$document-internal$:` request-ID prefix, dispatches all
nine command variants to their specialized handlers, and logs command type,
request ID, and duration.

### `query(request)`

- `document.list`: current-head pagination, optional live lifecycle, service
  page size 100; deleted Documents have no row to list.
- `document.load`: unqualified load requires a current head; revision-qualified
  load may use `document_history`, reconstruct the retained snapshot, and fetch
  each exact referenced prompt revision.
- `document.history`: verifies `document_resources`, then returns paged retained
  ChangeSets even when the current head has been logically deleted.
- `document.attempt`: loads one attempt scoped to the Document.

### Prompt stage methods

- `computePromptCreation`: keyed Derived declaration, register pending local
  ownership, keyed initial refresh, mark failed/detached if no first revision,
  otherwise store candidate and dispatch settle.
- `settlePromptCreation`: insert a prompt Block at the current head through the
  normal mutation commit; placement/identity/style conflict makes the attempt
  stale and ownership detached.
- `computePromptRefresh`: keyed refresh; mark unchanged when no newer revision,
  otherwise store candidate and dispatch settle.
- `settlePromptRefresh`: require the same output and applied revision, then
  internally adopt the candidate through a normal serial mutation.

### Formula stage methods

- `computeFormulaEvaluation`: parse frozen source; build the resolver snapshot;
  evaluate; create either accepted-value or diagnostic settlement operations;
  store candidate and dispatch settle.
- `settleFormulaEvaluation`: require the same formula atom/expression and no
  intervening touch of its atom ID, then apply candidate Rich Text operations
  through normal mutation.

### Maintenance methods

- `recoverPendingAttempts`: changes interrupted running stage receipts to
  failed, lists requested/computing/proposed attempts, and redispatches compute
  or settle according to current state.
- `publishPendingActivity`: retries each locally committed, unpublished source
  transaction through the optional publisher and marks it published only after
  successful delivery. Publisher failures do not change accepted Document work.
- `compact(documentId)`: reconstructs a configured cutoff and current head,
  appends Bases only if the head revision still matches, then prunes retained
  history/terminal attempts.
- `pruneHistory(cutoff)`: removes superseded head-history rows older than the
  shared revision-retention cutoff.
- `purgeExpired(cutoff)`: finds terminal deletion records older than the cutoff
  and invokes the same retained-Document purge path used by `document.purge`.

## Command handlers and supporting service functions

- `create`: canonical request digest; replay check; existence check; blank
  snapshot/defaults; full validation; atomic revision-one resource/current
  commit.
- `submit`: requires operations, rejects caller-created Prompt content and
  internal output adoption, then calls `mutate`.
- `mutate`: replay check; load head; optional conservative disjoint rebase;
  reduce/validate; assign revision; create ChangeSet/head/source transaction/formula attempts;
  compute identity and prompt-ownership transitions; atomic store CAS; dispatch
  Formula/compaction intents.
- `compensate`: requires exact current expected revision, retained target and
  contiguous intervening tail, and disjoint touched IDs; applies retained
  inverse as a new compensating ChangeSet.
- `deleteDocument`: requires current existence and expected revision, logically
  deletes owned Derived Outputs, then archives the head, appends the terminal
  revision and source transaction, retains output IDs, and removes current
  state atomically.
- `purgeDocument`: purges retained Derived Output history, then requires a
  terminal Document deletion and removes `document_history` plus the stable
  resource root and its retained data.
- `requestPromptCreation`: reserves a new Block identity with a dry-run divider
  insertion, persists attempt + receipt, and dispatches compute.
- `updatePromptDefinition`: resolves the Prompt Block's current output, calls
  keyed Derived definition update directly, then records the receipt. Derived
  Outputs' own idempotency key (not a local claim) is what makes a retry after
  a crash before the receipt commits replay rather than reapply.
- `requestPromptRefresh`: freezes exact Block/output/applied revision and
  persists attempt + receipt before dispatch.
- `requestFormulaEvaluation`: freezes exact Rich Text formula expression and
  persists attempt + receipt before dispatch.

Auxiliary service families include prompt-reference collection, request and
snapshot digests, attempt/compaction intent construction, actor attribution,
receipt replay validation, prompt ownership transition derivation, diagnostic
settlement creation, snapshot replay, accepted-source-transaction construction, and stale
attempt marking.

`runStage` owns stage receipts and terminal-state no-op behavior. It retries
stage state/work/receipt actions twice after 10 ms and 50 ms, records typed
failure diagnostics, and keeps a successful-but-unfinished receipt recoverable.
Internal dispatch retries only queue-capacity admission errors with unref'd
exponential backoff from 25 ms capped at 2 seconds; other admission errors are
logged but not retried.

## Default creation functions

`createService.ts` exports:

- `DEFAULT_DOCUMENT_PAGE_LAYOUT`: US Letter portrait (12,240 × 15,840 twips),
  1,440-twip margins, decimal page numbers starting at 1;
- `createDefaultDocumentStyles()`: normal/code/quote/visual plus exactly one of
  heading roles 1–6 and defaults for all ten Block kinds;
- `createBlankSnapshot(input)`: representation/revision 1/1, active lifecycle,
  cloned supplied/default page/styles, and no Rows.

## Pure domain function families

- Canonical: recursively sort record keys, UTF-8 encode, and SHA-256 digest
  arbitrary values, snapshots, or Formula source.
- Tree: visit recursive Row containers; locate Rows/Blocks/Lists/Tables/List
  Items; find the outermost Block owning nested Rows.
- Layout: usable page width/height and proportional Block width after Row gaps.
- Style: resolve inheritance and project Block/text styling.
- Reducer: apply all operation variants to a clone, create exact inverse,
  compute semantic touched IDs, discover changed/new Formula atoms, and validate
  the final snapshot. Replay uses the same reducer without revalidation.
- Rebase: intersect incoming touched IDs with every intervening ChangeSet.
- Identity: recursively collect all governed IDs and deterministic transitions.
- Validation: recursively validate page/styles/Rows/Blocks/Rich Text/lists/
  tables/merges/visuals and configured limits.
- Projections: plain text, heading outline, prompt/Formula dependencies, and
  resolved styling.

## `DocumentStore` public API

The full port is in `documentStore.ts`. Method
families are:

- current/history: `listHeads`, `getHead`, `hasResource`,
  `getHistoricalHead`, `getBaseAtOrBefore`, `getChangeSets`, `listChangeSets`,
  `getChangeSet`;
- idempotency/identity: `getSubmission`, `recordSubmission`, `getIdentity`;
- atomic commits: `commitCreation`, revision-CAS `commitMutation`;
- deletion/retention: logical `deleteDocument`, guarded `purgeDocument`,
  `listRetainedPromptOutputIds`, `pruneRevisionHistory`, and
  `listExpiredDeleted`;
- compaction: `appendBaseIfHead`, `pruneHistory`;
- attempts: get variants, list recoverable, create with/without submission,
  update;
- stages: claim, complete, fail, atomic prompt-creation failure, recover running;
- prompt ownership: get by output/Block, register pending, transition, list
  detached;
- transaction outbox: direct get by `sourceTransactionId`, request, or copied
  ChangeSet; list unpublished transactions; and mark a source transaction
  published.

`SQLiteDocumentStore.close()` additionally closes the adapter, although close
is not part of the `DocumentStore` port and the current Document capability
does not expose shutdown/close.

SQLite enables WAL, foreign keys, 5-second busy timeout, and NORMAL synchronous
mode. Creation and mutation transactions co-commit every canonical side effect.

The typed `documents` table is the current projection. `document_resources` is
the ID-only retained root for Bases, ChangeSets, the structural identity ledger,
and retained output ownership. `document_history` stores superseded head
snapshots plus terminal deletion rows. Receipts, attempts, prompt ownership,
and stage receipts reference the current `documents` row and cascade on logical
deletion. `transaction_outbox` is self-contained and carries a nullable
`resource_root_id` foreign key whose `ON DELETE SET NULL` attachment survives
resource purge. It is not pruned by retention, so already-committed
transactions — especially `document.deleted` — remain publishable and
retryable.

## Wire decoder families

`decodeDocumentCommand` and `decodeDocumentQuery` own public envelopes and
discriminants. `decodeDocumentOperation(s)` owns operation shape and count.
Value decoders recursively own page, Style, placement, Rich Text, Formula wire
values/settlements, nested Rows/Blocks/Lists/Tables, media, and visual values.
Primitive helpers enforce exact keys, identifiers, finite numbers, booleans,
enums, arrays, JSON budgets, and plain-object boundaries.
