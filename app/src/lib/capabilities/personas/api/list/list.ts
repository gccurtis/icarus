import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { asPersona } from "$personas/api/list/as-persona";
import type { Persona } from "$personas/types/persona";

/**
 * Every persona the caller may work with: their project's, and the ones
 * belonging to no project.
 *
 * **Two ranges of one index, never a scan.** A missing field indexes as
 * `undefined` and sorts before every id, so the globals are a key range of their
 * own — `eq("projectId", undefined)` is exactly them, and the project range
 * cannot stray into another project's rows. That is the whole reason the
 * optional column still leads the index.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Persona[]> => {
  const mine = await ctx.db
    .query("personas")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  const everyone = await ctx.db
    .query("personas")
    .withIndex("by_project", (q) => q.eq("projectId", undefined))
    .collect();

  return [...mine, ...everyone].map(asPersona);
};
