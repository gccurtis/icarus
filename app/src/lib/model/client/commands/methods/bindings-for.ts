import type { CommandsState } from "$model/client/commands/definition.svelte";
import type { Chord, CommandId } from "$model/client/commands/types";

/**
 * Every chord bound to one command, for the surface that lists them.
 *
 * Derived rather than stored, because the map runs the other way. Chord to
 * command is the direction dispatch reads and the direction the uniqueness
 * constraint lives in — one chord cannot mean two things — while a command may
 * have several chords or none, so storing that direction would make the
 * conflict check a scan instead of a lookup.
 *
 * An unbound command returns an empty array rather than `undefined`. The bar
 * renders the chord column for every row, and a missing value there is nothing
 * to show rather than a case to branch on.
 */
export const bindingsFor = (state: CommandsState, id: CommandId): readonly Chord[] =>
  Object.entries(state.bindings)
    .filter(([, bound]) => bound === id)
    .map(([chord]) => chord);
