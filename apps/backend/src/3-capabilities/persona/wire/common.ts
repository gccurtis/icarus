import { PersonaWireError } from "../domain/errors.js";
import { PERSONA_SECTION_NAMES, type PersonaSectionName } from "../domain/model.js";

export const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new PersonaWireError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

/** Rejects unknown keys, not just missing ones. A client typo is a 400, not a
 *  silently dropped field. */
export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new PersonaWireError(`${label} contains unexpected field '${unexpected[0]}'`);
  }
};

export const stringField = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  if (typeof value[key] !== "string") {
    throw new PersonaWireError(`${label} must be a string`);
  }
  return value[key];
};

export const optionalStringField = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string | undefined => {
  if (value[key] === undefined) return undefined;
  return stringField(value, key, label);
};

/**
 * A revision must arrive as a genuine non-negative integer.
 *
 * Deliberately strict: coercing a missing value with Number() yields NaN, which
 * compares unequal to every stored revision and surfaces a malformed request as a
 * misleading revision conflict. A client retrying on 409 would retry forever.
 */
export const revisionField = (
  value: Record<string, unknown>,
  key: string,
  label: string
): number => {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
    throw new PersonaWireError(`${label} must be a non-negative integer`);
  }
  return candidate;
};

const SECTION_NAMES = new Set<string>(PERSONA_SECTION_NAMES);

export const sectionsField = (
  value: Record<string, unknown>,
  key: string,
  label: string
): readonly PersonaSectionName[] | undefined => {
  const candidate = value[key];
  if (candidate === undefined) return undefined;
  if (!Array.isArray(candidate)) {
    throw new PersonaWireError(`${label} must be an array`);
  }
  const sections: PersonaSectionName[] = [];
  for (const entry of candidate) {
    if (typeof entry !== "string" || !SECTION_NAMES.has(entry)) {
      throw new PersonaWireError(
        `${label} must contain only: ${PERSONA_SECTION_NAMES.join(", ")}`
      );
    }
    sections.push(entry as PersonaSectionName);
  }
  return sections;
};

/**
 * Decode a definition's shape only.
 *
 * Section lengths, the at-least-something rule, and context-entry field types are
 * validated in the domain, so this layer proves the payload is structurally a
 * definition and hands the rest over. Both layers reject; neither trusts the other.
 */
export const definitionField = (value: unknown, label: string): Record<string, unknown> => {
  const definition = record(value, label);
  exactKeys(definition, [...PERSONA_SECTION_NAMES, "context"], label);
  return definition;
};
