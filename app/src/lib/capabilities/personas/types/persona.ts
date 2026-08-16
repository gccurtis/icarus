import { v, type Infer } from "convex/values";
import type { Id } from "$convex/_generated/dataModel";
import { PersonasError } from "$personas/errors";
import type { PersonaDefinition } from "$personas/types/definition";
import type { Actor } from "$shared/types/actor";
import type { SetExpression } from "$shared/types/set-expression";

/** A face, either drawn from the keyboard or uploaded. Both optional; so is having one. */
export const personaAvatarValidator = v.object({
  emoji: v.optional(v.string()),
  fileId: v.optional(v.id("externalFiles"))
});

export type PersonaAvatar = Infer<typeof personaAvatarValidator>;

/**
 * A persona as anything showing one renders it.
 *
 * **The definition comes with it.** Unlike a template's body there is no
 * authored page to drag across the wire — five short sections is the whole of
 * it, and an editor opened from a list would otherwise need a second read to
 * show what it is about to change.
 *
 * `global` replaces `projectId`: what a caller needs is whether this one is
 * theirs to edit, and the id of a project they are already scoped to says
 * nothing.
 */
export type Persona = {
  readonly id: Id<"personas">;
  readonly name: string;
  readonly description?: string;
  readonly definition: PersonaDefinition;
  readonly scope?: SetExpression;
  readonly modelBinding?: string;
  readonly tools: readonly string[];
  readonly avatar?: PersonaAvatar;
  readonly global: boolean;
  readonly createdBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/** Everything a persona is stated as. `create` and `revise` take the same shape. */
export type PersonaDraft = {
  readonly name: string;
  readonly description?: string;
  readonly definition: PersonaDefinition;
  readonly scope?: SetExpression;
  readonly modelBinding?: string;
  readonly tools: readonly string[];
  readonly avatar?: PersonaAvatar;
};

/**
 * The stored form of a name: trimmed, and never empty.
 *
 * A persona is an identity — it is mentioned, attributed, and picked from a list
 * by this and nothing else, so one named with spaces is a row nobody can address.
 */
export const personaName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new PersonasError("empty-name", "A persona is addressed by name, so it needs one");
  }
  return trimmed;
};

/**
 * The stored form of the tool list: names, trimmed, without blanks or repeats.
 *
 * **A flat list, not grants.** Scopes, conditions, and expiry would be a
 * permission model elaborate enough to get wrong, and the enforcement point is
 * the tool implementation regardless — absence from this list is the whole
 * restriction, and an empty list is a persona that can only read and write.
 *
 * A repeat is dropped rather than refused because it says nothing: there is no
 * second grant for it to be.
 */
export const personaTools = (tools: readonly string[]): string[] => [
  ...new Set(tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0))
];
