import type { RemoveInput } from "$capabilities/store/types/remove";

export const validateRemove = (input: unknown): RemoveInput => {
  if (input === null || typeof input !== "object") throw new Error("store/remove: an input is an object");
  const { path } = input as { path?: unknown };
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("store/remove: path is a non-empty string");
  }
  return { path };
};
