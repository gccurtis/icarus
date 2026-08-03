// Strict decoding of the wire surface.
//
// Unknown keys are rejected rather than ignored. A client that misspells
// `expectedRevision` should be told, not silently given a create-shaped update
// with a missing CAS — and the same rule already governs the Formula builtins'
// option records, so the whole capability refuses typos consistently.

import { AnalyticWireError } from "../domain/errors.js";

export const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new AnalyticWireError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new AnalyticWireError(`${label} contains unexpected field '${unexpected[0]}'`);
  }
};

export const requiredString = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  const field = value[key];
  if (typeof field !== "string") {
    throw new AnalyticWireError(`${label}.${key} must be a string`);
  }
  return field;
};

export const optionalString = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string | undefined => {
  if (value[key] === undefined) return undefined;
  return requiredString(value, key, label);
};

export const requiredRevision = (
  value: Record<string, unknown>,
  label: string
): number => {
  const field = value.expectedRevision;
  if (!Number.isSafeInteger(field) || (field as number) < 1) {
    throw new AnalyticWireError(`${label}.expectedRevision must be a positive integer`);
  }
  return field as number;
};

/**
 * The definition is passed through untouched.
 *
 * `validateAnalyticDefinition` in the domain is the one place that knows what a
 * definition may contain, and it already rejects unknown shapes with a `field`
 * a client can act on. Re-checking here would be a second rule to keep in step
 * with the first, and the two would drift.
 */
export const passthroughDefinition = (
  value: Record<string, unknown>,
  label: string
): unknown => {
  if (value.definition === undefined) {
    throw new AnalyticWireError(`${label}.definition is required`);
  }
  return value.definition;
};
