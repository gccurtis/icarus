import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { create as createDocument } from "$documents/api/create/create";
import type { ResourceKey } from "$revisions/types/change";
import { create as createDeck } from "$slide-decks/api/create/create";
import { create as createSpreadsheet } from "$spreadsheets/api/create/create";
import { resourceBodyOf, type TemplateBody } from "$templates/types/body";

/**
 * Makes the resource a template's body describes, through the capability that
 * owns it.
 *
 * **The row is not written here.** What a document row looks like is `documents`'
 * business, and going around it would duplicate the title rule, the attribution,
 * the activity entry, and the snapshot anchor — four things that would then be
 * free to drift from the ones an ordinary `create` writes.
 *
 * The body is handed over as a value the resource capability stores unread, which
 * is why the copy is complete from this moment and owes the template nothing.
 */
export const resourceFrom = async (
  ctx: MutationCtx,
  scope: Scope,
  title: string,
  templateId: Id<"templates">,
  body: TemplateBody
): Promise<ResourceKey> => {
  if (body.target === "document") {
    return {
      resourceType: "document",
      resourceId: await createDocument(ctx, scope, title, templateId, resourceBodyOf(body))
    };
  }
  if (body.target === "slides") {
    return {
      resourceType: "slides",
      resourceId: await createDeck(
        ctx,
        scope,
        title,
        body.aspectRatio,
        templateId,
        resourceBodyOf(body)
      )
    };
  }
  return {
    resourceType: "spreadsheet",
    resourceId: await createSpreadsheet(ctx, scope, title, templateId, resourceBodyOf(body))
  };
};
