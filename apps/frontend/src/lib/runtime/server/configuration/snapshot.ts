import type { Configuration, ConfigurationObject } from "$runtime/server/configuration/types";
import { isConfigurationObject } from "$runtime/server/configuration/types";

/**
 * Turning parsed YAML into a readable snapshot. Pure — nothing here touches the
 * filesystem, which is what lets it be tested against object literals rather
 * than against a directory of fixtures.
 */

const copyValue = (value: unknown): unknown => {
  if (isConfigurationObject(value)) return merge({}, value);
  if (Array.isArray(value)) return value.map(copyValue);
  return value;
};

/** Overlay wins. Nested plain objects merge; every other value replaces. */
export const merge = (
  base: ConfigurationObject,
  overlay: ConfigurationObject
): ConfigurationObject => {
  const result = Object.create(null) as ConfigurationObject;

  for (const [key, value] of Object.entries(base)) {
    result[key] = copyValue(value);
  }

  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    result[key] =
      isConfigurationObject(existing) && isConfigurationObject(value)
        ? merge(existing, value)
        : copyValue(value);
  }

  return result;
};

/**
 * Freezes the whole tree.
 *
 * Configuration is read by everything and owned by nobody, so a consumer that
 * mutated what it read would change what every later reader sees — a bug that
 * surfaces far from its cause. Freezing turns it into a throw at the write.
 */
export const freeze = (value: unknown): unknown => {
  if (isConfigurationObject(value)) {
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }

  if (Array.isArray(value)) {
    for (const child of value) freeze(child);
    return Object.freeze(value);
  }

  return value;
};

/**
 * Resolves a dot-separated key path against a snapshot.
 *
 * A missing key, an empty segment, and a path running through a non-mapping are
 * all the same answer: `undefined`. The caller decides whether that is an error
 * for the key it asked for — this cannot know, and guessing would mean either
 * failing startup over an optional key or silently defaulting a required one.
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

/** Reads one frozen snapshot loaded at startup. It is never reloaded. */
export class SnapshotConfiguration implements Configuration {
  constructor(private readonly root: ConfigurationObject) {}

  get(key: string): unknown {
    return getConfigurationValue(this.root, key);
  }
}
