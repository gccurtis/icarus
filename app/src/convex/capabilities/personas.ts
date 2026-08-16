import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createPersona } from "$personas/api/create/create";
import { list as listPersonas } from "$personas/api/list/list";
import { revise as revisePersona } from "$personas/api/revise/revise";
import { personaDefinitionValidator } from "$personas/types/definition";
import { personaAvatarValidator } from "$personas/types/persona";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * Personas' public surface — `api.capabilities.personas.*`.
 *
 * **Every function here is project-scoped, including the ones that read global
 * personas.** A global persona is available to every project, not to everyone:
 * the caller still has to hold a membership before it is listed for them.
 *
 * **There is no `projectId` argument, so nothing here can publish globally.**
 * A persona for every project is seeded, not created from inside one.
 *
 * `create` and `revise` take the whole persona rather than a patch, because an
 * absent field would have to mean either "unchanged" or "cleared" without being
 * able to say which — and clearing a section is how a persona gets simpler.
 */
const draft = {
  name: v.string(),
  description: v.optional(v.string()),
  definition: personaDefinitionValidator,
  scope: v.optional(setExpressionValidator),
  modelBinding: v.optional(v.string()),
  tools: v.array(v.string()),
  avatar: v.optional(personaAvatarValidator)
};

export const list = projectQuery({
  args: {},
  handler: (ctx) => listPersonas(ctx, ctx.scope)
});

export const create = projectMutation({
  args: draft,
  handler: (ctx, args) => createPersona(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: { personaId: v.id("personas"), revision: v.number(), ...draft },
  handler: (ctx, args) => revisePersona(ctx, ctx.scope, args.personaId, args.revision, args)
});
