import type { CommandsState } from "$model/client/commands/definition.svelte";

/**
 * The one writer for whether the bar is showing.
 *
 * Three callers reach it — `toggle`, `hide`, and two commands in the registry —
 * and they reach it rather than assigning the field so that the bar's visibility
 * has a single place to grow. Anything the bar has to forget on close (a typed
 * query, a highlighted row) belongs here, and a second assignment site is how
 * that ends up applied on one path and not the other.
 */
export const setOpen = (state: CommandsState, value: boolean): void => {
  state.open = value;
};
