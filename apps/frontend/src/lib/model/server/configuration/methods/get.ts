import type { ConfigurationObject } from "$model/server/configuration/types";
import { isConfigurationObject } from "$model/server/configuration/types";

/**
 * Resolves a dot-separated key path against the snapshot.
 *
 * A missing key, an empty segment, and a path running through a non-mapping are
 * all the same answer: `undefined`. The caller decides whether that is an error
 * for the key it asked for — this cannot know, and guessing would mean either
 * failing startup over an optional key or silently defaulting a required one.
 *
 * Own properties only. A key path must not reach `constructor` or `toString`
 * just because every object has one: configuration answers about what a file
 * declared.
 */
export const get = (root: ConfigurationObject, key: string): unknown => {
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
