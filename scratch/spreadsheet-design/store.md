# Spreadsheet capability — persistence, history, and durable workflows

## Storage boundary

Spreadsheet owns one dedicated SQLite file:

```text
./data/spreadsheets.db
```

The trusted project ID is supplied only while the runtime is constructed. The
adapter hashes it with SHA-256, truncates the lowercase hexadecimal digest, and
derives every table name from `spreadsheet_<projectHash>`. Raw project text is
never interpolated into SQL. Project and user IDs do not appear in canonical
Workbook state, ChangeSets, command/query payloads, or store method parameters.

An actor ID may be recorded on an accepted fact for attribution; it is not a
storage scope. No endpoint may select a database path, project, table prefix,
or user view.

The adapter owns SQL, transactions, cursors, canonical blob mapping, and
compare-and-swap. Domain reducers and application workflows depend only on the
project-bound `SpreadsheetStore` port.

## What is persisted

One Base contains the complete canonical Workbook at one revision:

```text
WorkbookSnapshot
  ├─ title, lifecycle, metadata, calculation settings
  ├─ sheetOrder
  └─ sheets
       ├─ stable row and column axes
       ├─ sparse canonical Cells and merged spans
       ├─ closed CellContent values and exact computed settlements
       ├─ rules and typed overlays
       └─ RichContent values and their stable atom/mark identities
```

Rows, columns, Cells, spans, formatting, Formula source, accepted values,
Prompt Content references, rules, and overlay definitions are aggregate state.
They are serialized inside Base and ChangeSet blobs rather than split into
mutable projection tables. A historical Workbook therefore reconstructs from
one retained Workbook history without consulting a current normalized grid.

Operational tables persist:

- Workbook heads, Bases, and forward/inverse ChangeSets;
- permanent identity claims and tombstones;
- exact command receipts and Prompt-definition delegated-command claims;
- durable calculation, RichContent FormulaAtom, Prompt, and Data attempts;
- internal compute/settle stage receipts;
- dedicated Prompt-output ownership; and
- accepted-fact outbox rows.

Rebuildable dependency graphs, projection maps, viewport grids, calculation
plans, and coordinate indexes are not canonical persistence.

## Store port

