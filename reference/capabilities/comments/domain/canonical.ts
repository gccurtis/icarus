import { createHash } from "node:crypto";
import type { CommentCommand, JsonObject, JsonValue } from "./model.js";

const canonicalizeValue = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  const object = value as JsonObject;
  const canonical: Record<string, JsonValue> = {};
  for (const key of Object.keys(object).sort()) {
    canonical[key] = canonicalizeValue(object[key]);
  }
  return canonical;
};

export const canonicalizeJsonObject = (value: JsonObject): JsonObject =>
  canonicalizeValue(value) as JsonObject;

export const digestCommentCommand = (command: CommentCommand): string =>
  createHash("sha256").update(JSON.stringify(command)).digest("hex");
