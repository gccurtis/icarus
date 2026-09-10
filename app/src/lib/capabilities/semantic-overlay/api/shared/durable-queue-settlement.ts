import type { StoreUnitOfWork } from "$model/server/store/index.server";

import type {
  DurableSemanticJob,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import {
  claimedJobIn,
  commonJobFields,
  replaceJob,
  requeueJobIn
} from "$capabilities/semantic-overlay/api/shared/durable-queue-job-state";
import { MAX_ATTEMPTS } from "$capabilities/semantic-overlay/api/shared/durable-queue-policy";

type CompletedSettlement<Result extends SemanticWorkerResult> = {
  readonly state: "completed";
  readonly result: Result;
  readonly assertClaim: (unit: StoreUnitOfWork) => void;
};

type FailedSettlement = {
  readonly state: "failed";
  readonly error: string;
};

type InterruptedSettlement = {
  readonly state: "interrupted";
};

type DurableJobSettlement<Result extends SemanticWorkerResult> =
  | CompletedSettlement<Result>
  | FailedSettlement
  | InterruptedSettlement;

export type FailureSettlementOutcome = "lost" | "retrying" | "failed";

export const settleDurableSemanticJob = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  settlement: DurableJobSettlement<Result>
): FailureSettlementOutcome | undefined => input.model.store.transaction((unit) => {
  if (settlement.state === "completed") settlement.assertClaim(unit);
  const current = claimedJobIn(unit, input.table, input.projectId, claimed);
  if (current === undefined) {
    if (settlement.state === "completed") {
      throw new Error("Semantic synchronization lost its durable claim");
    }
    return settlement.state === "failed" ? "lost" : undefined;
  }

  if (settlement.state === "interrupted") {
    requeueJobIn(
      unit,
      input.table,
      { ...current, attempts: Math.max(0, current.attempts - 1) },
      false
    );
    return undefined;
  }

  if (settlement.state === "completed") {
    const completedRevision = settlement.result.revision ?? claimed.requestedRevision;
    if (
      settlement.result.outcome === "superseded" ||
      current.requestedRevision > completedRevision
    ) {
      requeueJobIn(unit, input.table, current, true);
      return undefined;
    }
    unit.remove(`${input.table}.${current._id}`);
    return undefined;
  }

  if (current.requestedRevision > claimed.requestedRevision) {
    requeueJobIn(unit, input.table, current, true);
    return "retrying";
  }
  if (current.attempts < MAX_ATTEMPTS) {
    requeueJobIn(unit, input.table, current, false);
    return "retrying";
  }
  const now = Date.now();
  replaceJob(unit, input.table, current, {
    ...commonJobFields(current),
    state: "failed",
    error: settlement.error,
    updatedAt: now
  });
  return "failed";
});
