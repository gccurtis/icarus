import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";
import { templateSlots } from "$templates/types/slot";
import { templateName, type TemplateDefinition } from "$templates/types/template";

/**
 * Defines a template in the caller's project.
 *
 * **`target` is written from `body.target` rather than accepted**, which is what
 * makes the two copies of it incapable of disagreeing. A caller that could send
 * both could produce a template a picker files under documents and instantiation
 * turns into a deck.
 *
 * **It always stamps the caller's project.** A global template is one this
 * function cannot make: publishing to every project from inside one would let any
 * member of any project put a row in everyone else's list.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  definition: TemplateDefinition
): Promise<Id<"templates">> => {
  const named = templateName(definition.name);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("templates", {
    projectId: scope.projectId,
    name: named,
    description: definition.description,
    target: definition.body.target,
    body: definition.body,
    slots: templateSlots(definition.slots),
    createdBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "template", id, label: named }
  });

  return id;
};
