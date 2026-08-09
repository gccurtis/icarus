// Deterministic codec — RichContent ↔ Uint8Array.

import type { RichContent } from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode RichContent to a deterministic UTF-8 byte sequence.
 * Uses JSON.stringify with sorted keys for determinism.
 */
export function encode(content: RichContent): Uint8Array {
  // Deterministic serialization: sort mark keys so same content always
  // produces the same bytes.
  const json = JSON.stringify(content, (_key, value) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Sort object keys for determinism
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
  return encoder.encode(json);
}

/**
 * Decode a RichContent from a UTF-8 byte sequence.
 */
export function decode(bytes: Uint8Array): RichContent {
  const json = decoder.decode(bytes);
  return JSON.parse(json) as RichContent;
}