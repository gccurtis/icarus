import type { DeckCommittedTransaction } from "../domain/model.js";

/**
 * Post-commit delivery for the local Activity outbox.
 *
 * Optional by construction: the outbox row is written inside the mutation
 * transaction, so a Deck command succeeds whether or not delivery does.
 * A failure leaves the row unpublished for `publishPendingActivity()` rather
 * than changing what the caller was told.
 */
export interface SlideActivityPublisher {
  publish(transaction: DeckCommittedTransaction): Promise<void>;
}
