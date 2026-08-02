/** The source of an accepted Activity transaction. */
export type ActivityOrigin = "user" | "agent" | "automation" | "system";

interface ActivityTransactionFields {
  kind: string;
  resourceId?: string;
  operation: string;
  revision?: number;
  changeSetId?: string;
  actorId?: string;
  origin: ActivityOrigin;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}

/** Trusted publication input. Activity owns and returns the ledger ID. */
export interface ActivityTransactionInput extends ActivityTransactionFields {
  idempotencyKey: string;
}

/**
 * One accepted action published by a resource or project-level producer.
 * `id` is allocated by Activity from the source idempotency key and remains
 * stable across outbox retries.
 */
export interface ActivityTransaction extends ActivityTransactionFields {
  id: string;
}

/** An Activity transaction after the project ledger accepts it. */
export interface StoredActivityTransaction extends ActivityTransaction {
  sequence: number;
  publishedAt: string;
}

export interface ActivityTransactionFilter {
  kind?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}

export interface ActivityTransactionPage {
  items: StoredActivityTransaction[];
  nextCursor?: string;
}

/** Trusted Presence update after transport has supplied a session identity. */
export interface ActivityPresenceHeartbeat {
  sessionId: string;
  actorId?: string;
  kind?: string;
  resourceId?: string;
  state: Readonly<Record<string, unknown>>;
}

/** Current Presence state. It is not an immutable Activity transaction. */
export interface PresenceLease extends ActivityPresenceHeartbeat {
  updatedAt: string;
  expiresAt: string;
}

export interface ActivityPresenceFilter {
  kind?: string;
  resourceId?: string;
}

export type ActivityQuery =
  | { type: "activity.transactions"; filter?: ActivityTransactionFilter }
  | { type: "activity.transaction"; transactionId: string }
  | { type: "presence.list"; filter?: ActivityPresenceFilter };

export type ActivityQueryResult =
  | { type: "activity.transactions"; page: ActivityTransactionPage }
  | { type: "activity.transaction"; transaction?: StoredActivityTransaction }
  | { type: "presence.list"; leases: PresenceLease[] };
