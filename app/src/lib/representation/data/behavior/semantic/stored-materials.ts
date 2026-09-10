import { isResourceRef } from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredChoice,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import {
  isStoredMaterialLocator,
  isStoredMaterialSource
} from "$representation/data/behavior/semantic/stored-citations";
import { isStoredMaterialProfile } from "$representation/data/behavior/semantic/stored-material-profile";
import type { TableRow } from "$representation/store/tables";

const authoredContext = (value: unknown): boolean => {
  const context = storedFields(value);
  return context !== undefined && hasExactFields(
    context,
    ["nearbyText", "notes"],
    ["title", "caption", "alt", "userDescription"]
  ) && [context.title, context.caption, context.alt, context.userDescription].every(
    (entry) => entry === undefined || isStoredText(entry, 10_000)
  ) && Array.isArray(context.nearbyText) &&
    context.nearbyText.every((entry) => isStoredText(entry, 10_000)) &&
    Array.isArray(context.notes) && context.notes.every((entry) => isStoredText(entry, 10_000));
};

const coverage = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["mode", "description"]) &&
    (held.mode === "complete" || held.mode === "sampled") && isStoredText(held.description);
};

const descriptor = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(
    held,
    [
      "summary", "entities", "measures", "dimensions", "themes", "uncertainty", "coverage",
      "model", "promptVersion", "inputHash", "generatedAt"
    ],
    ["purpose", "timeRange"]
  ) && isStoredText(held.summary) &&
    (held.purpose === undefined || isStoredText(held.purpose, 10_000)) &&
    [held.entities, held.measures, held.dimensions, held.themes, held.uncertainty].every(
      (entries) => Array.isArray(entries) && entries.every((entry) => isStoredText(entry, 10_000))
    ) && (held.timeRange === undefined || isStoredText(held.timeRange, 10_000)) &&
    coverage(held.coverage) && isStoredText(held.model, 500) && held.model.length > 0 &&
    isStoredText(held.promptVersion, 500) && held.promptVersion.length > 0 &&
    isStoredText(held.inputHash, 1_000) && held.inputHash.length > 0 &&
    isStoredTime(held.generatedAt);
};

const materialFields = (
  value: unknown,
  identity: boolean
): Record<string, unknown> | undefined => {
  const material = storedFields(value);
  const required = [
    "projectId", "identityKey", "kind", "name", "source", "profile", "profileHash",
    "contextHash", "revisionKey", "state", "updatedAt"
  ];
  if (identity) required.unshift("_id", "_creationTime");
  if (material === undefined || !hasExactFields(
    material,
    required,
    ["userDescription", "descriptor", "error"]
  ) || (identity && (
    !isStoredRowId(material._id, "semanticMaterials") || !isStoredTime(material._creationTime)
  )) || !isStoredRowId(material.projectId, "projects") ||
    !isStoredText(material.identityKey, 1_000) || material.identityKey.length === 0 ||
    !isStoredChoice(material.kind, ["table", "csv", "chart", "image", "code"]) ||
    !isStoredText(material.name, 10_000) || material.name.length === 0 ||
    !isStoredMaterialSource(material.source) || !isStoredMaterialProfile(material.profile) ||
    storedFields(material.profile)?.kind !== material.kind ||
    ![material.profileHash, material.contextHash, material.revisionKey].every(
      (entry) => isStoredText(entry, 1_000) && entry.length > 0
    ) || (material.userDescription !== undefined && !isStoredText(material.userDescription)) ||
    (material.descriptor !== undefined && !descriptor(material.descriptor)) ||
    !isStoredChoice(material.state, ["profiled", "describing", "ready", "stale", "error"]) ||
    (material.error !== undefined && !isStoredText(material.error, 10_000)) ||
    !isStoredTime(material.updatedAt)) return undefined;
  return material;
};

export const isStoredSemanticMaterial = (
  value: unknown
): value is TableRow<"semanticMaterials"> => materialFields(value, true) !== undefined;

export const isStoredSemanticMaterialPlacement = (
  value: unknown
): value is TableRow<"semanticMaterialPlacements"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "semanticMaterialId", "ref", "revision", "locator",
    "context", "contextHash", "updatedAt"
  ]) && isStoredRowId(row._id, "semanticMaterialPlacements") &&
    isStoredTime(row._creationTime) && isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.semanticMaterialId, "semanticMaterials") && isResourceRef(row.ref) &&
    isStoredNatural(row.revision) && isStoredMaterialLocator(row.locator) &&
    authoredContext(row.context) && isStoredText(row.contextHash, 1_000) &&
    row.contextHash.length > 0 && isStoredTime(row.updatedAt);
};

export const isStoredSemanticMaterialHistory = (
  value: unknown
): value is TableRow<"semanticMaterialHistory"> => {
  const row = storedFields(value);
  const material = row === undefined ? undefined : materialFields(row.material, false);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "retiredGeneration", "material", "retiredAt"
  ]) && isStoredRowId(row._id, "semanticMaterialHistory") &&
    isStoredTime(row._creationTime) && isStoredRowId(row.projectId, "projects") &&
    isStoredNatural(row.retiredGeneration) && material !== undefined &&
    material.projectId === row.projectId && isStoredTime(row.retiredAt);
};
