# 05 · The Async Attempt Pipeline

This is the most distinctive piece of the architecture and the reason the dual queue exists.
It answers: *how do you run a slow, non-deterministic operation (an LLM call, a formula
evaluation) against versioned state without either blocking the writer or accepting a stale
result?*

## The canonical shape

```text
serial request / freeze
  → concurrent compute
    → durable result
      → serial settlement
        → accepted ChangeSet or stale result
```

Each arrow is a **new typed intent and a fresh Job**. The current stage commits to SQLite
before wiring dispatches the next one. So the in-memory queue is never the record of
outstanding work — the durable attempt row is.

## Stage 1 · Request (serial)

`POST /documents/command` with `prompt.create.request` runs on the **serial** queue:

1. Reject reserved internal request-ID prefix.
2. Replay the receipt if this `requestId` was seen (idempotency).
3. `expectedRevision !== head.revision` ⇒ `RevisionConflictError`.
4. Validate the block ID is free — not in the snapshot, no existing `prompt-create` attempt,
   no existing prompt-output ownership row.
5. **Dry-run the placement**: `applyOperations` inserts a throwaway `divider` block at the
   requested placement purely to prove the placement is legal *before* spending an LLM call.
6. Write a `PromptCreationAttempt` row + submission receipt in one transaction
   (`createAttemptWithSubmission`).
7. `dispatch(attemptIntent(attempt, "compute"))`.
8. Return `202` with `{ type: "prompt.create-requested", attemptId }`.

The attempt row **freezes** everything the later stages need: `frozenDocumentRevision`,
`placement`, `styleId`, the full prompt `definition`. Later stages never re-read mutable
inputs.

Formula evaluation attempts are created differently — they are a *side effect* of a normal
mutation. `applyOperations` returns `formulaChanges`, and `mutate()` creates one
`FormulaEvaluationAttempt` per changed formula atom **inside the same `commitMutation`
transaction**, then dispatches compute jobs after the commit succeeds.

## Stage 2 · Compute (concurrent)

`document.prompt.create.compute` → `DocumentService.computePromptCreation(attemptId)`, on the
**concurrent** queue. This is where the slow work happens:

```ts
const output = await derivedOutputs.declare(attempt.definition,
                  { idempotencyKey: `document:prompt-create:${attempt.id}` });
await store.registerPendingPromptOutput({ outputId, documentId, blockId, state: "pending", … });
const refreshed = await derivedOutputs.refresh(output.id,
                  { idempotencyKey: `document:prompt-create:${attempt.id}:refresh` });
if (refreshed.output.headRevision <= 0) { /* detach ownership, mark attempt failed */ return; }
await store.updateAttempt({ ...attempt, state: "proposed",
                            candidateOutputId, candidateHeadRevision });
await dispatch(attemptIntent(updated, "settle"));
```

Note it does **not** touch the Document snapshot. It produces a *candidate* and persists it on
the attempt row. The `prompt_outputs` ownership table tracks a Derived Output that has been
created but not yet attached — so an orphan is recoverable rather than leaked.

## Stage 3 · Settle (serial)

`document.prompt.create.settle` → back on the **serial** queue, so no other write can
interleave:

```ts
const current = await this.loadSnapshot(attempt.documentId);
try {
  await this.mutate({
    documentId, expectedRevision: current.head.revision,
    operations: [{ type: "block.insert", block: { kind: "prompt", id: attempt.blockId,
                    output: { outputId: candidateOutputId, appliedRevision: candidateHeadRevision } },
                  placement: attempt.placement }],
    requestId: internalRequestId("prompt-create", attempt.id, "settle"),
    origin: "automation",
    allowPromptOperations: true,     // only settlement may create Prompt Blocks
    settleAttempt: attempt           // marks the attempt "settled" in the same commit
  });
} catch (error) {
  if (!isPromptSettlementConflict(error)) throw error;
  await store.updatePromptOutputOwnership({ …, state: "detached" });
  await this.markStale(attempt, error);
}
```

