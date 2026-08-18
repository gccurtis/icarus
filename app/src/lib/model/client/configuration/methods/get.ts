import type { ConfigurationSnapshot } from "$model/client/configuration/types";
import { isConfigurationObject } from "$model/client/configuration/types";

/**
 * Resolves a dot-separated key path against the snapshot.
 *
 * A missing key, an empty segment, and a path running through a non-mapping are
 * all the same answer: `undefined`. The caller decides whether that is an error
 * for the key it asked for — this cannot know, and guessing would mean either
 * failing the page over an optional key or silently defaulting a required one.
 *
 * Own properties only. A key path must not reach `constructor` or `toString`
 * just because every object has one: configuration answers about what was
 * published, not about what every JavaScript object inherits. That matters more
 * here than on the server, because the path can come from anywhere in the
 * client tree.
 *
 * Deliberately identical to
 * [its server twin](../../../server/configuration/methods/get.ts). Two copies of
 * fifteen lines is what the `environment` rule costs, and a client that resolved
 * paths differently from the server would be the worse outcome by far.
 */
export const get = (root: ConfigurationSnapshot, key: string): unknown => {
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
