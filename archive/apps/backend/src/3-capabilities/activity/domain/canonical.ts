import { createHash } from "node:crypto";
import type { ActivityTransaction } from "./model.js";

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

const canonicalizeValue = (value: unknown): CanonicalValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Activity metadata cannot contain a non-finite number");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const canonical: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(object).sort()) {
      if (object[key] !== undefined) canonical[key] = canonicalizeValue(object[key]);
    }
    return canonical;
  }
  throw new Error("Activity metadata must be JSON-compatible");
};

export const canonicalizeMetadata = (
  metadata: Readonly<Record<string, unknown>> | undefined
): Record<string, CanonicalValue> => canonicalizeValue(metadata ?? {}) as Record<string, CanonicalValue>;

/**
 * Activity owns this digest. A source's own semantic digest may describe its
 * snapshot rather than the complete transaction being published.
 */
export const digestActivityTransaction = (transaction: ActivityTransaction): string => {
  const normalized = {
    id: transaction.id,
    kind: transaction.kind,
    resourceId: transaction.resourceId ?? null,
    operation: transaction.operation,
    revision: transaction.revision ?? null,
    changeSetId: transaction.changeSetId ?? null,
    actorId: transaction.actorId ?? null,
    origin: transaction.origin,
    occurredAt: transaction.occurredAt,
    metadata: canonicalizeMetadata(transaction.metadata)
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};
