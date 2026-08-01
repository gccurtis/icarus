# Analytic Output — operations, endpoints, and jobs

## Operation boundary

Authored mutations are closed `AnalyticOutputOperation` values. The domain
reducer is pure: it receives one snapshot plus one operation, mutates no store,
calls no external capability, and returns the exact inverse operation and
touched identities. The application service validates the final batch,
persists one ChangeSet, writes one command receipt, and records one activity
fact in a single transaction.

Materialization is an application command, not an authored operation. It
freezes an exact snapshot/input, computes through internal jobs, and publishes
an immutable result without changing the authored revision.

## Authored operation vocabulary

```ts
type AnalyticOutputOperation =
  | { type: "output.rename"; title: string }
  | {
      type: "output.set-lifecycle";
      lifecycle: AnalyticOutputLifecycle;
    }
  | {
      type: "input.set";
      input?: AnalyticInputRef;
    }
  | {
      type: "placement.insert";
      channel: AnalyticPlacementChannel;
      placement: AnalyticFieldPlacement;
      afterPlacementId?: AnalyticPlacementId;
    }
  | {
      type: "placement.update";
      placementId: AnalyticPlacementId;
      placement: AnalyticFieldPlacement;
    }
  | {
      type: "placement.move";
      placementId: AnalyticPlacementId;
      channel: AnalyticPlacementChannel;
      afterPlacementId?: AnalyticPlacementId;
    }
  | {
      type: "placement.delete";
      placementId: AnalyticPlacementId;
    }
  | {
      type: "filter.insert";
      filter: AnalyticFilter;
      afterFilterId?: AnalyticFilterId;
    }
  | {
      type: "filter.update";
      filterId: AnalyticFilterId;
      filter: AnalyticFilter;
    }
  | {
      type: "filter.move";
      filterId: AnalyticFilterId;
      afterFilterId?: AnalyticFilterId;
    }
  | {
      type: "filter.delete";
      filterId: AnalyticFilterId;
    }
  | {
      type: "sort.insert";
      sort: AnalyticSort;
      afterSortId?: AnalyticSortId;
    }
  | {
      type: "sort.update";
      sortId: AnalyticSortId;
      sort: AnalyticSort;
    }
  | {
      type: "sort.move";
      sortId: AnalyticSortId;
      afterSortId?: AnalyticSortId;
    }
  | {
      type: "sort.delete";
      sortId: AnalyticSortId;
    }
  | {
      type: "result-limit.set";
      limit?: number;
    }
  | {
      type: "view.set";
      view: AnalyticView;
    };
```

`placement.update`, `filter.update`, and `sort.update` require the replacement
value to retain the addressed ID. IDs cannot be changed through update.

`placement.move` is the only operation that changes a placement's channel or
order. Moving into a singleton Color, Size, or Label channel requires that the
channel be empty or that the displaced placement be moved/deleted in the same
submission. Batch validation occurs on the final snapshot, allowing an atomic
swap without admitting an invalid intermediate result to persistence.

Deleting a placement is rejected while a Sort targets it unless the same
submission also deletes or retargets that Sort. View compatibility is checked
at materialization so a user may save an in-progress layout, but every
reference in the authored snapshot must still be structurally resolvable.

## Reducer results and exact inverses

```ts
interface AnalyticReduction {
  snapshot: AnalyticOutputSnapshot;
  inverse: AnalyticOutputOperation;
  touchedIds: string[];
}

function applyAnalyticOutputOperation(
  snapshot: AnalyticOutputSnapshot,
  operation: AnalyticOutputOperation,
): AnalyticReduction;
```

Inverse generation follows these rules:

| Forward operation | Exact inverse |
|---|---|
| rename / lifecycle / input / limit / View set | same operation carrying the prior value |
| insert placement/filter/sort | delete the inserted identity |
| update placement/filter/sort | update with the complete prior value |
| move placement/filter/sort | move to the exact prior channel and predecessor |
| delete placement/filter/sort | insert the complete prior value at its exact prior channel/order |

The service applies a submission's operations in order and prepends each exact
inverse, so replaying `inverseOperations` restores the prior snapshot. An
operation batch is rejected atomically if any operation fails or the final
snapshot violates structural invariants.

## Touched identities

Touched IDs are canonical strings used for stale rebase checks and activity
summaries:

