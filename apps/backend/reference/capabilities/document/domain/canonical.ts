import { createHash } from "node:crypto";
import type { DocumentSnapshot } from "./model.js";

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
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

export const canonicalize = (value: unknown): Uint8Array =>
  Buffer.from(JSON.stringify(canonicalValue(value)), "utf8");

export const canonicalDigest = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value)).digest("hex");

export const canonicalizeSnapshot = (snapshot: DocumentSnapshot): Uint8Array =>
  canonicalize(snapshot);

export const digestSnapshot = (snapshot: DocumentSnapshot): string =>
  canonicalDigest(snapshot);

export const digestFormulaExpression = (expression: string): string =>
  createHash("sha256").update(expression, "utf8").digest("hex");
