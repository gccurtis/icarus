import { isResourceRef } from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredFinite,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { SemanticObjectSnapshot } from "$representation/data/types/semantic/overlay";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import type { TableRow } from "$representation/store/tables";

const vector = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(isStoredFinite);

const span = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["from", "to", "text"]) &&
    isStoredNatural(held.from) && isStoredNatural(held.to) && held.to > held.from &&
    isStoredText(held.text);
};

export const isStoredSemanticSourceSnapshot = (
  value: unknown
): value is SemanticSourceSnapshot => {
  const source = storedFields(value);
  return source !== undefined && hasExactFields(
    source,
    ["ref", "revision", "encoding"],
    ["contentHash"]
  ) && isResourceRef(source.ref) && isStoredNatural(source.revision) &&
    (source.contentHash === undefined || isStoredText(source.contentHash, 1_000)) &&
    (source.encoding === "utf-8" || source.encoding === "utf-16");
};

const materialFields = (held: Record<string, unknown>): boolean => {
  if (held.lane !== "material" || !isStoredRowId(held.semanticMaterialId, "semanticMaterials") ||
    (held.facetText !== undefined && !isStoredText(held.facetText)) ||
    !isStoredText(held.inputHash, 1_000) || held.inputHash.length === 0 || !vector(held.vector)) {
    return false;
  }
  if (held.facet === "authored" || held.facet === "generated") {
    return Array.isArray(held.scopeRefs) && held.scopeRefs.every(isResourceRef);
  }
  return (held.facet === "identity" || held.facet === "profile" || held.facet === "nativeVisual") &&
    held.scopeRefs === undefined;
};

/** Exact discriminated current semantic-object row; mixed text/material arms fail. */
export const isStoredSemanticObject = (
  value: unknown
): value is TableRow<"semanticObjects"> => {
  const row = storedFields(value);
  if (row === undefined || !isStoredRowId(row._id, "semanticObjects") ||
    !isStoredTime(row._creationTime) || !isStoredRowId(row.projectId, "projects")) return false;
  if (row.lane === "text") {
    return hasExactFields(row, [
      "_id", "_creationTime", "projectId", "vector", "lane", "semanticSourceId", "span"
    ]) && vector(row.vector) && isStoredRowId(row.semanticSourceId, "semanticSources") && span(row.span);
  }
  return hasExactFields(
    row,
    ["_id", "_creationTime", "projectId", "vector", "lane", "semanticMaterialId", "inputHash", "facet"],
    ["facetText", "scopeRefs"]
  ) && materialFields(row);
};

/** Exact current by-value semantic object used by retirement history. */
export const isStoredSemanticObjectSnapshot = (
  value: unknown
): value is SemanticObjectSnapshot => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.lane === "text") {
    return hasExactFields(held, ["lane", "source", "span", "vector"]) &&
      isStoredSemanticSourceSnapshot(held.source) && span(held.span) && vector(held.vector);
  }
  return hasExactFields(
    held,
    ["lane", "semanticMaterialId", "inputHash", "vector", "facet"],
    ["facetText", "scopeRefs"]
  ) && materialFields(held);
};

/** Exact current semantic-object history row and its recursive object snapshot. */
export const isStoredSemanticObjectHistory = (
  value: unknown
): value is TableRow<"semanticObjectHistory"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "retiredGeneration", "object", "retiredAt"
  ]) && isStoredRowId(row._id, "semanticObjectHistory") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredNatural(row.retiredGeneration) &&
    isStoredSemanticObjectSnapshot(row.object) && isStoredTime(row.retiredAt);
};
