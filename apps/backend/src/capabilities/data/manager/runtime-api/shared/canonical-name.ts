import { DataManagerError } from "#data-manager/errors.js";

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Trims an authored name and admits it only as an ASCII identifier. The authored
 * casing survives; `nameKey` derives the case-insensitive lookup form.
 */
export const canonicalName = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw new DataManagerError("invalid-name", `${path} must be a string`);
  }
  const name = value.trim();
  if (!NAME_PATTERN.test(name)) {
    throw new DataManagerError(
      "invalid-name",
      `${path} must be an ASCII identifier beginning with a letter or underscore`
    );
  }
  return name;
};

export const nameKey = (name: string): string => name.toLowerCase();
