import type { CommandsState } from "$model/client/commands/definition.svelte";
import { command } from "$model/client/commands/methods/shared/command";
import type { CommandId } from "$model/client/commands/types";

/**
 * Runs a command, or refuses.
 *
 * A disabled command throws rather than no-ops, the same way `workbench.close`
 * throws for a permanent tab: the surface offering it must not have offered it.
 * The bar greys what `enabled` returns false for and the dispatcher checks
 * before it calls, so reaching this branch means a caller skipped the question —
 * a defect, and one that a silent no-op would hide until someone wondered why a
 * shortcut did nothing.
 */
export const run = (state: CommandsState, id: CommandId): void => {
  const found = command(state, id);

  if (!found.enabled()) {
    throw new Error(
      `Command "${id}" is disabled. Callers check enabled(id) first — ` +
        "see src/lib/model/client/commands/commands.md."
    );
  }

  found.run();
};
