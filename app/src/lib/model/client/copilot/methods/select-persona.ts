import type { CopilotState } from "$model/client/copilot/definition.svelte";

/**
 * Who answers a new conversation.
 *
 * Only ever consulted for a `new` destination — an existing thread carries its
 * own persona, and steering an agent task is the task's business. The choice is
 * kept anyway when the destination changes, so returning to a new conversation
 * does not mean choosing again.
 *
 * Passing nothing clears it, which is the state `blocked` reports as
 * `no-persona`.
 */
export const selectPersona = (state: CopilotState, id?: string): void => {
  state.personaId = id;
};
