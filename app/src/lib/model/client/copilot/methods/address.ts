import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Destination } from "$model/client/copilot/types";

/**
 * Where the next message goes.
 *
 * **Keeps the draft, the scope and the attachments.** Changing the destination is
 * redirecting a message, not starting a new one — a user who typed something,
 * attached a file and then realised it belonged in a different thread should
 * arrive there with all of it.
 *
 * That is also why there is one draft rather than one per destination: a draft
 * per conversation would make this operation lossy in exactly the moment it is
 * most useful.
 */
export const address = (state: CopilotState, destination: Destination): void => {
  state.destination = destination;
};
