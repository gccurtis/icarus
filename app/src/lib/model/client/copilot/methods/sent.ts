import type { CopilotState } from "$model/client/copilot/definition.svelte";
import type { Destination } from "$model/client/copilot/types";

/**
 * Records that a message landed. **Past tense — this object does not send.**
 *
 * The dock calls the mutation and reports the result. A refused mutation leaves
 * the draft in the composer, because this was never called, and the failure is
 * the dock's to render. That keeps the object testable without a network and
 * puts an error where it can be seen.
 *
 * What clears and what stays is the whole content of this method:
 *
 * | Cleared | Kept |
 * | --- | --- |
 * | `draft` | `mode` |
 * | `attachments` | `personaId` |
 * | | `scope` |
 *
 * **Scope survives and attachments do not**, and the asymmetry is deliberate.
 * Attachments are written onto the message, so they belong to that turn and are
 * gone once it has them. Scope is a standing decision about what the *next*
 * message may draw on — clearing it would make a user re-state their working
 * context after every single turn.
 *
 * It takes the destination the message landed in, because a `new` message
 * becomes a thread: sending into `{ kind: "new" }` and staying there would point
 * the next message at a second new conversation rather than continuing the one
 * just started.
 */
export const sent = (state: CopilotState, destination: Destination): void => {
  state.draft = "";
  state.attachments = [];
  state.destination = destination;
};
