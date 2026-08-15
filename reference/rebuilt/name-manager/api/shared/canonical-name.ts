import { NameManagerError } from "$name-manager/errors";

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Trims an authored name and admits it only as an ASCII identifier.
 *
 * The pattern is deliberately narrower than "a non-empty string". These names
 * are meant to be written in formulas, so a name that needs quoting or escaping
 * to be referenced is a name that will be got wrong — and widening later is
 * possible, while narrowing after people have named things is not.
 *
 * `path` names the field being admitted so a nested failure says which one.
 */
export const canonicalName = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw new NameManagerError("invalid-name", `${path} must be a string`);
  }
  const name = value.trim();
  if (!NAME_PATTERN.test(name)) {
    throw new NameManagerError(
      "invalid-name",
      `${path} must be an ASCII identifier beginning with a letter or underscore`
    );
  }
  return name;
};

/**
 * The case-insensitive lookup form.
 *
 * Uniqueness is by this and storage is by this, while `name` keeps what the
 * author wrote. That is what makes `Total` and `total` the same variable while
 * still showing the author their own casing back.
 */
export const nameKey = (name: string): string => name.toLowerCase();
