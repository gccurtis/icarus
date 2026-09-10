import { isResourceRef } from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredSemanticLocator } from "$representation/data/behavior/semantic/stored-citations";
import type { TableRow } from "$representation/store/tables";

const locatorSpan = (value: unknown): boolean => {
  const span = storedFields(value);
  return span !== undefined &&
    hasExactFields(span, ["from", "to", "locator"]) &&
    isStoredNatural(span.from) && isStoredNatural(span.to) && span.to > span.from &&
    isStoredSemanticLocator(span.locator);
};

const embedding = (value: unknown): boolean => {
  const space = storedFields(value);
  return space !== undefined && hasExactFields(space, ["provider", "model", "dimensions"]) &&
    space.provider === "jina" && isStoredText(space.model, 500) && space.model.length > 0 &&
    isStoredNatural(space.dimensions) && space.dimensions > 0;
};

export const isStoredSemanticOverlay = (
  value: unknown
): value is TableRow<"semanticOverlays"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "generation", "embedding", "updatedAt"
  ]) && isStoredRowId(row._id, "semanticOverlays") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredNatural(row.generation) &&
    embedding(row.embedding) && isStoredTime(row.updatedAt);
};

export const isStoredSemanticSource = (
  value: unknown
): value is TableRow<"semanticSources"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(
    row,
    ["_id", "_creationTime", "projectId", "ref", "revision", "encoding", "updatedAt"],
    ["contentHash", "locators", "hardBoundaries"]
  ) && isStoredRowId(row._id, "semanticSources") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isResourceRef(row.ref) &&
    isStoredNatural(row.revision) &&
    (row.contentHash === undefined || (
      isStoredText(row.contentHash, 1_000) && row.contentHash.length > 0
    )) &&
    (row.encoding === "utf-8" || row.encoding === "utf-16") &&
    (row.locators === undefined || (
      Array.isArray(row.locators) && row.locators.every(locatorSpan)
    )) &&
    (row.hardBoundaries === undefined || (
      Array.isArray(row.hardBoundaries) && row.hardBoundaries.every(isStoredNatural)
    )) && isStoredTime(row.updatedAt);
};

type JobTable = "semanticSyncJobs" | "semanticMaterialJobs";

const semanticJob = (value: unknown, table: JobTable): boolean => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(
    row,
    [
      "_id", "_creationTime", "projectId", "ref", "requestedRevision", "state",
      "attempts", "queuedAt", "updatedAt"
    ],
    ["force", "error", "startedAt", "claimId", "leaseExpiresAt"]
  ) && isStoredRowId(row._id, table) && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isResourceRef(row.ref) &&
    isStoredNatural(row.requestedRevision) &&
    (row.force === undefined || typeof row.force === "boolean") &&
    (row.state === "queued" || row.state === "running" || row.state === "failed") &&
    isStoredNatural(row.attempts) &&
    (row.error === undefined || isStoredText(row.error, 10_000)) &&
    isStoredTime(row.queuedAt) &&
    (row.startedAt === undefined || isStoredTime(row.startedAt)) &&
    (row.claimId === undefined || isStoredIdentifier(row.claimId)) &&
    (row.leaseExpiresAt === undefined || isStoredTime(row.leaseExpiresAt)) &&
    isStoredTime(row.updatedAt);
};

export const isStoredSemanticSyncJob = (
  value: unknown
): value is TableRow<"semanticSyncJobs"> => semanticJob(value, "semanticSyncJobs");

export const isStoredSemanticMaterialJob = (
  value: unknown
): value is TableRow<"semanticMaterialJobs"> => semanticJob(value, "semanticMaterialJobs");