Settlement checks staleness explicitly, and each attempt kind checks something different:

| Attempt kind | Staleness test at settle |
| --- | --- |
| `prompt-create` | Placement/validation/revision conflict during `mutate` ⇒ stale + detach output |
| `prompt-refresh` | Block still exists, is a prompt, same `outputId`, and `appliedRevision === frozenAppliedRevision` |
| `formula-evaluation` | Atom still exists, `digestFormulaExpression(atom.expression) === frozenExpressionDigest`, **and** no intervening ChangeSet's `touchedIds` contains the atom ID |

The formula check is doubly defensive: digest equality catches a change-and-change-back, and
the touched-ID scan catches any write that touched the atom while compute was running.

A stale attempt is **not an error**. It transitions to `stale` with a diagnostic and the
pipeline stops. States: `requested → computing → proposed → settled`, with terminal branches
`unchanged | stale | failed`.

## Stage receipts and the claim protocol

Every stage body runs inside `runStage(attemptId, stage, kind, work)`, which enforces
at-most-once execution using a durable receipt:

```ts
if (["settled","unchanged","stale","failed"].includes(attempt.state)) return;   // already terminal
const claim = await store.claimStage(receipt);      // "claimed" | "running" | "completed"
if (claim !== "claimed") return;                    // someone else has it / already done
```

`stage_receipts` has `PRIMARY KEY (attempt_id, stage)` and a `UNIQUE` idempotency key, so the
claim is a database-enforced mutex, not an in-memory one.

`runStage` also layers on a bounded retry for the *bookkeeping* around the work, distinct
from the work itself:

```ts
const STAGE_RETRY_DELAYS_MS = [10, 50];   // 2 retries, then rethrow
retryStageAction(attemptId, stage, kind, phase, action)
// phases: "start" | "work" | "record-failure" | "complete"
```

The two failure paths at the end of `runStage` are carefully asymmetric:

- **Recording a failure fails** → log `document.internal-stage.failure-record-pending` and
  rethrow the original error. The attempt stays non-terminal so recovery can retry.
- **Completing the receipt fails after the work succeeded** → log
  `document.internal-stage.completion-pending` and rethrow. The comment: *"The stage effect
  succeeded. Keep the attempt non-terminal and the receipt running so startup recovery can
  safely finish the receipt."*

In both cases the bias is toward *leaving evidence that work is unfinished*, never toward
optimistically marking it done.

## Recovery at startup

`startBackend` calls, before binding the listener:

```ts
await document.recoverPendingAttempts();   // → logs document.attempts.recovered
await document.publishPendingActivity();   // → logs document.activity.recovered
await slide.recoverPendingAttempts();
```

```ts
async recoverPendingAttempts(): Promise<number> {
  await this.store.recoverInterruptedStages(now());       // "running" receipts → recoverable
  const attempts = await this.store.listRecoverableAttempts();
  for (const attempt of attempts) {
    await this.dispatch(attemptIntent(attempt,
      attempt.state === "proposed" ? "settle" : "compute"));   // resume at the right stage
  }
  return attempts.length;
}
```

Because every stage is idempotent (receipt claim + idempotency keys into Derived Outputs), a
crash mid-compute is safe: the LLM call is either replayed from the Derived Outputs
idempotency claim or re-run, and settlement re-checks staleness against current state.

`ConnectorSyncScheduler.start()` performs the analogous recovery for its domain:
`store.resetSyncing()` clears sync locks left set by a crashed process, logged as
`connector.sync.scheduler.recovered`.

## The transactional outbox

Document publishes to Activity via an outbox, not a direct call. The sequence:

1. `mutate()` builds a `DocumentCommittedFact` with a `factId` allocated **with** the
   mutation.
2. `commitMutation` writes head + changeSet + receipt + **fact** in one SQLite transaction.
   The fact cannot exist without the mutation, or vice versa.
3. *After* commit, `publishActivityFact(fact)` calls the injected publisher and, on success,
   `store.markFactPublished(factId, now())`.
