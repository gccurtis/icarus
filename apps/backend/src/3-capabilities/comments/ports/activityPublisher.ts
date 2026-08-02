import type { CommentCommittedTransaction } from "../domain/model.js";

/** Narrow source-side Activity port; Comments never imports the Activity runtime. */
export interface CommentActivityPublisher {
  publish(transaction: CommentCommittedTransaction): Promise<void>;
}
