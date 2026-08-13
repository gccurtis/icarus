// Deterministic rendering of a definition into one prompt fragment.
// Pure and synchronous. Same definition and selection always produce the same bytes.

import {
  PERSONA_SECTION_HEADINGS,
  PERSONA_SECTION_NAMES,
  type PersonaDefinition,
  type PersonaSectionName
} from "./model.js";

/**
 * Which sections would actually appear, in fixed render order.
 *
 * Order comes from PERSONA_SECTION_NAMES, never from the caller's selection
 * order — a consumer cannot reorder a persona by shuffling its section list.
 */
export const selectPersonaSections = (
  definition: PersonaDefinition,
  sections?: readonly PersonaSectionName[]
): readonly PersonaSectionName[] => {
  const requested = sections ? new Set(sections) : undefined;
  return PERSONA_SECTION_NAMES.filter(
    (section) =>
      (requested === undefined || requested.has(section)) &&
      definition[section].trim().length > 0
  );
};

/**
 * Render the selected, non-empty sections.
 *
 * - fixed order, independent of the order sections were selected in;
 * - a section that is empty, or not selected, is omitted with its heading;
 * - each body is trimmed; internal blank lines are preserved as authored;
 * - sections are joined by exactly one blank line; there is no trailing newline;
 * - the context reference is never rendered — it is scope, not text.
 *
 * A definition carrying only a context reference renders to an empty string.
 * Consumers must tolerate that and omit the message rather than sending a blank
 * system turn.
 */
export const renderPersona = (
  definition: PersonaDefinition,
  sections?: readonly PersonaSectionName[]
): string =>
  selectPersonaSections(definition, sections)
    .map((section) => `## ${PERSONA_SECTION_HEADINGS[section]}\n${definition[section].trim()}`)
    .join("\n\n");
