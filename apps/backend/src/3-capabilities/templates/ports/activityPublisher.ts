import type { TemplateCommittedFact } from "../domain/model.js";

/** Narrow source-side Activity port; Templates never imports the Activity runtime. */
export interface TemplateActivityPublisher {
  publish(fact: TemplateCommittedFact): Promise<void>;
}
