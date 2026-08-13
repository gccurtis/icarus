# Document capability — store, history, and durable stages

## Project-scoped runtime

Document is scoped only by `projectId`. It has no user-scoped storage view and
no request can select a project, database, or table prefix.

For the current repository, Document follows the existing capability pattern:
it opens its own SQLite database file and hashes the configured project ID into
trusted physical table names.

```ts
const store = new SQLiteDocumentStore(
  config.projectId,
  "./data/documents.db",
);

const documents = createDocumentCapability(store, dependencies, options);
```

```ts
const projectPrefix = sha256(projectId).slice(0, 16);
const documentsTable = `doc_${projectPrefix}_documents`;
```

All logical SQL names below receive the `doc_${projectPrefix}_` prefix inside
the adapter. `projectId` is consumed by construction and never appears in a
Document snapshot, operation, ChangeSet, endpoint DTO, or method argument.

An optional `actorId` may be injected as attribution for accepted facts. It is
metadata, not a storage scope. A future consolidation into one shared Platform
Database can replace the SQLite adapter without changing the Document domain or
store port.

## Base plus ChangeSet history

The head row holds current metadata and the active `baseSeq`. A Base is a
complete canonical snapshot at one revision. Current state is reconstructed by
replaying the contiguous ChangeSet tail over the active Base.

```text
head: revision 42, baseSeq 30

Base[30] ── apply ChangeSets 31…42 ──> DocumentSnapshot[42]
```

Creation is revision zero: one initial Base, no ChangeSet, and one accepted
creation fact.

```ts
interface DocumentBase {
  representationVersion: 1;
  documentId: string;
  baseSeq: number;
  snapshot: DocumentSnapshot;
  semanticDigest: string;
  createdAt: string;
}

interface DocumentChangeSet {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;                  // always equals revision
  origin: "interactive" | "agent" | "automation";
  operations: DocumentOperation[];
  inverseOperations: DocumentOperation[];
  touchedIds: string[];
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  semanticDigest: string;
  createdAt: string;
}
```

The Base includes title, lifecycle, page layout, Style Registry, Rows, Blocks,
Rich Content, visual dimensions, Prompt references, and Formula atom state. An
exact historical load never combines historical content with current metadata
or current styles.

## Store port

```ts
interface DocumentStore {
  // Heads and snapshots
  list(cursor?: string, lifecycle?: DocumentHead["lifecycle"]): Promise<DocumentPage>;
  getHead(documentId: string): Promise<DocumentHead | undefined>;
  load(documentId: string, revision?: number): Promise<DocumentSnapshot | undefined>;

  // History
  getChangeSets(
    documentId: string,
    fromExclusive: number,
    toInclusive: number,
  ): Promise<DocumentChangeSet[]>;

  // Idempotency
  getSubmission(
    documentId: string,
    clientRequestId: string,
  ): Promise<DocumentSubmissionReceipt | undefined>;
  getIdentity(
    documentId: string,
    identityId: string,
  ): Promise<DocumentIdentityLedgerEntry | undefined>;

  // Atomic canonical commits
  commitCreation(commit: DocumentCreationCommit): Promise<void>;
  commitMutation(commit: DocumentMutationCommit): Promise<boolean>;

  // Compaction
  appendBaseIfHead(
    documentId: string,
    expectedHeadRevision: number,
    base: DocumentBase,
  ): Promise<boolean>;
  pruneHistory(
    documentId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number,
  ): Promise<void>;

  // Durable async attempts
  getAttempt(documentId: string, attemptId: string): Promise<DocumentAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<DocumentAttempt | undefined>;
  getAttemptByRequest(
    documentId: string,
    kind: DocumentAttempt["kind"],
    clientRequestId: string,
  ): Promise<DocumentAttempt | undefined>;
  createAttempt(attempt: DocumentAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: DocumentAttempt,
    receipt: DocumentSubmissionReceipt,
  ): Promise<void>;
  updateAttempt(attempt: DocumentAttempt): Promise<void>;

  // Dedicated Prompt-output ownership. Attachment transitions supplied to
  // commitMutation are atomic with the corresponding Document revision.
  getPromptOutputOwnership(outputId: string): Promise<PromptOutputOwnership | undefined>;
  registerPendingPromptOutput(ownership: PromptOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;
  listDetachedPromptOutputs(limit?: number): Promise<PromptOutputOwnership[]>;

  // Accepted-fact outbox
  getCommittedFact(factId: string): Promise<DocumentCommittedFact | undefined>;
  listUnpublishedFacts(cursor?: string): Promise<DocumentCommittedFactPage>;
  markFactPublished(factId: string, publishedAt: string): Promise<void>;

  // Idempotent internal stages
  claimStage(receipt: DocumentStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: DocumentStageReceipt): Promise<void>;
  failStage(receipt: DocumentStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;
}
```

