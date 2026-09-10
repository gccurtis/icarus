import {
  hasExactFields,
  isStoredFinite,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const vector = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(isStoredFinite);

const configuration = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, [
    "branchFactor", "leafSize", "maxIterations", "convergenceTolerance", "candidateMultiplier"
  ]) && isStoredNatural(held.branchFactor) && held.branchFactor > 1 &&
    isStoredNatural(held.leafSize) && held.leafSize > 0 &&
    isStoredNatural(held.maxIterations) && held.maxIterations > 0 &&
    isStoredFinite(held.convergenceTolerance) && held.convergenceTolerance > 0 &&
    isStoredFinite(held.candidateMultiplier) && held.candidateMultiplier > 0;
};

const children = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined || !hasExactFields(held, ["kind", "ids"]) || !Array.isArray(held.ids)) {
    return false;
  }
  const table = held.kind === "nodes"
    ? "semanticIndexNodes"
    : held.kind === "objects"
      ? "semanticObjects"
      : undefined;
  return table !== undefined && held.ids.every((id) => isStoredRowId(id, table)) &&
    new Set(held.ids).size === held.ids.length;
};

export const isStoredSemanticIndex = (
  value: unknown
): value is TableRow<"semanticIndexes"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "semanticOverlayId", "method", "lane",
    "rootNodeIds", "configuration", "updatedAt"
  ]) && isStoredRowId(row._id, "semanticIndexes") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.semanticOverlayId, "semanticOverlays") &&
    row.method === "recursiveClustering" && (row.lane === "text" || row.lane === "material") &&
    Array.isArray(row.rootNodeIds) &&
    row.rootNodeIds.every((id) => isStoredRowId(id, "semanticIndexNodes")) &&
    new Set(row.rootNodeIds).size === row.rootNodeIds.length &&
    configuration(row.configuration) && isStoredTime(row.updatedAt);
};

export const isStoredSemanticIndexNode = (
  value: unknown
): value is TableRow<"semanticIndexNodes"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(
    row,
    ["_id", "_creationTime", "projectId", "indexId", "centroidVector", "children"],
    ["parentNodeId"]
  ) && isStoredRowId(row._id, "semanticIndexNodes") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredRowId(row.indexId, "semanticIndexes") &&
    (row.parentNodeId === undefined || isStoredRowId(row.parentNodeId, "semanticIndexNodes")) &&
    vector(row.centroidVector) && children(row.children);
};
