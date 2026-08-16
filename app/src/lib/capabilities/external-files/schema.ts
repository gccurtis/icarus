import { defineTable } from "convex/server";
import { v } from "convex/values";
import { fileExtractionValidator, fileOriginValidator } from "$external-files/types/external-file";
import { fileKindValidator } from "$external-files/types/kind";
import { actorValidator } from "$shared/types/actor";

/**
 * Every file that arrives, whatever it is. A PNG, a PDF, and a CSV differ by
 * `kind` and by nothing else, because everything done with a file before anyone
 * looks inside it is identical.
 *
 * **`kind` is stored rather than computed on read**, so it can be indexed and so
 * a correction — a mislabelled extension, a better classifier — is a write
 * rather than a change in behaviour for files already here.
 *
 * **No `revision`.** Bytes are immutable, so a new version is a new row with
 * `supersedes` pointing at the one it replaces, and the old row stays readable
 * for every reference already made to it.
 *
 * `by_connector_external` is the re-sync match: same connector, same id at the
 * provider. It leads with `projectId` like every other index here — a connector
 * belongs to one project, so the column narrows nothing, but a read that can
 * forget the project predicate is the one worth making impossible.
 */
export const externalFilesTables = {
  externalFiles: defineTable({
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
    name: v.string(),
    extension: v.string(),
    mimeType: v.string(),
    size: v.number(),
    kind: fileKindValidator,
    origin: fileOriginValidator,
    supersedes: v.optional(v.id("externalFiles")),
    extraction: v.optional(fileExtractionValidator),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_connector_external", ["projectId", "origin.connectorId", "origin.externalId"])
};
