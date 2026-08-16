import { v, type Infer } from "convex/values";
import { PersonasError } from "$personas/errors";
import type { SetExpression } from "$shared/types/set-expression";

/**
 * How a persona behaves, as five sections answering five questions.
 *
 * | Section | Question |
 * | --- | --- |
 * | `focus` | what is this about? |
 * | `background` | what do you already know? |
 * | `approach` | how should you work? |
 * | `outputPreferences` | what comes out? |
 * | `verification` | when are you done? |
 *
 * **Not one instructions box.** No two sections answer the same question, and
 * the names are meant to be typed into a form by a person: `approach` rather
 * than "guidance", which is vague about guidance toward what.
 *
 * **`background` is not `scope`.** Background is short inline knowledge that is
 * always in the prompt, costing tokens on every call and never retrieved. Scope
 * is retrievable material that is never rendered and costs nothing until
 * something retrieves it. Authors conflate the two the moment they are given one
 * box, which is why they are two fields in two different places.
 */
export const personaDefinitionValidator = v.object({
  focus: v.string(),
  background: v.string(),
  approach: v.string(),
  outputPreferences: v.string(),
  verification: v.string()
});

export type PersonaDefinition = Infer<typeof personaDefinitionValidator>;

/** Reading order, which is also the order the form asks and the prompt renders. */
export const personaSections = [
  "focus",
  "background",
  "approach",
  "outputPreferences",
  "verification"
] as const;

/**
 * The stored form of a definition: every section trimmed, and something in it.
 *
 * **A definition must carry something — a section or a scope.** Five empty
 * sections with a scope is legal and renders to nothing, because "work against
 * this material" is a real persona with no behavioural text. Five empty sections
 * with no scope is a persona that means nothing, and it is refused here rather
 * than at the point where something tries to run it.
 *
 * An empty section is kept rather than dropped: all five are columns, and what
 * emptiness changes is the render, where the heading goes with it.
 */
export const personaDefinition = (
  definition: PersonaDefinition,
  scope?: SetExpression
): PersonaDefinition => {
  const trimmed = Object.fromEntries(
    personaSections.map((section) => [section, definition[section].trim()])
  ) as unknown as PersonaDefinition;

  if (scope === undefined && personaSections.every((section) => trimmed[section] === "")) {
    throw new PersonasError(
      "empty-definition",
      "A persona needs something to say or something to work against"
    );
  }

  return trimmed;
};