4. On failure it logs `document.activity.publish-failed` and **returns false** — the accepted
   command result is unchanged.

```ts
/**
 * Source state is already committed when this runs. Delivery failures stay in
 * the local outbox for `publishPendingActivity()` rather than changing the
 * accepted Document command result.
 */
```

The `factId` is stable across retries, so Activity's `publish()` is naturally idempotent —
Activity's transaction table has `id TEXT PRIMARY KEY` plus a stored `transaction_digest`, and
re-publishing the same ID with different content raises
`ActivityTransactionConflictError`. That is the reason the fact carries Document's
`sourceSemanticDigest` explicitly labelled *"The Document snapshot digest, not the Activity
transaction digest"* — Activity computes its own.

## Dispatch retry with backoff

Dispatching the next stage can fail if the queue is full. `DocumentService` handles this
without losing the continuation:

```ts
const DISPATCH_RETRY_INITIAL_DELAY_MS = 25;
const DISPATCH_RETRY_MAX_DELAY_MS = 2_000;
// delay = min(25 * 2^min(retryCount-1, 16), 2000)
timer.unref();                                        // never holds the process open
this.pendingDispatches.set(intent.idempotencyKey, { intent, retryCount, timer });
```

Keyed by `idempotencyKey`, so a duplicate dispatch while one is pending is dropped. Only
`isRetryableInternalJobAdmissionError` (i.e. `QueueCapacityError`) retries; an unregistered
intent type is logged once and abandoned, because it is a wiring bug that backoff cannot fix.
Recovery logs `document.internal-job.dispatch-recovered`.

## Derived Outputs runs the same pattern internally

`DerivedOutputService.refresh()` is the second implementation of freeze/compute/settle, at a
finer grain and entirely within one capability:

1. Claim the refresh by idempotency key.
2. **Freeze** the scope: `knowledge.resolveScope(contextEntries)` produces a
   `KnowledgeScopeManifest` with `resolvedSourceIds`, `contextDigest`, `scopeDigest`, and
   trusted `resources[]`. Everything downstream reads through that frozen manifest, so
   Context membership cannot shift mid-run.
3. Plan retrieval via `intelligence.reasonStructured` (bounded by `maxPlanQueries`).
4. Retrieve Knowledge regions; optionally run tool-using synthesis
   (`reasonWithToolsStructured`, bounded by `maxToolRounds`) whose `list`/`read` tools are
   authorised **only** against the frozen manifest.
5. Validate evidence provenance against what was actually retrieved.
6. **Settle** with a three-way compare-and-swap:

```ts
settleRefresh({ expectedDefinitionRevision, expectedHeadRevision, expectedKnowledgeGeneration, … })
  → "published" | "definition_changed" | "head_changed" | "knowledge_changed" | "output_deleted"
```

The `knowledgeGeneration` check is the interesting one. `startBackend` wires:

```ts
knowledge.onSourceMutation((mutation) => derivedOutputs.recordKnowledgeSourceMutation(mutation));
```

Any Knowledge source add/remove bumps a generation counter and marks outputs stale. A refresh
that computed against generation *N* will not publish if the corpus is now at *N+1* — the
answer would be grounded in evidence that no longer exists.

## Where to look

| Concern | File |
| --- | --- |
| Attempt types and states | `document/domain/model.ts` (`DocumentAttempt`, `DocumentAttemptState`, `DocumentStageReceipt`) |
| Stage orchestration | `document/application/documentService.ts` → `runStage`, `retryStageAction`, `markStale` |
| Intent → queue mapping | `4-job-wiring/document/createDocumentJobs.ts` |
| Store claim primitives | `document/ports/documentStore.ts` → `claimStage`, `completeStage`, `failStage`, `recoverInterruptedStages` |
| Outbox schema + migration | `document/persistence/sqliteSchema.ts` → `activityOutbox`, `migrateActivityOutbox` |
| Derived Outputs refresh | `derived-outputs/derived-outputs.ts` → `refresh` (line ~724) and `store.ts` → `SettleRefreshInput` |
