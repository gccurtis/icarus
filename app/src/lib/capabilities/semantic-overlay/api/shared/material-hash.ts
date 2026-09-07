import { createHash } from "node:crypto";

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, held]) => held !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, held]) => [key, stable(held)])
    );
  }
  return value;
};

export const materialHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
