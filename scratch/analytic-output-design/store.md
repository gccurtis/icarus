# Analytic Output — store and history

## Project-scoped runtime

One Analytic Output store is constructed from the configured project ID. The
project ID selects a trusted table prefix and never appears in public domain
objects or request payloads. The capability uses its own SQLite file initially:

```text
./data/analytic-outputs.db
```

Physical consolidation under the Database platform can replace the adapter
later without changing the store port or aggregate model.

SQLite enables foreign keys, WAL mode, a bounded busy timeout, and the same
synchronous policy as adjacent capability stores. All multi-row mutations use
explicit transactions.

## Store port

```ts
type AnalyticStage = "compute" | "settle";

interface AnalyticHistoryPruneRequest {
  outputId: AnalyticOutputId;
  retainBaseSeqs: number[];
  deleteChangeSetsThroughSeq?: number;
  deleteTerminalAttemptIds: AnalyticAttemptId[];
}

interface AnalyticOutputStore {
  create(input: {
    head: AnalyticOutputHead;
    base: AnalyticOutputBase;
    identities: AnalyticIdentityTransition[];
    receipt: AnalyticOutputCommandReceipt;
    fact: AnalyticOutputCommittedFact;
  }): void;

  getHead(outputId: AnalyticOutputId): AnalyticOutputHead | undefined;
  listHeads(input: {
    lifecycle?: AnalyticOutputLifecycle;
    cursor?: string;
    limit: number;
  }): { items: AnalyticOutputHead[]; nextCursor?: string };

  loadSnapshot(
    outputId: AnalyticOutputId,
    revision?: number,
  ): AnalyticOutputSnapshot | undefined;

  listChangeSets(input: {
    outputId: AnalyticOutputId;
    afterSeqExclusive: number;
    throughSeqInclusive?: number;
  }): AnalyticOutputChangeSet[];

  getChangeSet(
    outputId: AnalyticOutputId,
    changeSetId: string,
  ): AnalyticOutputChangeSet | undefined;

  appendChangeSet(input: {
    expectedHeadRevision: number;
    head: AnalyticOutputHead;
    changeSet: AnalyticOutputChangeSet;
    identityTransitions: AnalyticIdentityTransition[];
    receipt: AnalyticOutputCommandReceipt;
    fact: AnalyticOutputCommittedFact;
  }): boolean;

  getCommandReceipt(
    outputId: AnalyticOutputId,
    requestId: string,
  ): AnalyticOutputCommandReceipt | undefined;

  createMaterializationAttempt(input: {
    expectedHeadRevision: number;
    attempt: AnalyticMaterializationAttempt;
    receipt: AnalyticOutputCommandReceipt;
  }): boolean;

  getAttempt(attemptId: AnalyticAttemptId):
    | AnalyticMaterializationAttempt
    | undefined;

  listRecoverableAttempts(limit: number): AnalyticMaterializationAttempt[];

  claimStage(input: {
    attemptId: AnalyticAttemptId;
    stage: AnalyticStage;
    idempotencyKey: string;
    requestDigest: string;
    staleBefore?: string;
  }): "claimed" | "completed" | "busy";

  storeCandidate(input: {
    attemptId: AnalyticAttemptId;
    candidate: AnalyticMaterializationCandidate;
    receiptResult: unknown;
  }): void;

  failAttempt(input: {
    attemptId: AnalyticAttemptId;
    stage: AnalyticStage;
    diagnostic: AnalyticDiagnostic;
  }): void;

  settleMaterialization(input: {
    attemptId: AnalyticAttemptId;
    materialization: AnalyticMaterialization;
  }): {
    materialization: AnalyticMaterialization;
    pointerAdvanced: boolean;
  };

  getMaterialization(
    outputId: AnalyticOutputId,
    materializationId: AnalyticMaterializationId,
  ): AnalyticMaterialization | undefined;

  listMaterializations(input: {
    outputId: AnalyticOutputId;
    cursor?: string;
    limit: number;
  }): { items: AnalyticMaterialization[]; nextCursor?: string };

  insertBaseIfCurrent(input: {
    outputId: AnalyticOutputId;
    expectedBaseSeq: number;
    base: AnalyticOutputBase;
  }): boolean;

  pruneRetainedHistory(input: AnalyticHistoryPruneRequest): void;
}
```

