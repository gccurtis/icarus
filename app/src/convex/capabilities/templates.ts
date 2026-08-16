import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createTemplate } from "$templates/api/create/create";
import { instantiate as instantiateTemplate } from "$templates/api/instantiate/instantiate";
import { list as listTemplates } from "$templates/api/list/list";
import { remove as removeTemplate } from "$templates/api/remove/remove";
import { revise as reviseTemplate } from "$templates/api/revise/revise";
import { templateBodyValidator } from "$templates/types/body";
import { templateSlotValidator } from "$templates/types/slot";

/**
 * Templates' public surface — `api.capabilities.templates.*`.
 *
 * **Every function here is project-scoped, including the ones that read global
 * templates.** A global template is available to every project, not to everyone:
 * the caller still has to hold a membership before it is listed for them.
 *
 * **There is no `target` argument anywhere.** It is read off the body, so the
 * label and the content it labels cannot be sent disagreeing.
 *
 * `create` and `revise` take the whole definition rather than a patch, because a
 * skeleton has no partial edit — an absent field would have to mean either
 * "unchanged" or "cleared" without being able to say which.
 */
const definition = {
  name: v.string(),
  description: v.optional(v.string()),
  body: templateBodyValidator,
  slots: v.array(templateSlotValidator)
};

export const list = projectQuery({
  args: {},
  handler: (ctx) => listTemplates(ctx, ctx.scope)
});

export const create = projectMutation({
  args: definition,
  handler: (ctx, args) => createTemplate(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: { templateId: v.id("templates"), revision: v.number(), ...definition },
  handler: (ctx, args) =>
    reviseTemplate(ctx, ctx.scope, args.templateId, args.revision, args)
});

export const instantiate = projectMutation({
  args: { templateId: v.id("templates"), title: v.string() },
  handler: (ctx, args) => instantiateTemplate(ctx, ctx.scope, args.templateId, args.title)
});

export const remove = projectMutation({
  args: { templateId: v.id("templates") },
  handler: (ctx, args) => removeTemplate(ctx, ctx.scope, args.templateId)
});
