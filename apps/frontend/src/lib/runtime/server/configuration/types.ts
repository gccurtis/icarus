/**
 * A parsed YAML mapping. Values stay `unknown` because every consumer owns the
 * validation rules for the keys it reads — configuration provides no defaults,
 * coerces nothing, and asserts no shapes.
 */
export type ConfigurationObject = Record<string, unknown>;

/**
 * The configuration snapshot. Every consumer reads its keys through this and
 * owns the validation rules for the values it reads.
 *
 * Deliberately one method. A richer interface — typed getters, schemas,
 * defaults — would put every consumer's expectations in one place, and the
 * place that knows whether `logging.level` may be absent is the thing that
 * reads it.
 */
export interface Configuration {
  get(key: string): unknown;
}

/**
 * Decides what counts as a mapping.
 *
 * Arrays and non-plain objects are values, so neither merging nor key traversal
 * descends into them — a configured array replaces rather than concatenating,
 * which is what someone editing a list expects.
 */
export const isConfigurationObject = (value: unknown): value is ConfigurationObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};