The SQLite adapter may expose smaller internal methods, but the application
service must have one transactional call for creation, ChangeSet acceptance,
attempt freeze, candidate publication, and final settlement.

## Base plus ChangeSet replay

The head stores revision and current `baseSeq`, not the entire snapshot. Bases
are immutable snapshot checkpoints. To load revision `R`:

1. select the newest Base with `baseSeq <= R`;
2. validate and decode its canonical snapshot;
3. select ChangeSets in ascending sequence from `baseSeq + 1` through `R`;
4. verify contiguous sequence/revision and semantic digests while replaying;
5. return the reconstructed snapshot only when its final digest matches the
   expected head or requested ChangeSet digest.

The initial Base is sequence zero and snapshot revision zero. Every accepted
authored mutation appends exactly one ChangeSet where:

```text
seq = revision = priorRevision + 1
```

Compaction inserts a later Base for an already-replayed exact sequence. It
advances `baseSeq` under compare-and-swap; it does not alter the logical
revision, snapshot digest, or materializations.

## Command receipts

Every accepted public command stores its canonical request digest and exact
result under `(outputId, requestId)`. Materialization request receipts point to
the original attempt identity. A retry therefore cannot allocate another
materialization sequence or freeze newer Data.

```ts
interface AnalyticOutputCommandReceipt {
  outputId: AnalyticOutputId;
  requestId: string;
  requestDigest: string;
  result: AnalyticOutputCommandResult;
  createdAt: string;
}
```

## Identity ledger

Placement, Filter, and Sort identities are never reused for unrelated authored
objects inside one output.

```ts
type AnalyticIdentityKind = "placement" | "filter" | "sort";

interface AnalyticIdentityTransition {
  id: string;
  kind: AnalyticIdentityKind;
  from: "absent" | "active" | "tombstoned";
  to: "active" | "tombstoned";
  revision: number;
  compensationTargetChangeSetId?: string;
}
```

An insert requires `absent`. Delete moves active to tombstoned. Only exact
undo/redo compensation may reactivate a tombstoned identity with the same kind.
Compaction never deletes identity-ledger rows.

## Materialization persistence

The serial freeze stores three exact values together:

- the authored definition at `frozenOutputRevision`;
- its canonical definition digest;
- the full frozen `FormulaWireValue` and input manifest.

Concurrent compute reads only those persisted bytes. Candidate publication is
immutable per attempt. Serial settlement revalidates candidate bytes and
inserts the immutable materialization in the same transaction that records the
pointer decision and completes the attempt.

The output head carries `latestMaterializationId` and
`latestMaterializationSeq`. This pointer is operational state and is excluded
from authored snapshot digests. It deliberately has no SQLite foreign key: the
materialization already points back to its output, and avoiding a circular
delete dependency keeps physical project cleanup straightforward. The
repository verifies the pointer target in every settlement/load path.

## Logical SQL schema

The adapter substitutes a trusted project prefix for each logical table name.
JSON/BLOB values are canonical UTF-8 JSON, validated and bounded before decode.