```text
output:metadata
output:lifecycle
output:input
output:view
output:limit
placement:<placementId>
channel:<rows|columns|color|size|label|detail|tooltip>
filter:<filterId>
filters:order
sort:<sortId>
sorts:order
```

Insert, move, and delete touch both the object and its owning ordered channel.
Updating a placement touches its ID; if the update changes grouping or
aggregation semantics it also touches `output:view`, because materialization
compatibility must be reconsidered. `view.set` touches only `output:view`.

## Submission, idempotency, and stale rebase

```ts
interface AnalyticOutputSubmission {
  expectedRevision: number;
  operations: AnalyticOutputOperation[];
}

interface SubmitAnalyticOutputRequest {
  requestId: string;
  origin: AnalyticOutputOrigin;
  outputId: AnalyticOutputId;
  submission: AnalyticOutputSubmission;
}
```

The canonical request digest covers output ID, expected revision, origin,
and canonical operation bytes. Actor attribution comes from the constructed
runtime and is never admitted from the request. `(outputId, requestId)` is the
command idempotency key:

- an identical retry returns the stored result;
- reuse with different canonical bytes returns an idempotency conflict;
- a rejected request does not reserve the ID unless it created a durable
  materialization attempt.

At the current revision, the service first tries exact compare-and-swap. A
stale submission may rebase only when all touched identities are disjoint from
every intervening ChangeSet and all addressed objects retain compatible kinds.

Examples:

- updating different placements can commute;
- updating a filter can commute with changing a Sort on another placement;
- two edits to View conflict;
- an input change conflicts with every placement/filter/View change because
  all field semantics may change;
- two operations that alter the same ordered channel conflict;
- deleting a placement conflicts with its update, move, or targeted Sort;
- lifecycle and title changes touch separate identities and may commute.

Rebase reapplies the original operations to the current snapshot and records
the original `authoredRevision` plus the actual `priorRevision` in the accepted
ChangeSet.

Undo and redo are compensation commands. They append new ChangeSets containing
the selected prior inverse/forward operations; they never remove history or
decrement revision.

## Command envelope

```ts
interface AnalyticOutputCommandRequest {
  requestId: string;
  origin: AnalyticOutputOrigin;
  command: AnalyticOutputCommand;
}

type AnalyticOutputCommand =
  | {
      type: "analytic-output.create";
      outputId: AnalyticOutputId;
      title: string;
      definition?: Partial<AnalyticOutputDefinition>;
    }
  | {
      type: "analytic-output.submit";
      outputId: AnalyticOutputId;
      expectedRevision: number;
      operations: AnalyticOutputOperation[];
    }
  | {
      type: "analytic-output.compensate";
      outputId: AnalyticOutputId;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "analytic-output.materialize.request";
      outputId: AnalyticOutputId;
      expectedRevision: number;
    };

type AnalyticOutputCommandResult =
  | { type: "analytic-output.created"; head: AnalyticOutputHead }
  | { type: "analytic-output.changed"; changeSet: AnalyticOutputChangeSet }
  | {
      type: "analytic-output.materialization-requested";
      attemptId: AnalyticAttemptId;
      materializationSeq: number;
    };
```

Creation starts at authored revision zero and writes the initial Base. The
default definition has no input, empty shelves/filters/sorts, no limit, and a
table View. `definition` may provide a complete validated replacement at
creation; arbitrary partial JSON is not persisted.

## Query envelope

