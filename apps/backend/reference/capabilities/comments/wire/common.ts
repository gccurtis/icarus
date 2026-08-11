import { CommentWireError } from "../domain/errors.js";
import type { CommentTarget, JsonObject, JsonValue } from "../domain/model.js";

export const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new CommentWireError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new CommentWireError(`${label} contains unexpected field '${unexpected[0]}'`);
  }
};

export const stringField = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  if (typeof value[key] !== "string") {
    throw new CommentWireError(`${label} must be a string`);
  }
  return value[key];
};

const jsonValue = (value: unknown, ancestors: Set<object>): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") {
    throw new CommentWireError("Comment sub-target must contain JSON values only");
  }
  if (ancestors.has(value)) throw new CommentWireError("Comment sub-target cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => jsonValue(entry, ancestors));
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = jsonValue(entry, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
};

export const decodeTarget = (value: unknown, allowSubTarget: boolean): CommentTarget => {
  const target = record(value, "Comment target");
  exactKeys(
    target,
    allowSubTarget ? ["resourceKind", "resourceId", "subTarget"] : ["resourceKind", "resourceId"],
    "Comment target"
  );
  const result: CommentTarget = {
    resourceKind: stringField(target, "resourceKind", "Comment target resourceKind"),
    resourceId: stringField(target, "resourceId", "Comment target resourceId")
  };
  if (target.subTarget !== undefined) {
    if (!allowSubTarget) throw new CommentWireError("Comment query target cannot include subTarget");
    const candidate = target.subTarget;
    if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") {
      throw new CommentWireError("Comment sub-target must be a JSON object");
    }
    result.subTarget = jsonValue(candidate, new Set()) as JsonObject;
  }
  return result;
};
