import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { asThread } from "$persona-threads/api/shared/as-thread";
import type { PersonaThread } from "$persona-threads/types/persona-thread";

/**
 * The project's chats, or the ones with one persona.
 *
 * `by_persona` is what makes the narrow form one indexed range, and it is the
 * form a persona's own page reads — "what have we been asking this one".
 */
export const list = async (
  ctx: QueryCtx,
  scope: Scope,
  personaId?: Id<"personas">
): Promise<PersonaThread[]> => {
  const rows = personaId
    ? await ctx.db
        .query("personaThreads")
        .withIndex("by_persona", (q) =>
          q.eq("projectId", scope.projectId).eq("personaId", personaId)
        )
        .collect()
    : await ctx.db
        .query("personaThreads")
        .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
        .collect();

  return rows.map(asThread);
};
