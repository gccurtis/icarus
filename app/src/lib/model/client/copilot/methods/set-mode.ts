import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Mode } from "$model/client/copilot/types";

/**
 * How the next message is treated.
 *
 * **Global, and it survives a tab change.** A user who set the copilot to act
 * has said something about how they are working, not about the document they
 * happen to be looking at — resetting it on a tab switch would be the object
 * forgetting a decision the user made deliberately.
 */
export const setMode = (state: CopilotState, mode: Mode): void => {
  state.mode = mode;
};