```ts
interface SpreadsheetStore {
  listHeads(
    cursor?: string,
    lifecycle?: WorkbookLifecycle,
    limit?: number,
  ): Promise<{ items: WorkbookHead[]; nextCursor?: string }>;

  getHead(workbookId: WorkbookId): Promise<WorkbookHead | undefined>;
  getBaseAtOrBefore(
    workbookId: WorkbookId,
    revision: number,
  ): Promise<SpreadsheetBase | undefined>;
  getChangeSets(
    workbookId: WorkbookId,
    fromExclusive: number,
    toInclusive: number,
  ): Promise<SpreadsheetChangeSet[]>;
  listChangeSets(
    workbookId: WorkbookId,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: SpreadsheetChangeSet[]; nextCursor?: string }>;
  getChangeSet(
    workbookId: WorkbookId,
    changeSetId: string,
  ): Promise<SpreadsheetChangeSet | undefined>;

  getSubmission(
    workbookId: WorkbookId,
    requestId: string,
  ): Promise<SpreadsheetSubmissionReceipt | undefined>;
  recordSubmission(receipt: SpreadsheetSubmissionReceipt): Promise<void>;

  getDelegatedCommandClaim(
    workbookId: WorkbookId,
    requestId: string,
  ): Promise<SpreadsheetDelegatedCommandClaim | undefined>;
  claimDelegatedCommand(
    claim: SpreadsheetDelegatedCommandClaim,
  ): Promise<DelegatedCommandClaimResult>;
  completeDelegatedCommand(
    claim: SpreadsheetDelegatedCommandClaim,
    receipt: SpreadsheetSubmissionReceipt,
  ): Promise<void>;

  getIdentity(
    workbookId: WorkbookId,
    identityId: string,
  ): Promise<SpreadsheetIdentityLedgerEntry | undefined>;

  commitCreation(commit: SpreadsheetCreationCommit): Promise<void>;
  commitMutation(commit: SpreadsheetMutationCommit): Promise<boolean>;
  commitCompactionIfHead(commit: SpreadsheetCompactionCommit): Promise<boolean>;

  getAttempt(
    workbookId: WorkbookId,
    attemptId: string,
  ): Promise<SpreadsheetAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<SpreadsheetAttempt | undefined>;
  listAttemptsByRequest(
    workbookId: WorkbookId,
    kind: SpreadsheetAttempt["kind"],
    requestId: string,
  ): Promise<SpreadsheetAttempt[]>;
  getActiveCellContentAttempt(
    workbookId: WorkbookId,
    cellId: CellId,
  ): Promise<PromptCellCreationAttempt | DataCellAttachAttempt | undefined>;
  listRecoverableAttempts(): Promise<SpreadsheetAttempt[]>;
  createAttempt(attempt: SpreadsheetAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: SpreadsheetAttempt,
    receipt: SpreadsheetSubmissionReceipt,
  ): Promise<void>;
  updateAttempt(attempt: SpreadsheetAttempt): Promise<void>;

  claimStage(receipt: SpreadsheetStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: SpreadsheetStageReceipt): Promise<void>;
  failStage(receipt: SpreadsheetStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;

  getPromptOutputOwnership(
    outputId: string,
  ): Promise<PromptCellOutputOwnership | undefined>;
  getLivePromptOutputOwnershipByCell(
    workbookId: WorkbookId,
    cellId: CellId,
  ): Promise<PromptCellOutputOwnership | undefined>;
  listPromptOutputOwnershipByCell(
    workbookId: WorkbookId,
    cellId: CellId,
  ): Promise<PromptCellOutputOwnership[]>;
  registerPendingPromptOutput(ownership: PromptCellOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;

  getCommittedFact(factId: string): Promise<SpreadsheetCommittedFact | undefined>;
  listUnpublishedFacts(limit?: number): Promise<SpreadsheetCommittedFact[]>;
  markFactPublished(factId: string, publishedAt: string): Promise<void>;
}
```

There is deliberately no store method that deletes a Derived Output, follows
an external reference to its latest revision, or mutates Structured Data.
Cross-capability work goes through narrow application ports and durable local
admission records.

## Atomic commit contracts

```ts
interface SpreadsheetCreationCommit {
  head: WorkbookHead;
  base: SpreadsheetBase;
  identities: SpreadsheetIdentity[];
  /** Formula work discovered in a non-empty revision-zero snapshot. */
  attempts?: SpreadsheetFormulaAttempt[];
  receipt: SpreadsheetSubmissionReceipt;
  fact: SpreadsheetCommittedFact;
}

interface SpreadsheetMutationCommit {
  expectedRevision: number;
  head: WorkbookHead;
  changeSet: SpreadsheetChangeSet;
  receipt: SpreadsheetSubmissionReceipt;
  fact: SpreadsheetCommittedFact;
  identityTransitions: SpreadsheetIdentityTransitions;
  identityReactivation: "forbid" | "same-kind-compensation";
  /** Formula work discovered by the accepted mutation. */
  attempts?: SpreadsheetFormulaAttempt[];
  /** Formula, Prompt, or Data attempts settled by this mutation. */
  attemptUpdates?: SpreadsheetAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

interface SpreadsheetCompactionCommit {
  workbookId: WorkbookId;
  expectedHeadRevision: number;
  cutoffBase: SpreadsheetBase;
  headBase?: SpreadsheetBase;
  retention: SpreadsheetHistoryRetention;
}
```

`commitCreation` atomically inserts the head, revision-zero Base, all initial
identities, any initial Formula attempts, the command receipt, and the creation
fact. Dispatch occurs only after the transaction commits.

