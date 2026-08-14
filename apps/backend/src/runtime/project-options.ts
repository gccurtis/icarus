import type { Configuration } from "#configuration";

/**
 * Returns the project namespace this backend runtime serves.
 *
 * Project identity is opaque here: the composition root validates only that a
 * value exists, then passes it unchanged to project-scoped capabilities.
 */
export const requiredProjectId = (configuration: Configuration): string => {
  const value = configuration.get("projectId");
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Configuration key 'projectId' must be a non-empty string");
  }
  return value;
};
