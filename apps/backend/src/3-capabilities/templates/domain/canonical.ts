import { createHash } from "node:crypto";
import type { TemplateCommand } from "./model.js";

/**
 * Sorted keys with `undefined` dropped, so a retry whose JSON happens to order
 * fields differently replays instead of failing as an idempotency mismatch.
 */
const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) sorted[key] = canonicalValue(item);
    }
    return sorted;
  }
  return value;
};

export const canonicalize = (value: unknown): string =>
  JSON.stringify(canonicalValue(value));

export const canonicalDigest = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value), "utf8").digest("hex");

export const digestTemplateCommand = (command: TemplateCommand): string =>
  canonicalDigest(command);