`commitMutation` first performs a compare-and-swap on the head revision. If it
does not update exactly one row, it returns `false` and writes nothing. After a
successful CAS, the same transaction:

1. applies permanent identity transitions;
2. inserts the forward/inverse ChangeSet;
3. inserts newly discovered Formula attempts;
4. settles the current Formula, Prompt, or Data attempt when applicable;
5. transitions Prompt-output ownership;
6. writes the exact command receipt; and
7. appends one accepted fact.

The store never holds a SQLite transaction open while Formula, Rich Text,
Derived Outputs, or the project Formula resolver is called.

`commitCompactionIfHead` is a single head-guarded transaction. It verifies the
frozen head, inserts or verifies the cutoff/head Bases, advances `baseSeq`, and
prunes only history made redundant by those Bases. An unguarded
append-then-prune sequence is forbidden because a concurrent head advance could
create a replay gap.

## Base plus ChangeSet history

Creation is revision `0`: a complete initial Base and no ChangeSet. Each
accepted canonical mutation advances both `revision` and `seq` by one.

```text
Base[30] + ChangeSets[31..42] = WorkbookSnapshot[42]
```

A historical load:

1. selects the newest retained Base at or before the requested revision;
2. requires a contiguous ChangeSet tail through that revision;
3. applies normalized operations through the pure reducer;
4. checks every stored prior/revision relation; and
5. verifies the resulting semantic digest.

Missing Base coverage or a discontinuous tail returns `history_pruned` rather
than guessing from the current Workbook.

```ts
interface SpreadsheetBase {
  representationVersion: 1;
  workbookId: WorkbookId;
  baseSeq: number;
  snapshot: WorkbookSnapshot;
  semanticDigest: string;
  createdAt: string;
}
```

## Canonical serialization

Snapshots, operations, command results, attempt subtype data, stage results,
and touched-ID lists use deterministic canonical JSON with sorted object keys.
Semantic digests use SHA-256 over canonical semantic bytes. Operational fields
such as timestamps, retry diagnostics, outbox publication, and SQLite row IDs
do not enter the Workbook semantic digest.

Every blob is decoded through Spreadsheet-owned mappers and validated before
domain use. Unknown representation versions, non-finite numbers, malformed
Formula source, invalid attempt subtypes, bad stable references, and
non-canonical RichContent fail closed.

## Idempotency and delegated Prompt-definition commands

```ts
interface SpreadsheetSubmissionReceipt {
  workbookId: WorkbookId;
  requestId: string;
  requestDigest: string;
  result: SpreadsheetCommandResult;
  createdAt: string;
}

interface SpreadsheetDelegatedCommandClaim {
  workbookId: WorkbookId;
  requestId: string;
  requestDigest: string;
  commandKind: "prompt-content.update-definition";
  targetOutputId: string;
  frozenDefinitionRevision: number;
  externalIdempotencyKey: string;
  frozenRequest: PromptDefinitionUpdate;
  state: "pending" | "completed";
  externalResult?: PromptDefinitionUpdateResult;
  createdAt: string;
  updatedAt: string;
}
```

Receipts are keyed by `(workbookId, requestId)`. An identical retry returns the
stored typed result. Reuse with a different canonical command digest returns
`idempotency_mismatch`.

Cross-database mutations cannot share Spreadsheet's SQLite transaction. Prompt
definition/stabilization updates therefore first persist a delegated-command
claim containing the frozen output ID and definition revision, canonical
request digest, and Derived Outputs idempotency key. The application may then
call the narrow Derived Outputs port without holding a Spreadsheet transaction.
Completion records the external result and exact Spreadsheet receipt atomically.
A pending claim is safely resumed by an identical retry.

Formula evaluation, Prompt create/refresh, and Data attach/refresh use durable
attempts and internal stages instead. `data.promote` is not initially
available: Structured Data does not yet expose keyed declaration or
caller-supplied identity, so promotion cannot be made crash-safe across the two
SQLite files.

