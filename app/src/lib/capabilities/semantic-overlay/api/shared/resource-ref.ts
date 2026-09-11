import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  admitResourceRef,
  isExternalFileResourceKind,
  sameResourceRef
} from "$representation/data/behavior/core/resource";

const resourceRef = (
  value: unknown,
  accepts: (ref: ResourceRef) => boolean,
  expected: string
): ResourceRef => {
  let candidate: ResourceRef;
  try {
    candidate = admitResourceRef(value, "semantic resource ref");
  } catch {
    throw new Error("A semantic resource ref must have an exact current kind and matching row id");
  }
  if (!accepts(candidate)) {
    throw new Error(`A semantic resource ref kind must be ${expected}`);
  }
  return candidate;
};

/** Resource kinds that own an exact, quoteable text projection. */
export const semanticResourceRef = (value: unknown): ResourceRef =>
  resourceRef(
    value,
    (ref) =>
      ref.kind === "document" ||
      ref.kind === "presentation" ||
      ref.kind === "externalFile::text",
    "'document', 'presentation', or 'externalFile::text'"
  );

/** Resource kinds whose save/upload event can enqueue either semantic lane. */
export const semanticIngestibleResourceRef = (value: unknown): ResourceRef =>
  resourceRef(
    value,
    (ref) =>
      ref.kind === "document" ||
      ref.kind === "presentation" ||
      ref.kind === "spreadsheet" ||
      isExternalFileResourceKind(ref.kind),
    "'document', 'presentation', 'spreadsheet', or an 'externalFile' subkind"
  );

export { sameResourceRef };
