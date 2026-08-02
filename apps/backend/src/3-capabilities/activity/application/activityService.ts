import { createHash } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import { canonicalizeMetadata } from "../domain/canonical.js";
import { ActivityValidationError } from "../domain/errors.js";
import type {
  ActivityPresenceFilter,
  ActivityPresenceHeartbeat,
  ActivityQuery,
  ActivityQueryResult,
  ActivityTransaction,
  ActivityTransactionInput,
  ActivityTransactionFilter,
  ActivityTransactionPage,
  PresenceLease,
  StoredActivityTransaction
} from "../domain/model.js";
import type { ActivityStore } from "../ports/activityStore.js";

const DEFAULT_PRESENCE_TTL_MS = 30_000;
const MAX_STRING_LENGTH = 4_096;
const origins = new Set<ActivityTransaction["origin"]>([
  "user",
  "agent",
  "automation",
  "system"
]);

export interface ActivityClock {
  now(): string;
}

export interface ActivityOptions {
  presenceTtlMs?: number;
}

export interface ActivityDependencies {
  logger: Logger;
}

export interface ActivityPresenceRuntime {
  heartbeat(input: ActivityPresenceHeartbeat): Promise<PresenceLease>;
  leave(sessionId: string): Promise<{ removed: boolean }>;
  list(filter?: ActivityPresenceFilter): Promise<PresenceLease[]>;
  removeExpired(limit?: number): Promise<number>;
}

export interface ActivityCapability {
  publish(transaction: ActivityTransactionInput): Promise<StoredActivityTransaction>;
  query(query: ActivityQuery): Promise<ActivityQueryResult>;
  presence: ActivityPresenceRuntime;
}

const systemClock: ActivityClock = {
  now: () => new Date().toISOString()
};

const assertText = (value: string | undefined, label: string, required = true): void => {
  if (value === undefined && !required) return;
  if (!value || value.length > MAX_STRING_LENGTH) {
    throw new ActivityValidationError(`${label} must be a non-empty bounded string`);
  }
};

const assertTimestamp = (value: string, label: string): void => {
  assertText(value, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new ActivityValidationError(`${label} must be an ISO timestamp`);
  }
};

