// The built-in fallback persona.
//
// A code constant at revision 0. Not a table row, not editable, not deletable,
// and always resolvable — including against an empty database. Its purpose is to
// make consumers total without requiring a seeded row or a migration.

import { digestPersonaDefinition } from "./canonical.js";
import type { PersonaDefinition, PersonaRecord } from "./model.js";

export const BUILTIN_PERSONA_ID = "builtin:default";

export const isBuiltInPersonaId = (id: string): boolean => id === BUILTIN_PERSONA_ID;

const BUILTIN_DEFINITION: PersonaDefinition = {
  focus:
    "Address what was actually asked. Leave adjacent concerns alone unless they " +
    "change the answer.",
  background: "",
  approach:
    "Work from the evidence in scope. When the evidence does not support an " +
    "answer, say so plainly rather than filling the gap with plausible prose.",
  outputPreferences:
    "Prefer direct prose over hedging. Lead with the answer, then the reasoning " +
    "that supports it.",
  verification:
    "Check each claim against the material before presenting it as settled. " +
    "Distinguish what the evidence shows from what you inferred."
};

export const BUILTIN_PERSONA: PersonaRecord = {
  id: BUILTIN_PERSONA_ID,
  displayName: "Default",
  description: "Neutral baseline used when a consumer names no persona.",
  definition: BUILTIN_DEFINITION,
  revision: 0,
  definitionDigest: digestPersonaDefinition(BUILTIN_DEFINITION),
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z"
};
