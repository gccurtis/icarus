import type { StoreUnitOfWork } from "$model/server/store/index.server";

import type {
  DurableSemanticJob,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import {
  claimedJobIn,
  commonJobFields,
  replaceJob
} from "$capabilities/semantic-overlay/api/shared/durable-queue-job-state";
import { HEARTBEAT_MS, LEASE_MS } from "$capabilities/semantic-overlay/api/shared/durable-queue-policy";

export type DurableClaimLease = {
  readonly assertClaim: (unit: StoreUnitOfWork) => void;
  readonly close: () => void;
};

const renewClaim = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob
): boolean => input.model.store.transaction((unit) => {
  const current = claimedJobIn(unit, input.table, input.projectId, claimed);
  const now = Date.now();
  if (current === undefined || current.leaseExpiresAt <= now) return false;
  replaceJob(unit, input.table, current, {
    ...commonJobFields(current),
    state: "running",
    startedAt: current.startedAt,
    claimId: current.claimId,
    leaseExpiresAt: now + LEASE_MS,
    updatedAt: now
  });
  return true;
});

export const openDurableClaimLease = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob
): DurableClaimLease => {
  const heartbeatFailure: { error?: unknown } = {};
  const assertClaim = (unit: StoreUnitOfWork): void => {
    if (heartbeatFailure.error !== undefined) throw heartbeatFailure.error;
    const current = claimedJobIn(unit, input.table, input.projectId, claimed);
    if (current === undefined || current.leaseExpiresAt <= Date.now()) {
      throw new Error("Semantic synchronization lost its durable claim");
    }
  };
  const heartbeat = setInterval(() => {
    try {
      if (!renewClaim(input, claimed)) {
        heartbeatFailure.error = new Error("Semantic synchronization lost its durable claim");
      }
    } catch (error) {
      heartbeatFailure.error = error;
    }
  }, HEARTBEAT_MS);
  return { assertClaim, close: () => clearInterval(heartbeat) };
};
