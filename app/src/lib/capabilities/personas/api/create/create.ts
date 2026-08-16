import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { personaDefinition } from "$personas/types/definition";
import { personaName, personaTools, type PersonaDraft } from "$personas/types/persona";
import type { Actor } from "$shared/types/actor";

/**
 * Defines a persona in the caller's project, and returns its id.
 *
 * **It always stamps the caller's project.** A global persona is one this
 * function cannot make: publishing to every project from inside one would let
 * any member put a row in everyone else's list.
 *
 * **A definition with five empty sections and a scope is accepted**, because
 * "work against this material" is a real persona. One with neither is refused —
 * see [`personaDefinition`](../../types/definition.ts).
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  persona: PersonaDraft
): Promise<Id<"personas">> => {
  const named = personaName(persona.name);
  const definition = personaDefinition(persona.definition, persona.scope);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("personas", {
    projectId: scope.projectId,
    name: named,
    description: persona.description,
    definition,
    scope: persona.scope,
    modelBinding: persona.modelBinding,
    tools: personaTools(persona.tools),
    avatar: persona.avatar,
    createdBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "persona", id, label: named }
  });

  return id;
};
