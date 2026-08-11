import type {
  ActivityPresenceFilter,
  ActivityPresenceHeartbeat,
  ActivityTransaction,
  ActivityTransactionFilter,
  ActivityTransactionPage,
  PresenceLease,
  StoredActivityTransaction
} from "../domain/model.js";

/** Durable project-local storage owned by Activity. */
export interface ActivityStore {
  publish(
    transaction: ActivityTransaction,
    publishedAt: string
  ): Promise<StoredActivityTransaction>;
  getTransaction(transactionId: string): Promise<StoredActivityTransaction | undefined>;
  listTransactions(filter?: ActivityTransactionFilter): Promise<ActivityTransactionPage>;

  upsertPresence(
    heartbeat: ActivityPresenceHeartbeat,
    updatedAt: string,
    expiresAt: string
  ): Promise<PresenceLease>;
  removePresence(sessionId: string): Promise<boolean>;
  listPresence(filter: ActivityPresenceFilter | undefined, now: string): Promise<PresenceLease[]>;
  removeExpiredPresence(now: string, limit?: number): Promise<number>;
}