`commitCreation` atomically writes the head, revision-zero Base, initial
identity claims, command receipt, and creation outbox fact. `commitMutation`
atomically updates the head with compare-and-swap, applies identity
additions/tombstones, appends the ChangeSet, stores the command receipt, writes
the accepted fact, and attaches or detaches any Prompt-output ownership rows
implied by that exact before/after transition.

Async attempt and stage methods support short transactions around each stage.
No SQLite transaction is held while calling Derived Outputs, Formula, or any
provider. Final Prompt-creation failure uses one local transaction to detach
any still-pending output and mark both the attempt and stage failed. If that
transaction cannot commit, none of those terminal transitions is visible and
startup recovery can reclaim the stage.

## Durable attempts

Prompt creation, Prompt refresh, and Formula evaluation share one operational
envelope while retaining typed frozen and candidate payloads.

```ts
type DocumentAttempt =
  | PromptCreationAttempt
  | PromptRefreshAttempt
  | FormulaEvaluationAttempt;

interface AttemptBase {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  blockId: string;
  frozenDocumentRevision: number;
  state:
    | "requested"
    | "computing"
    | "proposed"
    | "settled"
    | "unchanged"
    | "stale"
    | "failed";
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface PromptCreationAttempt extends AttemptBase {
  kind: "prompt-create";
  styleId: string;
  presentation?: BlockPresentationOverride;
  placement: BlockPlacement;
  definition: {
    prompt: string;
    contextEntries: ContextEntry[];
    stabilisationText: string;
  };
  candidateOutputId?: string;
  candidateHeadRevision?: number;
}

interface PromptRefreshAttempt extends AttemptBase {
  kind: "prompt-refresh";
  promptBlockId: string;
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

interface FormulaEvaluationAttempt extends AttemptBase {
  kind: "formula-evaluation";
  atomId: string;
  frozenExpressionDigest: string;
  resolverSnapshotDigest?: string;
  candidateResult?: RichTextFormulaSettlement;
}

interface RichTextFormulaSettlement {
  frozenExpressionDigest: string;
  resolverSnapshotDigest: string;
  evaluationDigest?: string;
  operations: RichTextOperation[];
}

interface PromptOutputOwnership {
  outputId: string;
  documentId: string;
  blockId: string;
  creationAttemptId?: string;
  state: "pending" | "attached" | "detached";
  attachedRevision?: number;
  detachedRevision?: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentStageReceipt {
  attemptId: string;
  stage: "compute" | "settle";
  idempotencyKey: string;
  requestDigest: string;
  state: "running" | "completed" | "failed";
  result?: unknown;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface PromptCreationFailureCommit {
  attempt: PromptCreationAttempt & { state: "failed" };
  receipt: DocumentStageReceipt & { state: "failed" };
}
```

Derived Output definitions, stabilization text, output revisions, and refresh
internals remain in the Derived Outputs database. Document persists the frozen
reference and head revision needed for adoption plus a small ownership row. The
ownership row does not copy Derived Output content; it enforces one dedicated
output per Prompt Block and supports safe detachment and garbage collection.

Formula parsing, resolver values, and evaluation semantics remain external.
Document persists enough operational data to retry and settle the Rich Text
Formula atom conditionally.

## Logical SQL schema

The adapter substitutes its trusted project prefix for every logical name.