```ts
interface AnalyticOutputQueryRequest {
  requestId: string;
  query: AnalyticOutputQuery;
}

type AnalyticOutputQuery =
  | {
      type: "analytic-output.list";
      lifecycle?: AnalyticOutputLifecycle;
      cursor?: string;
      limit: number;
    }
  | {
      type: "analytic-output.load";
      outputId: AnalyticOutputId;
      revision?: number;
      includeLatestMaterialization: boolean;
    }
  | {
      type: "analytic-output.history";
      outputId: AnalyticOutputId;
      cursor?: string;
      limit: number;
    }
  | {
      type: "analytic-output.attempt";
      outputId: AnalyticOutputId;
      attemptId: AnalyticAttemptId;
    }
  | {
      type: "analytic-output.materialization";
      outputId: AnalyticOutputId;
      materializationId: AnalyticMaterializationId;
    }
  | {
      type: "analytic-output.materializations";
      outputId: AnalyticOutputId;
      cursor?: string;
      limit: number;
    };

type AnalyticOutputQueryResult =
  | {
      type: "analytic-output.listed";
      items: AnalyticOutputHead[];
      nextCursor?: string;
    }
  | {
      type: "analytic-output.loaded";
      head: AnalyticOutputHead;
      snapshot: AnalyticOutputSnapshot;
      latestMaterialization?: AnalyticMaterialization;
    }
  | {
      type: "analytic-output.history";
      items: AnalyticOutputChangeSet[];
      nextCursor?: string;
    }
  | {
      type: "analytic-output.attempt";
      attempt: AnalyticMaterializationAttempt;
    }
  | {
      type: "analytic-output.materialization";
      materialization: AnalyticMaterialization;
    }
  | {
      type: "analytic-output.materializations";
      items: AnalyticMaterialization[];
      nextCursor?: string;
    };
```

Materialization data can be large. The wire decoder enforces request limits,
and result queries use bounded cursor pagination or bounded row windows when
the stored result exceeds the inline response limit. A row-window response
always includes the immutable materialization digest and absolute row offset.

## Public endpoints

Analytic Output follows the same command/query envelope used by the mature
resource capabilities:

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/analytic-outputs/command` | serial | Create, submit, compensate, or freeze a materialization request. |
| `POST` | `/analytic-outputs/query` | concurrent | List/load/history/attempt/materialization reads. |

Transport performs structural decoding into the closed request union. Job
wiring chooses the queue. Domain/application code never receives a Fastify
request object or unvalidated `Record<string, unknown>`.

## Materialization freeze

`analytic-output.materialize.request` runs on the serial queue:

1. replay the requested exact output revision;
2. require that it equals the current head revision supplied by the caller;
3. apply executable-definition validation that does not require input values;
4. freeze the selected stable Formula binding through `AnalyticInputReader`;
5. canonicalize and size-check the exact wire value;
6. allocate the next output-local `materializationSeq`;
7. persist an attempt containing the exact snapshot definition, definition
   digest, input manifest, and input value;
8. write the command receipt;
9. dispatch `analytic-output.materialization.compute` after commit;
10. return the attempt ID.

If internal queue admission is temporarily full, the durable attempt remains
`requested`. Recovery scans requested/nonterminal attempts and dispatches the
missing stage with the same idempotency key.

## Concurrent compute

The compute job claims `(attemptId, "compute")`, transitions the attempt to
`computing`, and reads only the frozen definition/input stored on the attempt.
It never calls Structured Data or rebuilds the Formula resolver snapshot.

```ts
interface AnalyticExecutor {
  materialize(input: {
    definition: AnalyticOutputDefinition;
    frozenInput: FrozenAnalyticInput;
    limits: AnalyticOutputLimits;
  }): Promise<{
    resultData: AnalyticResultData;
    resolvedView: ResolvedAnalyticView;
    executorVersion: string;
  }>;
}
```

The executor:

- normalizes the exact input;
- resolves field paths and validates filter operands;
- applies the fixed filter/group/aggregate/sort/limit order;
- preserves exact Formula rational values;
- validates the selected View;
- enforces row, cell, and byte limits;
- returns no rendered asset.

The job canonicalizes the result, calculates the candidate digest, inserts one
candidate keyed by attempt ID, marks the attempt `candidate-ready`, completes
its stage receipt, and dispatches settlement.

An executor failure stores a bounded typed diagnostic and marks the attempt
`failed`. Logs do not include frozen data or filter values.

## Serial settlement

The settlement job claims `(attemptId, "settle")` and executes one repository
transaction:

1. load the attempt and exact candidate;
2. recompute/verify the candidate digest and referential invariants;
3. insert one immutable `AnalyticMaterialization` if absent;
4. compare current output revision and definition digest with the frozen pair;
5. compare materialization sequence with the current pointer sequence;
6. advance `latestMaterializationId` only when all pointer predicates pass;
7. mark the attempt `settled` when the pointer advances, otherwise `stale`;
8. complete the stage receipt.

Exact retries return the existing materialization. Candidate/result ID reuse
with divergent bytes is a corruption error. A stale result remains readable by
ID and may be cited or compared, but it is not reported as current.

## Internal intents and jobs

```ts
type AnalyticOutputInternalJobIntent =
  | {
      type: "analytic-output.materialization.compute";
      attemptId: AnalyticAttemptId;
      idempotencyKey: string;
    }
  | {
      type: "analytic-output.materialization.settle";
      attemptId: AnalyticAttemptId;
      idempotencyKey: string;
    }
  | {
      type: "analytic-output.compact";
      outputId: AnalyticOutputId;
      throughSeq: number;
      idempotencyKey: string;
    };
