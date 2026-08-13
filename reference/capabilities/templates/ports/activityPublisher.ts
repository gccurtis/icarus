import type { TemplateCommittedTransaction } from "../domain/model.js";

/** Narrow source-side Activity port; Templates never imports the Activity runtime. */
export interface TemplateActivityPublisher {
  publish(transaction: TemplateCommittedTransaction): Promise<void>;
}