```sql
CREATE TABLE documents (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  lifecycle        TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision         INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq         INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest  TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK (base_seq <= revision)
);

CREATE INDEX document_heads_lifecycle_updated
  ON documents(lifecycle, updated_at DESC, id);

CREATE TABLE document_command_receipts (
  document_id      TEXT NOT NULL,
  request_id       TEXT NOT NULL,
  request_digest   TEXT NOT NULL,
  result_json      BLOB NOT NULL,
  created_at       TEXT NOT NULL,
  PRIMARY KEY (document_id, request_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE document_identity_ledger (
  document_id              TEXT NOT NULL,
  identity_id              TEXT NOT NULL,
  identity_kind            TEXT NOT NULL,
  state                    TEXT NOT NULL
    CHECK (state IN ('active', 'tombstoned')),
  first_revision           INTEGER NOT NULL CHECK (first_revision >= 0),
  last_transition_revision INTEGER NOT NULL,
  tombstoned_revision      INTEGER,
  PRIMARY KEY (document_id, identity_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE document_bases (
  document_id            TEXT NOT NULL,
  base_seq               INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version INTEGER NOT NULL,
  snapshot_json          BLOB NOT NULL,
  semantic_digest        TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  PRIMARY KEY (document_id, base_seq),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX document_bases_lookup
  ON document_bases(document_id, base_seq DESC);

CREATE TABLE document_change_sets (
  id                                 TEXT PRIMARY KEY,
  document_id                        TEXT NOT NULL,
  client_request_id                  TEXT NOT NULL,
  request_digest                     TEXT NOT NULL,
  authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
  prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
  revision                           INTEGER NOT NULL CHECK (revision > 0),
  seq                                INTEGER NOT NULL CHECK (seq > 0),
  origin                             TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operations_json                    BLOB NOT NULL,
  inverse_operations_json            BLOB NOT NULL,
  touched_ids_json                   BLOB NOT NULL,
  compensation_intent                TEXT
    CHECK (compensation_intent IN ('undo', 'redo')),
  compensation_target_change_set_id  TEXT,
  semantic_digest                    TEXT NOT NULL,
  created_at                         TEXT NOT NULL,
  UNIQUE (document_id, seq),
  UNIQUE (document_id, revision),
  CHECK (seq = revision),
  CHECK (revision = prior_revision + 1),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (compensation_target_change_set_id)
    REFERENCES document_change_sets(id)
);

CREATE INDEX document_changes_recent
  ON document_change_sets(document_id, seq DESC);

CREATE INDEX document_changes_compensation_target
  ON document_change_sets(compensation_target_change_set_id)
  WHERE compensation_target_change_set_id IS NOT NULL;

CREATE TABLE document_activity_outbox (
  fact_id           TEXT PRIMARY KEY,
  fact_kind         TEXT NOT NULL
    CHECK (fact_kind IN ('document.created', 'document.changed', 'document.compensated')),
  document_id       TEXT NOT NULL,
  revision          INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id     TEXT,
  actor_id          TEXT,
  origin            TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operation_types   BLOB NOT NULL,
  semantic_digest   TEXT NOT NULL,
  occurred_at       TEXT NOT NULL,
  published_at      TEXT,
  UNIQUE (document_id, revision),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id) REFERENCES document_change_sets(id)
);

CREATE INDEX document_activity_unpublished
  ON document_activity_outbox(occurred_at, fact_id)
  WHERE published_at IS NULL;

CREATE TABLE document_attempts (
  id                        TEXT PRIMARY KEY,
  document_id               TEXT NOT NULL,
  kind                      TEXT NOT NULL
    CHECK (kind IN ('prompt-create', 'prompt-refresh', 'formula-evaluation')),
  client_request_id         TEXT NOT NULL,
  request_digest            TEXT NOT NULL,
  block_id                  TEXT NOT NULL,
  frozen_document_revision  INTEGER NOT NULL CHECK (frozen_document_revision >= 0),
  state                     TEXT NOT NULL
    CHECK (state IN (
      'requested', 'computing', 'proposed', 'settled',
      'unchanged', 'stale', 'failed'
    )),
  frozen_json               BLOB NOT NULL,
  candidate_json            BLOB,
  diagnostic_json           BLOB,
  settled_change_set_id     TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (document_id, kind, client_request_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_change_set_id) REFERENCES document_change_sets(id)
);

CREATE INDEX document_attempts_state
  ON document_attempts(kind, state, updated_at, id);

CREATE INDEX document_attempts_block
  ON document_attempts(document_id, block_id, updated_at DESC);

CREATE TABLE document_prompt_outputs (
  output_id            TEXT PRIMARY KEY,
  document_id          TEXT NOT NULL,
  block_id             TEXT NOT NULL,
  creation_attempt_id  TEXT UNIQUE,
  state                TEXT NOT NULL
    CHECK (state IN ('pending', 'attached', 'detached')),
  attached_revision    INTEGER CHECK (attached_revision > 0),
  detached_revision    INTEGER CHECK (detached_revision > 0),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE (document_id, block_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (creation_attempt_id) REFERENCES document_attempts(id)
    ON DELETE SET NULL
);

CREATE INDEX document_prompt_outputs_detached
  ON document_prompt_outputs(state, updated_at, output_id)
  WHERE state = 'detached';

CREATE TABLE document_stage_receipts (
  attempt_id       TEXT NOT NULL,
  stage            TEXT NOT NULL CHECK (stage IN ('compute', 'settle')),
  idempotency_key  TEXT NOT NULL UNIQUE,
  request_digest   TEXT NOT NULL,
  state            TEXT NOT NULL
    CHECK (state IN ('running', 'completed', 'failed')),
  result_json      BLOB,
  diagnostic_json  BLOB,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (attempt_id, stage),
  FOREIGN KEY (attempt_id) REFERENCES document_attempts(id) ON DELETE CASCADE
);

CREATE INDEX document_stage_state
  ON document_stage_receipts(state, updated_at, attempt_id);
```

