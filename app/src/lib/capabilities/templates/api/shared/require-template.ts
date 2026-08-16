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
 * The global case is the only place in the schema where an absent tenant column
 * means "yours too", so it is stated once here rather than at each call site.
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
