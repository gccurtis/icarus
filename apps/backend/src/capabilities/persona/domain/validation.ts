// Ingress validation. Runs when a definition enters the capability, never on read.

import { PersonaValidationError } from "./errors.js";
import {
  PERSONA_SECTION_NAMES,
  type ContextEntry,
  type PersonaDefinition,
  type PersonaSectionName
} from "./model.js";

export interface PersonaLimits {
  /** Per-section cap. */
  readonly maxSectionChars: number;
  /** Cap on the five sections summed. */
  readonly maxDefinitionChars: number;
  readonly maxDisplayNameChars: number;
  readonly maxDescriptionChars: number;
  /** Cap on live records. */
  readonly maxPersonas: number;
}

export const DEFAULT_PERSONA_LIMITS: PersonaLimits = {
  maxSectionChars: 4_000,
  maxDefinitionChars: 12_000,
  maxDisplayNameChars: 120,
  maxDescriptionChars: 500,
  maxPersonas: 500
};

/** Live display names are compared case-insensitively, matching the SQLite index. */
export const normalizeDisplayNameKey = (displayName: string): string =>
  displayName.trim().toLowerCase();

export const validateDisplayName = (value: unknown, limits: PersonaLimits): string => {
  if (typeof value !== "string") {
    throw new PersonaValidationError("displayName", "must be a string");
  }
  const canonical = value.trim();
  if (canonical.length === 0) {
    throw new PersonaValidationError("displayName", "must not be blank");
  }
  if (canonical.length > limits.maxDisplayNameChars) {
    throw new PersonaValidationError(
      "displayName",
      `must be at most ${limits.maxDisplayNameChars} characters`
    );
  }
  return canonical;
};

export const validateDescription = (value: unknown, limits: PersonaLimits): string => {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new PersonaValidationError("description", "must be a string");
  }
  if (value.length > limits.maxDescriptionChars) {
    throw new PersonaValidationError(
      "description",
      `must be at most ${limits.maxDescriptionChars} characters`
    );
  }
  return value;
};

const validateContextEntry = (value: unknown): ContextEntry => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersonaValidationError("definition.context", "must be an object");
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id.length === 0) {
    throw new PersonaValidationError("definition.context.id", "must be a non-empty string");
  }
  if (typeof entry.kind !== "string" || entry.kind.length === 0) {
    throw new PersonaValidationError("definition.context.kind", "must be a non-empty string");
  }
  return { id: entry.id, kind: entry.kind };
};

/**
 * Validate and canonicalise a definition.
 *
 * Section bodies are trimmed on the way in, so trailing whitespace never changes
 * a digest. A definition must carry something: at least one non-empty section, or
 * a context reference. Five empty sections and no context means nothing and
 * renders to nothing, so it is rejected. Five empty sections *with* a context is
 * legal — a pure scope persona is a real persona.
 */
export const validateDefinition = (
  value: unknown,
  limits: PersonaLimits
): PersonaDefinition => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersonaValidationError("definition", "must be an object");
  }
  const raw = value as Record<string, unknown>;

  const sections: Record<PersonaSectionName, string> = {
    focus: "",
    background: "",
    approach: "",
    outputPreferences: "",
    verification: ""
  };

  let total = 0;
  for (const section of PERSONA_SECTION_NAMES) {
    const body = raw[section];
    if (body === undefined) continue;
    if (typeof body !== "string") {
      throw new PersonaValidationError(`definition.${section}`, "must be a string");
    }
    const trimmed = body.trim();
    if (trimmed.length > limits.maxSectionChars) {
      throw new PersonaValidationError(
        `definition.${section}`,
        `must be at most ${limits.maxSectionChars} characters`
      );
    }
    sections[section] = trimmed;
    total += trimmed.length;
  }

  if (total > limits.maxDefinitionChars) {
    throw new PersonaValidationError(
      "definition",
      `sections must total at most ${limits.maxDefinitionChars} characters`
    );
  }

  const context = raw.context === undefined ? undefined : validateContextEntry(raw.context);

  if (total === 0 && context === undefined) {
    throw new PersonaValidationError(
      "definition",
      "must carry at least one non-empty section or a context reference"
    );
  }

  return context ? { ...sections, context } : { ...sections };
};
