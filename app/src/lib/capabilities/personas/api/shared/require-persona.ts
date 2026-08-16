import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { PersonasError } from "$personas/errors";

/**
 * The persona that id names, if the caller can see it: their project's, or one
 * belonging to no project at all.
 *
 * **Not found, never forbidden.** A persona in another project answers exactly
 * as one that never existed, because telling them apart confirms it exists to
 * someone with no right to know that.
 *
 * It is promoted here because the rule spans capabilities: opening a chat with a
 * persona has to resolve one the same way editing it does, and stating "absent
 * means yours too" twice is how the two answers start to differ.
 */
export const requirePersona = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"personas">
): Promise<Doc<"personas">> => {
  const persona = await ctx.db.get(id);
  if (!persona || (persona.projectId !== undefined && persona.projectId !== scope.projectId)) {
    throw new PersonasError("not-found", `Persona not found: ${id}`);
  }
  return persona;
};
