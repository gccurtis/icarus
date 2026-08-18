import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Blocked } from "$model/client/copilot/types";

/**
 * Why the message cannot be sent, or nothing.
 *
 * **A reason rather than a boolean**, so the dock can say which one — "type
 * something" and "choose who answers" are different instructions, and a disabled
 * button with no explanation is the version of this that gets reported as a bug.
 *
 * Two reasons, and only two:
 *
 * - **An empty draft.** Trimmed for this question alone; `write` keeps what the
 *   user typed, because leading space is text they may be about to type into.
 * - **A `new` destination with no persona.** An existing thread carries its own
 *   persona and an agent task is steered rather than answered, so this is the
 *   one destination that needs the choice made.
 *
 * Attachments and scope never block. A message with neither is an ordinary
 * message.
 */
export const blocked = (state: CopilotState): Blocked => {
  if (state.draft.trim().length === 0) return "empty-draft";
  if (state.destination.kind === "new" && state.personaId === undefined) return "no-persona";

  return undefined;
};
