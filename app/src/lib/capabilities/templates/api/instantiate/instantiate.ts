import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { ResourceKey } from "$revisions/types/change";
import { resourceFrom } from "$templates/api/instantiate/resource-from";
import { requireTemplate } from "$templates/api/shared/require-template";

/**
 * Starts a resource from a template.
 *
 * **The copy is full, and the resource owes the template nothing afterwards.** It
 * records `templateId` as provenance and holds every byte of its content itself,
 * so editing the template later leaves it untouched. The alternative — a resource
 * holding a diff against a live template — means an edit to a template someone
 * has never seen silently rewrites their document, and means no resource can be
 * read without also reading its template.
 *
 * A global template instantiates into the caller's project like any other; that
 * is what "available to every project" means.
 *
 * **Slot values are not substituted here.** The body already reads as a usable
 * starting point — a slot appears in it as ordinary content carrying the slot's
 * key — and filling one is an ordinary edit through `revisions`. A derived slot
 * becomes a prompt block, which arrives in pass 7.
 */
export const instantiate = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"templates">,
  title: string
): Promise<ResourceKey> => {
  const template = await requireTemplate(ctx, scope, id);
  const resource = await resourceFrom(ctx, scope, title, id, template.body);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "instantiated",
    target: { type: "template", id, label: template.name },
    // The resource capability wrote its own `created` entry and accepted the
    // title; this one answers the question that entry cannot — which template.
    context: { type: resource.resourceType, id: resource.resourceId, label: title.trim() }
  });

  return resource;
};
