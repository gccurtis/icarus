import type { CommandsState } from "$model/client/commands/definition.svelte";
import { setOpen } from "$model/client/commands/methods/shared/set-open";

/**
 * Shows the bar, or hides it.
 *
 * Toggle rather than open, because one chord has to do both: a user who pressed
 * the shortcut and then changed their mind reaches for the same keys. This is
 * what `command-bar.open` runs, which is why the registry is built after the
 * state exists — the command closes over the thing it flips.
 */
export const toggle = (state: CommandsState): void => {
  setOpen(state, !state.open);
};
