import type { ResourceRef } from "$representation/data/types/core/resource";
import { kindMatches } from "$representation/data/behavior/core/resource";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const resourceRef = (
  value: unknown,
  accepts: (kind: string) => boolean,
  expected: string
): ResourceRef => {
  const candidate = record(value);
  if (candidate === undefined) throw new Error("A semantic resource ref must be an object");
  if (typeof candidate.kind !== "string" || !accepts(candidate.kind)) {
    throw new Error(`A semantic resource ref kind must be ${expected}`);
  }
  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    candidate.id.length > 500
  ) {
    throw new Error("A semantic resource ref id must be 1 through 500 characters");
  }
  const unexpected = Object.keys(candidate).find((key) => key !== "kind" && key !== "id");
  if (unexpected !== undefined) {
    throw new Error(`A semantic resource ref has unexpected field '${unexpected}'`);
  }
  return { kind: candidate.kind, id: candidate.id.trim() };
};

/** Resource kinds that own an exact, quoteable text projection. */
export const semanticResourceRef = (value: unknown): ResourceRef =>
  resourceRef(
    value,
    (kind) =>
      kind === "document" ||
      kind === "slides",
    "'document' or 'slides'"
  );

/** Resource kinds whose save/upload event can enqueue either semantic lane. */
export const semanticIngestibleResourceRef = (value: unknown): ResourceRef =>
  resourceRef(
    value,
    (kind) =>
      kind === "document" ||
      kind === "slides" ||
      kind === "spreadsheet" ||
      kindMatches("externalFile", kind),
    "'document', 'slides', 'spreadsheet', or an 'externalFile' subkind"
  );

export const sameResourceRef = (left: ResourceRef, right: ResourceRef): boolean =>
  left.kind === right.kind && left.id === right.id;