```sql
CREATE TABLE analytic_outputs (
  id                          TEXT PRIMARY KEY,
  title                       TEXT NOT NULL,
  lifecycle                   TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision                    INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq                    INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest             TEXT NOT NULL,
  next_materialization_seq    INTEGER NOT NULL DEFAULT 1
    CHECK (next_materialization_seq > 0),
  latest_materialization_id   TEXT,
  latest_materialization_seq  INTEGER CHECK (latest_materialization_seq > 0),
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL,
  CHECK (base_seq <= revision),
  CHECK (
    (latest_materialization_id IS NULL AND latest_materialization_seq IS NULL)
    OR
    (latest_materialization_id IS NOT NULL AND latest_materialization_seq IS NOT NULL)
  )
);

CREATE INDEX analytic_outputs_lifecycle_updated
  ON analytic_outputs(lifecycle, updated_at DESC, id);

CREATE TABLE analytic_output_command_receipts (
  output_id       TEXT NOT NULL,
  request_id      TEXT NOT NULL,
  request_digest  TEXT NOT NULL,
  result_json     BLOB NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (output_id, request_id),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE
);

CREATE TABLE analytic_output_identity_ledger (
  output_id                TEXT NOT NULL,
  identity_id              TEXT NOT NULL,
  identity_kind            TEXT NOT NULL
    CHECK (identity_kind IN ('placement', 'filter', 'sort')),
  state                    TEXT NOT NULL
    CHECK (state IN ('active', 'tombstoned')),
  first_revision           INTEGER NOT NULL CHECK (first_revision >= 0),
  last_transition_revision INTEGER NOT NULL CHECK (last_transition_revision >= 0),
  tombstoned_revision      INTEGER,
  PRIMARY KEY (output_id, identity_id),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE
);

CREATE TABLE analytic_output_bases (
  output_id              TEXT NOT NULL,
  base_seq               INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version INTEGER NOT NULL CHECK (representation_version = 1),
  snapshot_json          BLOB NOT NULL,
  semantic_digest        TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  PRIMARY KEY (output_id, base_seq),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE
);

CREATE INDEX analytic_output_bases_lookup
  ON analytic_output_bases(output_id, base_seq DESC);

CREATE TABLE analytic_output_change_sets (
  id                                 TEXT PRIMARY KEY,
  output_id                          TEXT NOT NULL,
  client_request_id                  TEXT NOT NULL,
  request_digest                     TEXT NOT NULL,
  authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
  prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
  revision                           INTEGER NOT NULL CHECK (revision > 0),
  seq                                INTEGER NOT NULL CHECK (seq > 0),
  origin                             TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  actor_id                           TEXT NOT NULL CHECK (length(actor_id) > 0),
  operations_json                    BLOB NOT NULL,
  inverse_operations_json            BLOB NOT NULL,
  touched_ids_json                   BLOB NOT NULL,
  compensation_intent                TEXT
    CHECK (compensation_intent IN ('undo', 'redo')),
  compensation_target_change_set_id  TEXT,
  semantic_digest                    TEXT NOT NULL,
  created_at                         TEXT NOT NULL,
  UNIQUE (output_id, seq),
  UNIQUE (output_id, revision),
  CHECK (seq = revision),
  CHECK (revision = prior_revision + 1),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE,
  FOREIGN KEY (compensation_target_change_set_id)
    REFERENCES analytic_output_change_sets(id)
);

CREATE INDEX analytic_output_changes_recent
  ON analytic_output_change_sets(output_id, seq DESC);

CREATE INDEX analytic_output_changes_compensation_target
  ON analytic_output_change_sets(compensation_target_change_set_id)
  WHERE compensation_target_change_set_id IS NOT NULL;

CREATE TABLE analytic_output_activity_outbox (
  fact_id          TEXT PRIMARY KEY,
  fact_kind        TEXT NOT NULL
    CHECK (fact_kind IN (
      'analytic-output.created',
      'analytic-output.changed',
      'analytic-output.compensated'
    )),
  output_id        TEXT NOT NULL,
  revision         INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id    TEXT,
  actor_id         TEXT NOT NULL CHECK (length(actor_id) > 0),
  origin           TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operation_types  BLOB NOT NULL,
  semantic_digest  TEXT NOT NULL,
  occurred_at      TEXT NOT NULL,
  published_at     TEXT,
  UNIQUE (output_id, revision),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id) REFERENCES analytic_output_change_sets(id)
);

CREATE INDEX analytic_output_activity_unpublished
  ON analytic_output_activity_outbox(occurred_at, fact_id)
  WHERE published_at IS NULL;

CREATE TABLE analytic_output_attempts (
  id                       TEXT PRIMARY KEY,
  output_id                TEXT NOT NULL,
  materialization_seq      INTEGER NOT NULL CHECK (materialization_seq > 0),
  client_request_id        TEXT NOT NULL,
  request_digest           TEXT NOT NULL,
  frozen_output_revision   INTEGER NOT NULL CHECK (frozen_output_revision >= 0),
  frozen_definition_digest TEXT NOT NULL,
  frozen_definition_json   BLOB NOT NULL,
  input_manifest_json      BLOB NOT NULL,
  frozen_input_json        BLOB NOT NULL,
  frozen_input_bytes       INTEGER NOT NULL CHECK (frozen_input_bytes >= 0),
  state                    TEXT NOT NULL
    CHECK (state IN (
      'requested', 'computing', 'candidate-ready',
      'settled', 'stale', 'failed'
    )),
  candidate_id             TEXT,
  materialization_id       TEXT,
  diagnostic_json          BLOB,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  UNIQUE (output_id, materialization_seq),
  UNIQUE (output_id, client_request_id),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE
);

CREATE INDEX analytic_output_attempts_state
  ON analytic_output_attempts(state, updated_at, id);

CREATE INDEX analytic_output_attempts_output
  ON analytic_output_attempts(output_id, materialization_seq DESC);

CREATE TABLE analytic_output_candidates (
  id                 TEXT PRIMARY KEY,
  attempt_id         TEXT NOT NULL UNIQUE,
  result_data_json   BLOB NOT NULL,
  resolved_view_json BLOB NOT NULL,
  executor_version   TEXT NOT NULL,
  candidate_digest   TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES analytic_output_attempts(id)
    ON DELETE CASCADE
);

CREATE TABLE analytic_output_materializations (
  id                  TEXT PRIMARY KEY,
  output_id           TEXT NOT NULL,
  attempt_id          TEXT NOT NULL UNIQUE,
  materialization_seq INTEGER NOT NULL CHECK (materialization_seq > 0),
  output_revision     INTEGER NOT NULL CHECK (output_revision >= 0),
  definition_digest   TEXT NOT NULL,
  input_manifest_json BLOB NOT NULL,
  result_data_json    BLOB NOT NULL,
  resolved_view_json  BLOB NOT NULL,
  executor_version    TEXT NOT NULL,
  digest              TEXT NOT NULL,
  result_row_count    INTEGER NOT NULL CHECK (result_row_count >= 0),
  result_cell_count   INTEGER NOT NULL CHECK (result_cell_count >= 0),
  result_bytes        INTEGER NOT NULL CHECK (result_bytes >= 0),
  created_at          TEXT NOT NULL,
  UNIQUE (output_id, materialization_seq),
  FOREIGN KEY (output_id) REFERENCES analytic_outputs(id) ON DELETE CASCADE,
  FOREIGN KEY (attempt_id) REFERENCES analytic_output_attempts(id)
    ON DELETE RESTRICT
);

CREATE INDEX analytic_output_materializations_recent
  ON analytic_output_materializations(output_id, materialization_seq DESC, id);

CREATE INDEX analytic_output_materializations_input
  ON analytic_output_materializations(
    output_id,
    output_revision,
    created_at DESC,
    id
  );

CREATE TABLE analytic_output_stage_receipts (
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
  FOREIGN KEY (attempt_id) REFERENCES analytic_output_attempts(id)
    ON DELETE CASCADE
);

CREATE INDEX analytic_output_stage_state
  ON analytic_output_stage_receipts(state, updated_at, attempt_id);
```

