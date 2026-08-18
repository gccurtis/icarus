import type { CopilotState } from "$model/client/copilot/definition.svelte";

/**
 * Asks the dock to take focus.
 *
 * **A counter rather than a boolean or an event.** A boolean has to be reset by
 * whoever consumed it, which means the model holding a flag about a DOM
 * operation it cannot observe; an event needs a bus, and there is none here by
 * design. A monotonic count is a value the dock can watch with an `$effect` and
 * compare against what it last acted on, so two focus requests in a row are two
 * focuses and a re-render is none.
 *
 * This is the whole of what the model does for the `copilot.focus` command. The
 * dock owns the `.focus()` call, because the model owns no elements.
 */
export const focus = (state: CopilotState): void => {
  state.focusRequests += 1;
};
