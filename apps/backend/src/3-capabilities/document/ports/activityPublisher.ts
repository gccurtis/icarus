import type { DocumentCommittedTransaction } from "../domain/model.js";

/**
 * Narrow integration port for delivering Document's already-committed outbox
 * records. The Document capability owns retries and publication marking; an
 * adapter outside Document maps the source record into Activity's transaction
 * model and performs the trusted Activity call.
 */
export interface DocumentActivityPublisher {
  publish(transaction: DocumentCommittedTransaction): Promise<void>;
}