## Permanent identity ledger

All Workbook-owned stable IDs are unique for the lifetime of a Workbook:

- Sheet, row, column, and Cell IDs;
- rule and overlay IDs, including overlay-owned semantic child IDs;
- RichContent atom and mark IDs; and
- any future stable projection/materialization IDs.

Deleting an object tombstones its identity. Ordinary insertion cannot reuse a
tombstone even after ChangeSet pruning. Exact compensation may reactivate the
same ID only with the same identity kind and exact stored inverse. This keeps
stale requests, Formula targets, Prompt ownership, and old references from
silently attaching to unrelated content.

## Durable attempts

```ts
type SpreadsheetAttemptState =
  | "requested"
  | "computing"
  | "proposed"
  | "settled"
  | "unchanged"
  | "stale"
  | "failed";

interface SpreadsheetAttemptBase {
  id: string;
  workbookId: WorkbookId;
  clientRequestId: string;
  requestDigest: string;
  frozenWorkbookRevision: number;
  originChangeSetId?: string;
  state: SpreadsheetAttemptState;
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface FrozenGridFormula {
  sheetId: SheetId;
  cellId: CellId;
  source: SpreadsheetFormulaSource;
  contentFingerprint: CellContentFingerprint;
  gridDependencyManifest: StableCellOrRangeRef[];
  projectBindingIds: string[];
}

interface GridCalculationAttempt extends SpreadsheetAttemptBase {
  kind: "calculation";
  scope: { kind: "workbook" } | { kind: "cells"; cellIds: CellId[] };
  formulas: FrozenGridFormula[];
  resolverSnapshotDigest?: string;
  candidateOperations?: SpreadsheetOperation[];
}

interface RichContentFormulaEvaluationAttempt extends SpreadsheetAttemptBase {
  kind: "rich-formula-evaluation";
  target: { kind: "cell-rich-content"; sheetId: SheetId; cellId: CellId };
  formulaAtomId: string;
  frozenExpression: string;
  frozenExpressionDigest: string;
  resolverSnapshotDigest?: string;
  candidateOperations?: RichTextOperation[];
}

interface PromptCellCreationAttempt extends SpreadsheetAttemptBase {
  kind: "prompt-content-create";
  sheetId: SheetId;
  cellId: CellId;
  /** Complete frozen Cell shell except the eventual exact output ref. */
  cell: PromptContentCellShell;
  definition: PromptDefinition;
  candidateOutputId?: string;
  candidateHeadRevision?: number;
}

interface PromptCellRefreshAttempt extends SpreadsheetAttemptBase {
  kind: "prompt-content-refresh";
  sheetId: SheetId;
  cellId: CellId;
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

interface DataCellAttachAttempt extends SpreadsheetAttemptBase {
  kind: "data-cell-attach";
  sheetId: SheetId;
  cellId: CellId;
  cell: DataCellShell;
  bindingId: string;
  /** Optional caller constraint; function values are always rejected. */
  expectedValueKind?: NonFunctionFormulaWireKind;
  /** Required for structured values and absent for scalar values. */
  orientation?: ProjectionOrientation;
  tracking: "pinned" | "follow-head";
  resolverSnapshotDigest?: string;
  candidate?: DataCellSettlementCandidate;
}

interface DataCellRefreshAttempt extends SpreadsheetAttemptBase {
  kind: "data-cell-refresh";
  sheetId: SheetId;
  cellId: CellId;
  bindingId: string;
  frozenOwnerRevision: number;
  frozenValueDigest: string;
  resolverSnapshotDigest?: string;
  candidate?: DataCellSettlementCandidate;
}

type SpreadsheetFormulaAttempt =
  | GridCalculationAttempt
  | RichContentFormulaEvaluationAttempt;

type SpreadsheetAttempt =
  | SpreadsheetFormulaAttempt
  | PromptCellCreationAttempt
  | PromptCellRefreshAttempt
  | DataCellAttachAttempt
  | DataCellRefreshAttempt;
```

