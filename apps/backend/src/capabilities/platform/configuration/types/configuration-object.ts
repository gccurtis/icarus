/**
 * A parsed YAML mapping. Values stay `unknown` because every consumer owns the
 * validation rules for the keys it reads.
 */
export type ConfigurationObject = Record<string, unknown>;

/**
 * Decides what counts as a mapping. Arrays and non-plain objects are values, so
 * neither merging nor key traversal descends into them.
 */
export const isConfigurationObject = (value: unknown): value is ConfigurationObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
