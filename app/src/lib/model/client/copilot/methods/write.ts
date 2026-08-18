import type { CopilotState } from "$model/client/copilot/definition.svelte";

/**
 * The composer text.
 *
 * **One draft, and it is kept across a destination change.** Changing where a
 * message goes is redirecting it, not starting a new one, so a draft per
 * conversation would throw away what the user typed the moment they realised it
 * belonged somewhere else.
 *
 * Nothing is trimmed here. Leading space is what a user typed and may be about
 * to type into; `blocked` is where emptiness is judged, and it trims for that
 * question alone.
 */
export const write = (state: CopilotState, text: string): void => {
  state.draft = text;
};