Application decoding validates every BLOB against the canonical TypeScript
union. SQL constraints are a second boundary, not a substitute for domain
validation.

## Transaction protocols

### Accept authored ChangeSet

One immediate transaction:

1. load the head and compare revision;
2. insert/update identity-ledger transitions;
3. insert the ChangeSet;
4. update head metadata, revision, semantic digest, and timestamp;
5. insert command receipt;
6. insert activity outbox fact;
7. commit.

No materialization pointer changes during this transaction. A previously
current materialization becomes detectably stale because its output revision
and definition digest no longer match the head.

### Freeze materialization attempt

Input resolution occurs before the SQLite transaction but inside the serial
job. The transaction then:

1. rechecks head revision and receipt absence;
2. allocates and increments `next_materialization_seq`;
3. inserts the attempt with exact definition/input bytes;
4. inserts the command receipt;
5. commits.

The frozen Formula read has no external side effect. If the head changed while
the reader ran, the transaction fails the compare-and-swap and discards the
unpersisted frozen value.

### Publish compute candidate

One transaction inserts the candidate if absent, changes attempt state to
`candidate-ready`, and completes the compute receipt. Divergent candidate bytes
for an existing attempt are corruption.

### Settle materialization

One immediate transaction:

1. load and verify attempt, candidate, and stage claim;
2. insert-or-read the immutable materialization;
3. conditionally update the output pointer with output revision, definition
   digest, lifecycle, and materialization sequence predicates;
