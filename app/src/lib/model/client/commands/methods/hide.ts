import type { CommandsState } from "$model/client/commands/definition.svelte";
import { setOpen } from "$model/client/commands/methods/shared/set-open";

/**
 * Closes the bar.
 *
 * Separate from `toggle` because the bar reports only one direction back. It
 * opens because something opened it, and Escape, a click away, and selecting an
 * item all mean closed — a toggle on that path would reopen the bar the moment a
 * stray event arrived after it had already closed.
 *
 * Closing a closed bar is not an error. Two of those three paths can fire for
 * one gesture.
 */
export const hide = (state: CommandsState): void => {
  setOpen(state, false);
};
