import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { TemplatesError } from "$templates/errors";

/**
 * The template that id names, if the caller can see it: their project's, or one
 * belonging to no project at all.
 *
 * **Not found, never forbidden.** A template in another project answers exactly
 * as one that never existed, because telling them apart confirms it exists to
 * someone with no right to know that.
 *
 * An absent project column means "yours too", which is not the reading a call
 * site assumes, so the rule is stated once in this procedure rather than at
 * each one.
 */
export const requireTemplate = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"templates">
): Promise<Doc<"templates">> => {
  const template = await ctx.db.get(id);
  if (!template || (template.projectId !== undefined && template.projectId !== scope.projectId)) {
    throw new TemplatesError("not-found", `Template not found: ${id}`);
  }
  return template;
};
