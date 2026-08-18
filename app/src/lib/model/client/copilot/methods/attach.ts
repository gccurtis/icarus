import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Attachment } from "$model/client/copilot/types";
import { sameAttachment } from "$model/client/copilot/methods/shared/same-attachment";

/**
 * Adds what this turn carries.
 *
 * **Idempotent by kind and id**, so pointing at the same document twice is one
 * chip. A repeat *replaces* rather than being ignored, which is what lets a
 * retried link update its chip in place: the same URL fetched again may have
 * succeeded where the first attempt failed, and the newer result is the true
 * one.
 *
 * An attachment is complete when it arrives. A link carries its fetch result, so
 * it is added once that resolves rather than before — nothing in this list is
 * ever pending, which is why no method here has to report progress.
 */
export const attach = (state: CopilotState, attachment: Attachment): void => {
  state.attachments = [
    ...state.attachments.filter((other) => !sameAttachment(other, attachment)),
    attachment
  ];
};