4. update attempt to `settled` or `stale` with materialization ID;
5. complete settlement receipt;
6. commit.

This is the only pointer-advancement path.

## Canonical encoding and exact values

Canonical JSON sorts object keys, preserves array order, and encodes Formula
numbers as numerator/denominator strings through `FormulaWireValue`. The store
never converts exact numbers to JavaScript floating point. Digests use SHA-256
over canonical UTF-8 bytes.

Before persistence, the adapter verifies:

- every table row matches its declared field count;
- all wire-value unions are closed and recursively bounded;
- result schema placement IDs are unique;
- every resolved View channel targets one result field;
- count fields and stored byte lengths match the canonical payload;
- candidate/materialization digests recompute exactly.

## Cursor order

Head lists order by `(updatedAt DESC, id ASC)`. ChangeSets order by sequence.
Attempts and materializations order by `(materializationSeq DESC, id ASC)`.
Cursors encode the exact last tuple plus query filters and are authenticated or
otherwise validated by the shared cursor utility when one is introduced.

Immutable result row windows use `(materializationId, digest, absoluteOffset)`.
They cannot drift because result bytes never change.

## Retention and compaction

Authored history retention follows the resource pattern:

- retain the configured number of immutable Bases;
- retain enough ChangeSets to reconstruct every retained Base interval and
  satisfy Activity compensation policy;
- never delete identity-ledger rows or live command receipts needed for retry;
- compact only a contiguous verified ChangeSet prefix.

Terminal failed/stale attempts and stage receipts may be pruned after the
configured horizon when they are not the only provenance record for a retained
materialization. The attempt behind a retained materialization remains
reachable.

Immutable materializations can be referenced by Documents, Slides,
Spreadsheets, Findings, or Research records through ID and digest. Until a
cross-capability reachability contract exists, automatic retention does not
delete successful materializations. A future garbage collector may apply
configured limits only after proving that a result is not the latest pointer,
not referenced externally, and outside the retained history horizon.

## Recovery

At startup the capability reads recoverable attempt states, not current Data:

| Durable state | Recovery action |
|---|---|
| requested, no completed compute receipt | dispatch same compute intent |
| computing with stale running receipt | reclaim same compute stage |
| candidate-ready, no completed settle receipt | dispatch same settle intent |
| settle receipt running past recovery boundary | reclaim same settle stage |
| settled / stale / failed | terminal; no dispatch |

Candidate and materialization uniqueness makes every recovery path idempotent.

## Store acceptance cases

1. Concurrent head updates admit one ChangeSet and return stale revision for the
   loser without partial ledger/receipt/outbox writes.
2. Base replay detects missing, duplicated, reordered, or digest-divergent
   ChangeSets.
3. An identical command retry returns the stored result; divergent bytes under
   the same request ID conflict.
4. Materialization sequence allocation is monotonic per output.
5. A stopped process after attempt, candidate, or result insertion resumes from
   that exact durable state.
6. A slower older attempt cannot replace the latest pointer.
7. Formula rational values survive canonical encode/decode exactly.
8. Corrupt or oversized frozen input/result BLOBs are rejected before domain
   use.
9. Compaction leaves exact snapshot replay and all immutable result bytes
   unchanged.
10. No store table contains rendered images, SVG, Canvas commands, or charting
    library option blobs.
