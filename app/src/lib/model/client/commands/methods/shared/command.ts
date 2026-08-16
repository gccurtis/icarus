import type { CommandsState } from "$model/client/commands/definition.svelte";
import type { Command, CommandId } from "$model/client/commands/types";

/**
 * The definition behind an id, or a refusal.
 *
 * Shared because `enabled` and `run` both need the same lookup and the same
 * refusal, and the refusal is the object-wide invariant: a caller holding an id
 * for a command that does not exist has a defect that gets harder to find the
 * further it travels. The registry is total over `CommandId`, so this can only
 * fail for a caller that escaped the type — a stored binding, or a string cast.
 */
export const command = (state: CommandsState, id: CommandId): Command => {
  const found = state.registry[id];

  if (!found) {
    throw new Error(
      `No command "${id}". See src/lib/model/client/commands/commands.md.`
    );
  }

  return found;
};