Accepted source/RichContent mutations create required Formula attempts in the
same transaction as their ChangeSet. Deterministic attempt IDs derive from the
originating ChangeSet, target, and Formula identity. Explicit manual
calculation or retry commands create the attempt and returned receipt in one
transaction.

A single command may create several attempts—for example, one RichContent edit
may introduce multiple FormulaAtoms. Command idempotency remains request-scoped,
while attempt idempotency includes kind and exact subject identity. The stable
attempt ID also derives from the originating request/ChangeSet, kind, and
subject; no attempt assumes `clientRequestId` is unique by itself.

A calculation attempt freezes normalized `spreadsheet-formula/v1` source,
stable Cell/range manifests, stable project binding IDs, content fingerprints,
and the complete authored Workbook revision. Concurrent compute builds one
immutable project resolver snapshot, resolves project references by binding ID
without falling back to a display name, and composes them with bindings from
that frozen Workbook. It persists the resolver digest and bounded candidate
settlement operations. Serial settle
reloads the current head and adopts only candidates whose content fingerprints
and required dependencies remain valid.

A RichContent Formula attempt freezes the exact Cell target, FormulaAtom ID,
expression, and digest. Its candidate is only Rich Text's bounded
Formula-settlement operation. Settlement requires that the same Cell, atom, and
expression still exist; stale work never overwrites later authoring.

Prompt creation freezes the Cell identity, coordinate/span, style, and Prompt
definition before declaring one dedicated Derived Output. Refresh freezes the
currently applied output revision. Definition/stabilization update uses the
delegated claim described above. No generic operation may introduce
`prompt-content` or attach an arbitrary `DerivedOutputRef`.

Data attach freezes the Cell shell, stable project binding ID, optional value
kind constraint, and structured-value orientation. Scalar bindings do not have
an orientation or spill. Function bindings are rejected. Data refresh freezes
the Cell's exact binding owner revision
and value digest. Compute selects that binding from one immutable project
Formula resolver snapshot and persists an exact candidate; settle conditionally
adopts the candidate into normal Workbook history. Neither path imports or
calls Structured Data directly.

Prompt creation and Data attach both claim one active content attempt for their
target Cell. The target may be an existing Cell or a proposed new Cell. Later
editing is allowed but makes settlement stale; a second active Prompt/Data
content attempt for that Cell is rejected. If the Cell is new, admission also
consults the permanent identity ledger before freezing its shell.

Active attempts are never pruned. Terminal attempts have a separate bounded
retention policy.

## Stage receipts and recovery

```ts
interface SpreadsheetStageReceipt {
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

type StageClaimResult = "claimed" | "running" | "completed";
```

`claimStage` is insert-or-compare. The same key and digest replays stored state;
divergent reuse fails. A completed stage never executes again. External effects
and authoritative attempt candidates are durable before a receipt completes.

Startup changes interrupted `running` stages into retryable failed receipts,
lists every non-terminal attempt, and redispatches compute or settlement from
its durable state. Small bounded write retries cover stage admission, candidate
recording, failure recording, and completion.

If Prompt creation declared an output but cannot settle, failure handling marks
the ownership record historical and updates the attempt and stage atomically.

## Dedicated Prompt-output ownership

```ts
interface PromptCellOutputOwnership {
  outputId: string;
  workbookId: WorkbookId;
  sheetId: SheetId;
  cellId: CellId;
  creationAttemptId?: string;
  state: "pending" | "attached" | "historical";
  attachedRevision?: number;
  historicalSinceRevision?: number;
  createdAt: string;
  updatedAt: string;
}
```

Declaration first registers `pending` ownership. Successful settlement changes
it to `attached` in the same transaction as Cell creation/content replacement
and attempt settlement. Replacing Prompt Content, or deleting its Cell, row,
column, or Sheet, changes affected records to `historical` in the same Workbook
mutation.

