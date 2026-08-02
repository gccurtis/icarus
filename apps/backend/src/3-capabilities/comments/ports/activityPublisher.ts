import type { CommentActivityTransaction } from "../domain/model.js";

/** Narrow source-side Activity port; Comments never imports the Activity runtime. */
export interface CommentActivityPublisher {
  publish(transaction: CommentActivityTransaction): Promise<void>;
}
