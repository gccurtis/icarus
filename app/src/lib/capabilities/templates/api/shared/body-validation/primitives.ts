import {
  hasExactFields,
  isStoredJson,
  storedFields
} from "$representation/data/behavior/core/stored";

export type Fields = Record<string, unknown>;

export const assertStoredValue = (value: unknown, subject: string): void => {
  if (!isStoredJson(value)) {
    throw new Error(`templates/${subject}: value must be exact current JSON data`);
  }
};

export const isRecord = (value: unknown): value is Fields =>
  storedFields(value) !== undefined;

export const isText = (value: unknown): value is string => typeof value === "string";

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const MAX_IDENTIFIER_LENGTH = 500;
export const MAX_BLOCK_TEXT_LENGTH = 100_000;
export const MAX_BLOCKS_PER_CONTAINER = 10_000;
export const MAX_STYLES = 512;
export const MAX_MARKS = 10_000;
export const MAX_VALUE_DEPTH = 20;

export const hasOnlyKeys = (value: Fields, allowed: readonly string[]): boolean =>
  hasExactFields(value, [], allowed);

export const validText = (
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string =>
  isText(value) && value.length <= maximum && (allowEmpty || value.length > 0);

export const validCanonicalText = (value: unknown, maximum: number): value is string =>
  validText(value, maximum) && value === value.trim();

export const validIdentifier = (value: unknown): value is string =>
  validCanonicalText(value, MAX_IDENTIFIER_LENGTH);

export const validInteger = (
  value: unknown,
  minimum: number,
  maximum: number
): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= minimum && value <= maximum;

export const addUniqueIdentifier = (seen: Set<string>, value: unknown): boolean => {
  if (!isText(value) || seen.has(value)) return false;
  seen.add(value);
  return true;
};
