import { canonicalizeMetadata } from "../domain/canonical.js";
import { ActivityValidationError } from "../domain/errors.js";
import type {
  ActivityPresenceFilter,
  ActivityPresenceHeartbeat,
  ActivityQuery,
  ActivityQueryResult,
  ActivityTransaction,
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

export interface ActivityPresenceRuntime {
  heartbeat(input: ActivityPresenceHeartbeat): Promise<PresenceLease>;
  leave(sessionId: string): Promise<{ removed: boolean }>;
  list(filter?: ActivityPresenceFilter): Promise<PresenceLease[]>;
  removeExpired(limit?: number): Promise<number>;
}

export interface ActivityCapability {
  publish(transaction: ActivityTransaction): Promise<StoredActivityTransaction>;
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

const assertTransaction = (transaction: ActivityTransaction): void => {
  assertText(transaction.id, "Activity transaction id");
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
  options: ActivityOptions = {},
  clock: ActivityClock = systemClock
): ActivityCapability => {
  const presenceTtlMs = options.presenceTtlMs ?? DEFAULT_PRESENCE_TTL_MS;
  assertPresenceTtl(presenceTtlMs);

  const now = (): string => {
    const timestamp = clock.now();
    assertTimestamp(timestamp, "Activity clock value");
    return timestamp;
  };

  const listTransactions = async (
    filter?: ActivityTransactionFilter
  ): Promise<ActivityTransactionPage> => store.listTransactions(filter);

  const presence: ActivityPresenceRuntime = {
    heartbeat: async (input) => {
      assertHeartbeat(input);
      const updatedAt = now();
      const expiresAt = new Date(Date.parse(updatedAt) + presenceTtlMs).toISOString();
      return store.upsertPresence(input, updatedAt, expiresAt);
    },
    leave: async (sessionId) => {
      assertText(sessionId, "Presence sessionId");
      return { removed: await store.removePresence(sessionId) };
    },
    list: async (filter) => store.listPresence(filter, now()),
    removeExpired: async (limit) => store.removeExpiredPresence(now(), limit)
  };

  return {
    publish: async (transaction) => {
      assertTransaction(transaction);
      return store.publish(transaction, now());
    },
    query: async (query) => {
      switch (query.type) {
        case "activity.transactions":
          return { type: "activity.transactions", page: await listTransactions(query.filter) };
        case "activity.transaction":
          assertText(query.transactionId, "Activity transaction id");
          return {
            type: "activity.transaction",
            transaction: await store.getTransaction(query.transactionId)
          };
        case "presence.list":
          return { type: "presence.list", leases: await presence.list(query.filter) };
      }
    },
    presence
  };
};