SQLite enables WAL, foreign keys, a bounded busy timeout, and normal
synchronous mode consistently with the other capability stores. JSON values
use canonical deterministic key ordering. Semantic and request digests use
SHA-256 over canonical bytes.

## Cross-database Derived Output calls

Document and Derived Outputs do not share a transaction. The boundary is
designed around that fact:

- Prompt creation calls an idempotent Derived Outputs declaration using the
  Prompt-create attempt ID as its idempotency key. A crash after declaration
  recovers the same output instead of creating a second one.
- Definition/stabilization updates mutate only Derived Outputs. Document first
  validates the Prompt Block reference, then delegates with a key derived from
  `(documentId, requestId)`. Derived Outputs is idempotent on that key by
  itself, so a crash after the update commits there but before Document's own
  submission receipt commits simply replays the same result on retry; no local
  claim on the target is kept. The one case this does not cover is the Prompt
  Block being deleted before the retry, in which case the retry fails cleanly
  instead of resuming.
- Refresh may publish a Derived Output revision before Document adoption. A
  keyed refresh replays its exact result. A failed or stale Document settlement
  leaves the Block on its prior exact revision; no rollback of Derived Outputs
  is required.
- Prompt creation registers the returned output as `pending`, then the serial
  settlement attaches it in the same Document transaction that inserts the
  Block. A stale or permanently failed settlement marks it `detached`.
- Deleting or replacing a Prompt Block atomically detaches its ownership row.
  Undo may reattach that same output while the inverse ChangeSet is retained.

No foreign key crosses the two SQLite files.

## Retained identity ledger

Every canonical identity is claimed at Document creation or at the mutation
revision that first introduces it. Deletion tombstones rather than removes the
claim. An ordinary operation cannot reactivate a tombstone or reuse the same ID
under another identity kind. Exact undo/redo compensation may reactivate only
the same kind, preserving the logical identity carried by the retained inverse.
Tombstones are retained indefinitely in representation version 1; a future
reachability-aware maintenance policy may narrow that lifetime without changing
the admission contract.

## History retention

```ts
interface DocumentHistoryRetention {
  retainedBaseCount: number;       // default: 5
  retainedChangeSetCount: number;  // default: 1000
  retainedTerminalAttemptCount: number; // default: 1000
}
```

A revision loads only when a retained Base exists at or before it and the
needed ChangeSet tail is continuous. Otherwise the result is
`history_pruned`.

Terminal attempts may be pruned independently after their associated
ChangeSet and stage receipts are no longer needed for retry. Active requested,
computing, and proposed attempts are never pruned.

A detached Derived Output is not deleted merely because it is absent from the
current snapshot. Before asking Derived Outputs to delete it, a maintenance Job
must prove that no retained Base, forward operation, or inverse operation can
reach its reference. The delete call is idempotent. Until that proof succeeds,
the ownership row and immutable output revisions remain available for history
and compensation.

## Compaction

Compaction runs on the serial queue:

1. Load and replay the exact current head.
2. Reconstruct and append a Base at the configured ChangeSet-retention cutoff.
3. Append the complete current-head Base only if the head revision remains
   unchanged.
4. Advance `baseSeq` in the same short transaction.
5. Prune old Bases, ChangeSets, and terminal attempts while always retaining
   the cutoff Base required to replay the configured recent history tail.

Document dispatches this maintenance Job once the distance from `baseSeq` to
the current revision reaches `retainedChangeSetCount`. A first compaction that
runs later than that threshold remains safe because it materializes the cutoff
snapshot before deleting the earlier ChangeSets.

Compaction changes neither logical revision nor semantic digest.

## Canonical, operational, and rebuildable state

| Canonical Document state | Operational or rebuildable state |
|---|---|
| title, lifecycle, revision | workspace summaries |
| page layout and Style Registry | future page-layout projection |
| Rows, tracks, Blocks, dimensions | rendered geometry |
| RichContent atoms and marks | resolved styling and plain text |
| exact DerivedOutputRef | refresh attempt and current freshness display |
| Prompt-output ownership | detached-output reachability and garbage-collection schedule |
| Formula atom expression and accepted result | evaluation attempt and dependency index |
| Bases and ChangeSets | compaction schedule |
| committed-fact outbox | Activity feed rows and structured logs |