`outputId` is globally unique in the local ledger. A Cell may have multiple
historical ownership rows across separate Prompt lifetimes, but at most one
`pending` or `attached` row. Dedicated Prompt creation always declares a fresh
output; refresh and definition update retain the same output. This prevents
sharing while allowing a Cell to leave Prompt Content and later become new
Prompt Content.

Exact compensation may reattach an older historical output only when the Cell
has no different live Prompt ownership. Otherwise compensation conflicts rather
than silently detaching the newer output.

Historical ownership is local audit/history state only. Spreadsheet never calls
`DerivedOutputs.delete`, never schedules output garbage collection, and never
decides whether an output referenced only by historical revisions can be
removed. Derived Outputs owns that policy.

## Exact external references

Spreadsheet does not create SQL foreign keys into another capability's file.
Canonical references are immutable and self-describing:

- a Prompt Content Cell stores an exact `DerivedOutputRef` revision;
- a direct Data Cell stores the project resolver binding ID, exact owner
  revision, value digest, tracking policy, and—only for a structured
  value—projection orientation. Its settlement contains the exact serializable
  non-function value used by the Workbook revision; and
- an Image overlay, if supported by the canonical model, stores an immutable
  General Files snapshot reference rather than a mutable URL or “latest” file.

Current-head queries may separately report freshness by comparing an external
head with a canonical exact ref. They do not rewrite the loaded snapshot or
silently substitute the latest external value. Historical load requires no
external call to reproduce accepted Cell values.

## Accepted-fact outbox

```ts
interface SpreadsheetCommittedFact {
  factId: string;
  kind: "spreadsheet.created" | "spreadsheet.changed" | "spreadsheet.compensated";
  workbookId: WorkbookId;
  revision: number;
  changeSetId?: string;
  actorId?: string;
  origin: "interactive" | "agent" | "automation";
  operationTypes: string[];
  sourceSemanticDigest: string;
  occurredAt: string;
}
```

One fact is written atomically with Workbook creation or mutation. Rejected
calls, identical retries, concurrent compute, and Prompt definition-only
updates produce no Workbook fact. Formula, Prompt, or Data settlement that
appends a Workbook ChangeSet writes an ordinary changed fact.

Outbox publication state is operational and excluded from semantic digests.
There is no Activity constructor dependency. Integration wiring may list and
publish facts later; Spreadsheet does not own an Activity feed, Presence, or
Activity's undo endpoint.

## Logical SQL schema

The adapter substitutes trusted project-prefixed names for every logical name
below.

