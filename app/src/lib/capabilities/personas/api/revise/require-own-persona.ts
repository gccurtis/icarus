import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requirePersona } from "$personas/api/shared/require-persona";
import { PersonasError } from "$personas/errors";

/**
 * The persona that id names, and the caller's own.
 *
 * **A global is refused as "not editable", not as absent.** It is in the list
 * the caller just read, so answering "no such persona" would deny something they
 * can see and withhold the one thing they need told: copy it, then edit the copy.
 */
export const requireOwnPersona = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"personas">
): Promise<Doc<"personas">> => {
  const persona = await requirePersona(ctx, scope, id);
  if (persona.projectId === undefined) {
    throw new PersonasError(
      "not-editable",
      `Persona ${id} is available to every project; copy it to edit it`
    );
  }
  return persona;
};
