import type { UpdateInput } from "$capabilities/store/types/update";

export const validateUpdate = (input: unknown): UpdateInput => {
  if (input === null || typeof input !== "object") throw new Error("store/update: an input is an object");
  const { path, value } = input as { path?: unknown; value?: unknown };
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("store/update: path is a non-empty string");
  }
  if (value === undefined) throw new Error("store/update: value is required");
  return { path, value };
};
