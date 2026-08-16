import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireOwnTemplate } from "$templates/api/shared/require-own-template";
import { TemplatesError } from "$templates/errors";
import { templateSlots } from "$templates/types/slot";
import { templateName, type TemplateDefinition } from "$templates/types/template";

/**
 * Replaces a template with the version the author has in front of them.
 *
 * **Nothing already created from it changes**, and that is the point of
 * instantiation being a full copy: an edit here cannot silently rewrite a
 * document belonging to someone who has never seen this template.
 *
 * **`revision` is the stale-form check.** Convex's transactions cover a read and
 * a write in one mutation; they do not cover a form opened before lunch, and a
 * whole-body replacement is exactly the write where that loses somebody's work.
 *
 * **The target cannot change.** A template that starts making decks instead of
 * documents is a different template, and every resource that recorded this one as
 * provenance would be pointing at something it did not come from.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"templates">,
  revision: number,
  definition: TemplateDefinition
): Promise<void> => {
  const template = await requireOwnTemplate(ctx, scope, id);

  if (template.revision !== revision) {
    throw new TemplatesError(
      "stale",
      `Template ${id} has moved to revision ${template.revision}`
    );
  }
  if (definition.body.target !== template.target) {
    throw new TemplatesError(
      "target-changed",
      `Template ${id} makes a ${template.target}, not a ${definition.body.target}`
    );
  }

  const named = templateName(definition.name);
  await ctx.db.patch(id, {
    name: named,
    description: definition.description,
    body: definition.body,
    slots: templateSlots(definition.slots),
    revision: template.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "revised",
    target: { type: "template", id, label: named }
  });
};
