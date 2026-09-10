import {
  onlyQueryFields,
  queryRecord,
  queryResourceSet
} from "$capabilities/semantic-overlay/api/shared/query-input";
import type { QuerySemanticOverlayInput } from "$capabilities/semantic-overlay/types/query-semantic-overlay";

const nonblank = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
};

export const validateQuerySemanticOverlay = (input: unknown): QuerySemanticOverlayInput => {
  const candidate = queryRecord(input, "semantic query input must be an object");
  onlyQueryFields(candidate, ["text", "topK", "scope"], "semantic query input");
  const text = nonblank(candidate.text, "semantic query text must not be blank");
  const topK = candidate.topK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) {
    throw new Error("semantic query topK must be an integer from 1 through 100");
  }
  return {
    text,
    topK: topK as number,
    ...(candidate.scope === undefined
      ? {}
      : { scope: queryResourceSet(candidate.scope, "semantic query scope") })
  };
};
