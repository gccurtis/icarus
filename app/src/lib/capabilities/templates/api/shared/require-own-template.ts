import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requireTemplate } from "$templates/api/shared/require-template";
import { TemplatesError } from "$templates/errors";

/**
 * The template that id names, and the caller's own — what every mutation that
 * changes one starts with.
 *
 * **A global is refused as "not editable", not as absent.** It is in the list the
 * caller just read, so answering "no such template" would deny something they can
 * see and withhold the one thing they need told: copy it, then edit the copy.
 * There is no sharing mechanism between the two, which is what keeps "who can
 * edit this" answerable from the template alone.
 */
export const requireOwnTemplate = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"templates">
): Promise<Doc<"templates">> => {
  const template = await requireTemplate(ctx, scope, id);
  if (template.projectId === undefined) {
    throw new TemplatesError(
      "not-editable",
      `Template ${id} is available to every project; copy it to edit it`
    );
  }
  return template;
};