```sql
CREATE TABLE workbooks (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  lifecycle         TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision          INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq          INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest   TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (base_seq <= revision)
);

CREATE INDEX workbook_heads_lifecycle_updated
  ON workbooks(lifecycle, updated_at DESC, id);

CREATE TABLE command_receipts (
  workbook_id     TEXT NOT NULL,
  request_id      TEXT NOT NULL,
  request_digest  TEXT NOT NULL,
  result_json     BLOB NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (workbook_id, request_id),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE TABLE delegated_command_claims (
  workbook_id          TEXT NOT NULL,
  request_id           TEXT NOT NULL,
  request_digest       TEXT NOT NULL,
  command_kind         TEXT NOT NULL
    CHECK (command_kind = 'prompt-content.update-definition'),
  target_output_id     TEXT NOT NULL,
  external_key         TEXT NOT NULL,
  frozen_request_json  BLOB NOT NULL,
  external_result_json BLOB,
  state                TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (workbook_id, request_id),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE TABLE identity_ledger (
  workbook_id               TEXT NOT NULL,
  identity_id               TEXT NOT NULL,
  identity_kind             TEXT NOT NULL,
  state                     TEXT NOT NULL
    CHECK (state IN ('active', 'tombstoned')),
  first_revision            INTEGER NOT NULL CHECK (first_revision >= 0),
  last_transition_revision  INTEGER NOT NULL
    CHECK (last_transition_revision >= first_revision),
  tombstoned_revision       INTEGER CHECK (tombstoned_revision >= 0),
  PRIMARY KEY (workbook_id, identity_id),
  CHECK (
    (state = 'active' AND tombstoned_revision IS NULL) OR
    (state = 'tombstoned' AND tombstoned_revision IS NOT NULL)
  ),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE INDEX identity_ledger_state
  ON identity_ledger(workbook_id, state, identity_id);

CREATE TABLE bases (
  workbook_id             TEXT NOT NULL,
  base_seq                INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version  INTEGER NOT NULL CHECK (representation_version = 1),
  snapshot_json           BLOB NOT NULL,
  semantic_digest         TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  PRIMARY KEY (workbook_id, base_seq),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE INDEX bases_lookup ON bases(workbook_id, base_seq DESC);

CREATE TABLE change_sets (
  id                                 TEXT PRIMARY KEY,
  workbook_id                        TEXT NOT NULL,
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
  UNIQUE (workbook_id, revision),
  UNIQUE (workbook_id, seq),
  CHECK (seq = revision),
  CHECK (revision = prior_revision + 1),
  CHECK (
    (compensation_intent IS NULL AND compensation_target_change_set_id IS NULL) OR
    (compensation_intent IS NOT NULL AND compensation_target_change_set_id IS NOT NULL)
  ),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE INDEX change_sets_recent ON change_sets(workbook_id, seq DESC);

CREATE TABLE activity_outbox (
  fact_id                 TEXT PRIMARY KEY,
  kind                    TEXT NOT NULL,
  workbook_id             TEXT NOT NULL,
  revision                INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id           TEXT,
  actor_id                TEXT,
  origin                  TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operation_types_json    BLOB NOT NULL,
  source_semantic_digest  TEXT NOT NULL,
  occurred_at             TEXT NOT NULL,
  published_at            TEXT,
  UNIQUE (workbook_id, revision),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE INDEX activity_outbox_unpublished
  ON activity_outbox(occurred_at, fact_id)
  WHERE published_at IS NULL;

CREATE TABLE attempts (
  id                        TEXT PRIMARY KEY,
  workbook_id               TEXT NOT NULL,
  kind                      TEXT NOT NULL CHECK (kind IN (
    'calculation',
    'rich-formula-evaluation',
    'prompt-content-create',
    'prompt-content-refresh',
    'data-cell-attach',
    'data-cell-refresh'
  )),
  client_request_id         TEXT NOT NULL,
  request_digest            TEXT NOT NULL,
  frozen_workbook_revision  INTEGER NOT NULL CHECK (frozen_workbook_revision >= 0),
  origin_change_set_id      TEXT,
  subject_kind              TEXT NOT NULL,
  subject_id                TEXT NOT NULL,
  state                     TEXT NOT NULL CHECK (state IN (
    'requested', 'computing', 'proposed', 'settled',
    'unchanged', 'stale', 'failed'
  )),
  subtype_json              BLOB NOT NULL,
  settled_change_set_id     TEXT,
  diagnostic_json           BLOB,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (workbook_id, kind, client_request_id, subject_id),
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
);

CREATE INDEX attempts_state ON attempts(kind, state, updated_at, id);
CREATE INDEX attempts_subject
  ON attempts(workbook_id, subject_kind, subject_id, updated_at DESC);

CREATE UNIQUE INDEX attempts_active_cell_content
  ON attempts(workbook_id, subject_id)
  WHERE kind IN ('prompt-content-create', 'data-cell-attach')
    AND state IN ('requested', 'computing', 'proposed');

CREATE TABLE prompt_output_ownership (
  output_id             TEXT PRIMARY KEY,
  workbook_id           TEXT NOT NULL,
  sheet_id              TEXT NOT NULL,
  cell_id               TEXT NOT NULL,
  creation_attempt_id   TEXT UNIQUE,
  state                 TEXT NOT NULL
    CHECK (state IN ('pending', 'attached', 'historical')),
  attached_revision     INTEGER,
  historical_since_revision INTEGER,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE,
  FOREIGN KEY (creation_attempt_id) REFERENCES attempts(id) ON DELETE SET NULL
);

CREATE INDEX prompt_ownership_state
  ON prompt_output_ownership(workbook_id, state, cell_id);

CREATE UNIQUE INDEX prompt_ownership_live_cell
  ON prompt_output_ownership(workbook_id, cell_id)
  WHERE state IN ('pending', 'attached');

CREATE TABLE stage_receipts (
  attempt_id       TEXT NOT NULL,
  stage            TEXT NOT NULL CHECK (stage IN ('compute', 'settle')),
  idempotency_key  TEXT NOT NULL,
  request_digest   TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('running', 'completed', 'failed')),
  result_json      BLOB,
  diagnostic_json  BLOB,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (attempt_id, stage),
  UNIQUE (idempotency_key),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
);

CREATE INDEX stage_receipts_state
  ON stage_receipts(state, updated_at, attempt_id);
```

