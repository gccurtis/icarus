import type { CopilotState } from "$model/client/copilot/definition.svelte";

/**
 * Drops everything this turn carries.
 *
 * Called by `sent`, and available on its own. **Scope is not cleared with it**:
 * attachments belong to one message and are written onto it, where scope is a
 * standing decision about what the next message may draw on.
 */
export const clearAttachments = (state: CopilotState): void => {
  state.attachments = [];
};
