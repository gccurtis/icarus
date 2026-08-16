import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireOwnPersona } from "$personas/api/revise/require-own-persona";
import { PersonasError } from "$personas/errors";
import { personaDefinition } from "$personas/types/definition";
import { personaName, personaTools, type PersonaDraft } from "$personas/types/persona";

/**
 * Replaces a persona with the version the author has in front of them.
 *
 * **Everything that references it shows the new one**, because a task holds an
 * id rather than a copy. That is the point — a persona is an identity, and
 * someone looking at last week's task wants to know who did it — and it is also
 * why `revision` matters here: an edit against a form opened before lunch would
 * quietly restate work already in progress.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"personas">,
  revision: number,
  draft: PersonaDraft
): Promise<void> => {
  const persona = await requireOwnPersona(ctx, scope, id);
  if (persona.revision !== revision) {
    throw new PersonasError("stale", `Persona ${id} has moved to revision ${persona.revision}`);
  }

  const named = personaName(draft.name);
  await ctx.db.patch(id, {
    name: named,
    description: draft.description,
    definition: personaDefinition(draft.definition, draft.scope),
    scope: draft.scope,
    modelBinding: draft.modelBinding,
    tools: personaTools(draft.tools),
    avatar: draft.avatar,
    revision: persona.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "revised",
    target: { type: "persona", id, label: named }
  });
};
