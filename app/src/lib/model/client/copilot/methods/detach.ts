import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Attachment } from "$model/client/copilot/types";
import { sameAttachment } from "$model/client/copilot/methods/shared/same-attachment";

/**
 * Removes what this turn carries. A no-op for one that is not there.
 *
 * Matched by kind and id rather than by identity, so a caller detaching the
 * value a chip is rendering does not have to be holding the exact object that
 * was attached.
 */
export const detach = (state: CopilotState, attachment: Attachment): void => {
  state.attachments = state.attachments.filter((other) => !sameAttachment(other, attachment));
};