const assertJson = (value: Readonly<Record<string, unknown>>, label: string): void => {
  try {
    canonicalizeMetadata(value);
  } catch (error) {
    throw new ActivityValidationError(
      `${label} must be JSON-compatible: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const assertTransaction = (transaction: ActivityTransactionInput): void => {
  if ("id" in transaction) {
    throw new ActivityValidationError("Activity transaction ID is allocated by Activity");
  }
  assertText(transaction.idempotencyKey, "Activity transaction idempotency key");
  assertText(transaction.kind, "Activity transaction kind");
  assertText(transaction.resourceId, "Activity transaction resourceId", false);
  assertText(transaction.operation, "Activity transaction operation");
  assertText(transaction.changeSetId, "Activity transaction changeSetId", false);
  assertText(transaction.actorId, "Activity transaction actorId", false);
  if (!origins.has(transaction.origin)) {
    throw new ActivityValidationError("Activity transaction origin is invalid");
  }
  if (
    transaction.revision !== undefined &&
    (!Number.isSafeInteger(transaction.revision) || transaction.revision < 0)
  ) {
    throw new ActivityValidationError("Activity transaction revision must be a non-negative safe integer");
  }
  assertTimestamp(transaction.occurredAt, "Activity transaction occurredAt");
  assertJson(transaction.metadata ?? {}, "Activity transaction metadata");
};

const activityTransactionId = (idempotencyKey: string): string =>
  `act_${createHash("sha256")
    .update("icarus.activity.transaction\0")
    .update(idempotencyKey)
    .digest("hex")}`;

const assertHeartbeat = (heartbeat: ActivityPresenceHeartbeat): void => {
  assertText(heartbeat.sessionId, "Presence sessionId");
  assertText(heartbeat.actorId, "Presence actorId", false);
  assertText(heartbeat.kind, "Presence kind", false);
  assertText(heartbeat.resourceId, "Presence resourceId", false);
  assertJson(heartbeat.state, "Presence state");
};

const assertPresenceTtl = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ActivityValidationError("Presence TTL must be a positive safe integer");
  }
};

/**
 * Creates the isolated Activity runtime. Transport, source-outbox publishing,
 * and resource integration are intentionally outside this capability.
 */
export const createActivityCapability = (
  store: ActivityStore,
  dependencies: ActivityDependencies,
  options: ActivityOptions = {},
  clock: ActivityClock = systemClock
): ActivityCapability => {
  const presenceTtlMs = options.presenceTtlMs ?? DEFAULT_PRESENCE_TTL_MS;
  assertPresenceTtl(presenceTtlMs);
  const { logger } = dependencies;

  const now = (): string => {
    const timestamp = clock.now();
    assertTimestamp(timestamp, "Activity clock value");
    return timestamp;
  };

  const listTransactions = async (
    filter?: ActivityTransactionFilter
  ): Promise<ActivityTransactionPage> => {
    const startedAt = performance.now();
    try {
      const page = await store.listTransactions(filter);
      logger.debug("activity.transactions.listed", {
        ...(filter?.kind !== undefined ? { kind: filter.kind } : {}),
        ...(filter?.resourceId !== undefined ? { resourceId: filter.resourceId } : {}),
        requestedLimit: filter?.limit,
        cursorProvided: filter?.cursor !== undefined,
        count: page.items.length,
        hasNextCursor: page.nextCursor !== undefined,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return page;
    } catch (error) {
      logger.warn("activity.transactions.list.failed", {
        ...(filter?.kind !== undefined ? { kind: filter.kind } : {}),
        ...(filter?.resourceId !== undefined ? { resourceId: filter.resourceId } : {}),
        cursorProvided: filter?.cursor !== undefined,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Math.round(performance.now() - startedAt)
      });
      throw error;
    }
  };

  const presence: ActivityPresenceRuntime = {
    heartbeat: async (input) => {
      const startedAt = performance.now();
      try {
        assertHeartbeat(input);
        const updatedAt = now();
        const expiresAt = new Date(Date.parse(updatedAt) + presenceTtlMs).toISOString();
        const lease = await store.upsertPresence(input, updatedAt, expiresAt);
        logger.debug("activity.presence.heartbeat", {
          sessionId: input.sessionId,
          ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
          expiresAt,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return lease;
      } catch (error) {
        logger.warn("activity.presence.heartbeat.failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    },
    leave: async (sessionId) => {
      const startedAt = performance.now();
      try {
        assertText(sessionId, "Presence sessionId");
        const removed = await store.removePresence(sessionId);
        logger.info("activity.presence.left", {
          sessionId,
          removed,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return { removed };
      } catch (error) {
        logger.warn("activity.presence.leave.failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    },
    list: async (filter) => {
      const startedAt = performance.now();
      try {
        const leases = await store.listPresence(filter, now());
        logger.debug("activity.presence.listed", {
          ...(filter?.kind !== undefined ? { kind: filter.kind } : {}),
          ...(filter?.resourceId !== undefined ? { resourceId: filter.resourceId } : {}),
          count: leases.length,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return leases;
      } catch (error) {
        logger.warn("activity.presence.list.failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    },
    removeExpired: async (limit) => {
      const startedAt = performance.now();
      try {
        const removed = await store.removeExpiredPresence(now(), limit);
        logger.info("activity.presence.expired.removed", {
          requestedLimit: limit,
          removed,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return removed;
      } catch (error) {
        logger.warn("activity.presence.expired.remove.failed", {
          requestedLimit: limit,
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    }
  };

  logger.info("activity.runtime.created", {
    presenceTtlMs
  });

  return {
    publish: async (transaction) => {
      const startedAt = performance.now();
      try {
        assertTransaction(transaction);
        // Existing ledgers used the source key directly as the transaction ID.
        // Reusing that row keeps pending outbox retries migration-safe while all
        // new transactions receive an Activity-owned opaque ID.
        const { idempotencyKey, ...fields } = transaction;
        const generatedId = activityTransactionId(idempotencyKey);
        const existing =
          await store.getTransaction(idempotencyKey) ??
          await store.getTransaction(generatedId);
        const accepted: ActivityTransaction = {
          id: existing?.id ?? generatedId,
          ...fields
        };
        const stored = await store.publish(accepted, now());
        logger.info("activity.transaction.accepted", {
          transactionId: stored.id,
          idempotencyKey,
          replayed: existing !== undefined,
          sequence: stored.sequence,
          kind: stored.kind,
          ...(stored.resourceId !== undefined ? { resourceId: stored.resourceId } : {}),
          operation: stored.operation,
          origin: stored.origin,
          ...(stored.actorId !== undefined ? { actorId: stored.actorId } : {}),
          ...(stored.revision !== undefined ? { revision: stored.revision } : {}),
          durationMs: Math.round(performance.now() - startedAt)
        });
        return stored;
      } catch (error) {
        logger.warn("activity.transaction.publish.failed", {
          kind: transaction.kind,
          ...(transaction.resourceId !== undefined ? { resourceId: transaction.resourceId } : {}),
          operation: transaction.operation,
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    },
    query: async (query) => {
      const startedAt = performance.now();
      try {
        switch (query.type) {
          case "activity.transactions": {
            const page = await listTransactions(query.filter);
            logger.debug("activity.query.completed", {
              type: query.type,
              count: page.items.length,
              durationMs: Math.round(performance.now() - startedAt)
            });
            return { type: "activity.transactions", page };
          }
          case "activity.transaction": {
            assertText(query.transactionId, "Activity transaction id");
            const transaction = await store.getTransaction(query.transactionId);
            logger.debug("activity.transaction.read", {
              transactionId: query.transactionId,
              found: transaction !== undefined,
              durationMs: Math.round(performance.now() - startedAt)
            });
            return {
              type: "activity.transaction",
              transaction
            };
          }
          case "presence.list": {
            const leases = await presence.list(query.filter);
            logger.debug("activity.query.completed", {
              type: query.type,
              count: leases.length,
              durationMs: Math.round(performance.now() - startedAt)
            });
            return { type: "presence.list", leases };
          }
        }
      } catch (error) {
        logger.warn("activity.query.failed", {
          type: query.type,
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: Math.round(performance.now() - startedAt)
        });
        throw error;
      }
    },
    presence
  };
};
