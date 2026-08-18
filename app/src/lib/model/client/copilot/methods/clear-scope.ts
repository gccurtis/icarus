import type { CopilotState } from "$model/client/copilot/definition.svelte";
import { emptyScope } from "$model/client/copilot/types";

/**
 * Says nothing about what the response may draw on.
 *
 * **Which resolves to nothing, not everything.** That is `shared`'s rule and it
 * is the safe direction: a default that silently meant "the whole project" is
 * how a scope somebody meant to narrow leaks the lot. Everything is
 * `include([{ kind: "project" }])`, said out loud.
 */
export const clearScope = (state: CopilotState): void => {
  state.scope = emptyScope();
};
