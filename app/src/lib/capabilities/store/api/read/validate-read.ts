import type { ReadInput } from "$capabilities/store/types/read";

export const validateRead = (input: unknown): ReadInput => {
  if (input === null || typeof input !== "object") throw new Error("store/read: an input is an object");
  const { path } = input as { path?: unknown };
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("store/read: path is a non-empty string");
  }
  return { path };
};
