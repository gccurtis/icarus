import { personaSections, type PersonaDefinition } from "$personas/types/definition";

/** What each section is called where a model reads it. */
const headings: Record<(typeof personaSections)[number], string> = {
  focus: "Focus",
  background: "Background",
  approach: "Approach",
  outputPreferences: "Output preferences",
  verification: "Verification"
};

/**
 * The definition as the text a model is given.
 *
 * **An empty section is omitted entirely, heading included** — an empty heading
 * is an instruction to fill it in, which is not what an author meant by leaving
 * it blank.
 *
 * **`scope` is not here and never will be.** It names retrievable material,
 * which widens what the work can find and costs nothing until something
 * retrieves it; rendering it would spend tokens on every call to say what is
 * already reachable.
 *
 * A pure scope persona renders to the empty string, which is why
 * [`personaSystemMessages`](prompt.ts) exists beside this.
 */
export const renderPersonaPrompt = (definition: PersonaDefinition): string =>
  personaSections
    .filter((section) => definition[section] !== "")
    .map((section) => `## ${headings[section]}\n\n${definition[section]}`)
    .join("\n\n");

/**
 * What this persona contributes to a conversation's system messages: one, or
 * none.
 *
 * **None is the pure scope case**, and it is a list rather than a possibly-empty
 * string so a consumer omits the message by having none to send rather than by
 * remembering to check. A blank system turn is worse than no system turn: it
 * spends a turn saying nothing and some providers refuse it outright.
 */
export const personaSystemMessages = (definition: PersonaDefinition): readonly string[] => {
  const prompt = renderPersonaPrompt(definition);
  return prompt === "" ? [] : [prompt];
};
