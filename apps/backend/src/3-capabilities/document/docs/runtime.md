# Document runtime and function map

## Construction

[`createDocumentInstance`](../../../1-init/create/document.ts) opens a
`SQLiteDocumentStore(config.projectId, "./data/documents.db")` and calls
`createDocumentCapability` with Rich Text, Formula, the Formula resolver,
Derived Outputs, internal jobs, Logger, configured Document options, and
trusted `config.userId` attribution.

[`createDocumentCapability`](../application/documentService.ts) returns the
private `DocumentService` behind the public `DocumentCapability` interface.
Startup registers internal intents and public endpoints, then invokes
`recoverPendingAttempts()` before listening.

## Public `DocumentCapability` methods

### `command(request)`

Rejects the reserved `$document-internal$:` request-ID prefix, checks any
existing delegated claim for consistent request reuse, dispatches all seven
command variants to their specialized handlers, and logs command type,
request ID, and duration.

### `query(request)`

- `document.list`: store pagination, optional lifecycle, service page size 100.
- `document.load`: reconstruct current/historical snapshot and fetch each exact
  referenced prompt revision.
- `document.history`: verifies the head then returns paged recent ChangeSets.
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
- `compact(documentId)`: reconstructs a configured cutoff and current head,
  appends Bases only if the head revision still matches, then prunes retained
  history/terminal attempts.

## Command handlers and supporting service functions

- `create`: canonical request digest; replay check; existence check; blank
  snapshot/defaults; full validation; atomic revision-zero commit.
- `submit`: requires operations, rejects caller-created Prompt content and
  internal output adoption, then calls `mutate`.
- `mutate`: replay check; load head; optional conservative disjoint rebase;
  reduce/validate; assign revision; create ChangeSet/head/fact/formula attempts;
  compute identity and prompt-ownership transitions; atomic store CAS; dispatch
  Formula/compaction intents.
- `compensate`: requires exact current expected revision, retained target and
  contiguous intervening tail, and disjoint touched IDs; applies retained
  inverse as a new compensating ChangeSet.
- `requestPromptCreation`: reserves a new Block identity with a dry-run divider
  insertion, persists attempt + receipt, and dispatches compute.
- `updatePromptDefinition`: atomically freezes a target output in a delegated
  claim, calls keyed Derived definition update, then completes claim + receipt.
- `requestPromptRefresh`: freezes exact Block/output/applied revision and
  persists attempt + receipt before dispatch.
- `requestFormulaEvaluation`: freezes exact Rich Text formula expression and
  persists attempt + receipt before dispatch.

Auxiliary service families include prompt-reference collection, request and
snapshot digests, attempt/compaction intent construction, actor attribution,
receipt replay validation, prompt ownership transition derivation, diagnostic
settlement creation, snapshot replay, accepted-fact construction, and stale
attempt marking.

`runStage` owns stage receipts and terminal-state no-op behavior. It retries
stage state/work/receipt actions twice after 10 ms and 50 ms, records typed
failure diagnostics, and keeps a successful-but-unfinished receipt recoverable.
Internal dispatch retries only queue-capacity admission errors with unref'd
exponential backoff from 25 ms capped at 2 seconds; other admission errors are
logged but not retried.

## Default creation functions

[`createService.ts`](../application/createService.ts) exports:

- `DEFAULT_DOCUMENT_PAGE_LAYOUT`: US Letter portrait (12,240 × 15,840 twips),
  1,440-twip margins, decimal page numbers starting at 1;
- `createDefaultDocumentStyles()`: normal/code/quote/visual plus exactly one of
  heading roles 1–6 and defaults for all ten Block kinds;
- `createBlankSnapshot(input)`: representation/revision 1/0, active lifecycle,
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

The full port is in [`documentStore.ts`](../ports/documentStore.ts). Method
families are:

- heads/history: `listHeads`, `getHead`, `getBaseAtOrBefore`, `getChangeSets`,
  `listChangeSets`, `getChangeSet`;
- idempotency/identity: `getSubmission`, `recordSubmission`, `getIdentity`,
  delegated claim get/claim/complete;
- atomic commits: `commitCreation`, revision-CAS `commitMutation`;
- compaction: `appendBaseIfHead`, `pruneHistory`;
- attempts: get variants, list recoverable, create with/without submission,
  update;
- stages: claim, complete, fail, atomic prompt-creation failure, recover running;
- prompt ownership: get by output/Block, register pending, transition, list
  detached;
- outbox: get/list unpublished/mark published.

`SQLiteDocumentStore.close()` additionally closes the adapter, although close
is not part of the `DocumentStore` port and the current Document capability
does not expose shutdown/close.

SQLite enables WAL, foreign keys, 5-second busy timeout, and NORMAL synchronous
mode. Creation and mutation transactions co-commit every canonical side effect.

## Wire decoder families

`decodeDocumentCommand` and `decodeDocumentQuery` own public envelopes and
discriminants. `decodeDocumentOperation(s)` owns operation shape and count.
Value decoders recursively own page, Style, placement, Rich Text, Formula wire
values/settlements, nested Rows/Blocks/Lists/Tables, media, and visual values.
Primitive helpers enforce exact keys, identifiers, finite numbers, booleans,
enums, arrays, JSON budgets, and plain-object boundaries.
