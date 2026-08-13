import type { ConfigurationObject } from "#configuration/types/configuration-object.js";
import { isConfigurationObject } from "#configuration/types/configuration-object.js";

/**
 * Resolves a dot-separated key path against the loaded snapshot.
 *
 * A missing key, an empty segment, and a path that runs through a non-mapping
 * value are all the same answer: `undefined`. The caller decides whether that is
 * an error for the key it asked for.
 */
export const getConfigurationValue = (root: ConfigurationObject, key: string): unknown => {
  const segments = key.split(".");
  if (key.length === 0 || segments.some((segment) => segment.length === 0)) {
    return undefined;
  }

  let value: unknown = root;
  for (const segment of segments) {
    if (!isConfigurationObject(value) || !Object.hasOwn(value, segment)) {
      return undefined;
    }
    value = value[segment];
  }
  return value;
};