SQLite enables WAL, foreign keys, a bounded busy timeout, and normal
synchronous mode. Dynamic identifiers are produced only by the trusted
project-hash function.

`compensation_target_change_set_id`, outbox `change_set_id`, and attempt
origin/settlement ChangeSet IDs are immutable audit addresses rather than SQL
foreign keys. Those operational records may outlive the configured ChangeSet
tail; a foreign key would either prevent bounded pruning or erase the address.
The application validates the target while it is retained and returns
`history_pruned` when an operation requires content that is no longer present.

## Sparse storage and rebuildable projections

The canonical snapshot contains only occupied Cells. Empty coordinates do not
become SQL rows or placeholder objects. Row and column axes still describe the
available grid, while the sparse Cell record describes authored content.

Merged spans remain part of their canonical Cell objects. The adapter does not
create a mutable span table. On decode, Spreadsheet validates rectangularity,
contiguity under current `rowOrder`/`columnOrder`, anchor agreement, and
non-overlap.

Dependency graphs, calculated-coordinate lookup maps, range projections, and
viewport reads may be cached by revision. Each cache is discardable and must be
reproducible from the loaded immutable snapshot; none may become an alternative
write authority.

## Compaction and retention

```ts
interface SpreadsheetHistoryRetention {
  retainedBaseCount: number;             // default: 5
  retainedChangeSetCount: number;        // default: 1000
  retainedTerminalAttemptCount: number;  // default: 1000
}
```

Compaction runs through the serial queue:

1. freeze and reconstruct the exact current head;
2. derive the earliest retained ChangeSet cutoff;
3. construct a Base at that cutoff and, when different, at the head;
4. atomically verify the head, store the Bases, advance `baseSeq`, and prune;
5. retain a continuous ChangeSet tail from the cutoff Base through the head;
6. retain permanent identities, command/delegated claims, Prompt ownership,
   active attempts, configured recent terminal attempts, and outbox facts.

Compaction changes neither logical revision nor semantic digest. Active
attempts are never pruned. Historical Prompt ownership is not a garbage-collection
queue and is not removed merely because Workbook history was compacted.

## Canonical, operational, and rebuildable state

| Canonical Workbook state | Durable operational state | Rebuildable projection |
|---|---|---|
| sheets, stable axes, sparse Cells, spans | heads, Bases, ChangeSets, receipts | viewport/grid lookup |
| Formula source and accepted values | calculation attempts and stage receipts | dependency graph and plan |
| RichContent Formula atoms and accepted atom values | per-atom attempts | RichContent dependency lookup |
| exact Data binding revision/digest and accepted value | Data attach/refresh attempts | freshness comparison |
| exact Prompt output ref | Prompt attempts and output ownership | current freshness display |
| styles, validation, rules, overlays | identity ledger | resolved conditional style |
| exact inverse operations | accepted-fact outbox | Activity feed rows |
