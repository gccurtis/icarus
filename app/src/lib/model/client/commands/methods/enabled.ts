import type { CommandsState } from "$model/client/commands/definition.svelte";
import { command } from "$model/client/commands/methods/shared/command";
import type { CommandId } from "$model/client/commands/types";

/**
 * Whether a command applies right now.
 *
 * Every predicate reads through a closure into the workbench, and those reads
 * are `$state`. A `$derived` in the bar that maps every id through this therefore
 * re-runs when the active tab changes, which is where the greyed-out state comes
 * from — nothing subscribes, and nothing recomputes on a timer.
 */
export const enabled = (state: CommandsState, id: CommandId): boolean =>
  command(state, id).enabled();