```

| Job | Queue | Durable output before continuation |
|---|---|---|
| command endpoint job | serial | Base/ChangeSet/receipt or frozen attempt/receipt |
| query endpoint job | concurrent | none; read only |
| materialization compute | concurrent | candidate + attempt state + compute receipt |
| materialization settle | serial | immutable materialization + pointer decision + settle receipt |
| Base compaction | serial | replacement Base and head base sequence |

Internal jobs use `InternalJobsRuntime`. A job releases its queue slot before
the next stage executes; it dispatches only after its own durable transaction
commits.

## Stage idempotency and recovery

Stage keys are deterministic:

```text
analytic-output:<outputId>:materialization:<attemptId>:compute
analytic-output:<outputId>:materialization:<attemptId>:settle
analytic-output:<outputId>:compact:<throughSeq>
```

On startup, recovery queries:

- `requested` attempts without a completed compute receipt;
- `computing` receipts that were left `running` by a stopped process;
- `candidate-ready` attempts without a completed settlement receipt;
- stale `running` stage receipts older than the configured recovery boundary.

Recovery resets only the stage claim needed for the same deterministic key. It
does not allocate another attempt or reread current project data.

## Compensation

Compensation selects the newest eligible currently-applied ChangeSet according
to the shared Activity/history convention, validates its operations against the
current snapshot, and appends a new ChangeSet. It never changes or removes an
immutable materialization.

If compensation changes the definition, the current materialization pointer may
continue to identify a result for a previous definition but `load` reports its
definition revision/digest. The UI may show it as stale until the restored
definition is materialized. Settlement is the only path that advances the
pointer to a matching result.

## Activity facts

Accepted creation, authored change, and compensation write a local outbox fact
in the same transaction:

```ts
interface AnalyticOutputCommittedFact {
  factId: string;
  sourceRequestId: string;
  kind:
    | "analytic-output.created"
    | "analytic-output.changed"
    | "analytic-output.compensated";
  outputId: AnalyticOutputId;
  revision: number;
  sourceChangeSetId?: string;
  actorId: string;
  origin: AnalyticOutputOrigin;
  operationTypes: string[];
  sourceSemanticDigest: string;
  occurredAt: string;
}
```

Materialization completion is operational state and does not emit an authored
change fact. A later activity vocabulary may add an explicit
`analytic-output.materialized` event without pretending it is a ChangeSet.

## Errors

The service uses typed errors at its boundary:

```ts
type AnalyticOutputErrorCode =
  | "not_found"
  | "stale_revision"
  | "idempotency_conflict"
  | "identity_reuse"
  | "invalid_operation"
  | "invalid_definition"
  | "binding_not_found"
  | "materialization_not_found"
  | "attempt_not_found"
  | "queue_capacity"
  | "corrupt_state";
```

Diagnostics caused by input shape, field paths, filters, aggregation, sorts, or
View compatibility are stored on materialization attempts. They do not become
opaque 500 responses. Persistence corruption and invariant violations remain
hard failures.

## Acceptance cases

1. Two identical create/submit/materialize requests return the same durable
   result; divergent request-ID reuse conflicts.
2. A batch can atomically move placements between singleton and ordered
   channels without persisting an invalid intermediate snapshot.
3. Exact inverses restore the prior canonical snapshot and semantic digest.
4. A stale disjoint placement edit rebases; a stale edit to the same channel
   conflicts.
5. Materialization compute observes only the persisted frozen Formula value.
6. Two same-definition materializations settling out of order leave the newer
   request sequence as the latest pointer.
7. A result for an older definition is stored but cannot advance the pointer.
8. A process stop after freeze, candidate write, or result insert resumes from
   the durable stage without rereading Data.
9. Failed materialization retains a typed bounded diagnostic and no partial
   immutable result.
10. No endpoint or job returns rendered pixels or accepts renderer-specific
    option objects.
