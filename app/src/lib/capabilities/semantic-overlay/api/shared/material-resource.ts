import { Buffer } from "node:buffer";

import type { ServerModel } from "$runtime/server/start.server";
import { fileSubkindFor } from "$representation/data/behavior/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import {
  isCsvFile,
  projectExternalFileMaterial
} from "$representation/data/behavior/semantic/materials/external-file";
import { codeLanguage } from "$representation/data/behavior/semantic/materials/code";
import { projectSpreadsheetMaterial } from "$representation/data/behavior/semantic/materials/spreadsheet";
import { readProjectSemanticProjectionFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

export type MaterialInventory = {
  ref: ResourceRef;
  revision: number;
  seeds: MaterialSeed[];
};

export type MaterialSyncTarget = {
  ref: ResourceRef;
  revision: number;
};

/** Cheap queue-time revision lookup; native reads and profiling stay in the worker. */
export const readMaterialRevisionFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): number | undefined => {
  if (ref.kind === "document") {
    const resource = rowsOf(model.store, "documents").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return resource === undefined
      ? undefined
      : rowsOf(model.store, "documentSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
        )?.revision;
  }
  if (ref.kind === "slides") {
    const resource = rowsOf(model.store, "slideDecks").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return resource === undefined
      ? undefined
      : rowsOf(model.store, "slideDeckSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
        )?.revision;
  }
  if (ref.kind === "spreadsheet") {
    const resource = rowsOf(model.store, "spreadsheets").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return resource === undefined
      ? undefined
      : rowsOf(model.store, "spreadsheetSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
        )?.revision;
  }
  if (ref.kind === "externalFile" || ref.kind.startsWith("externalFile::")) {
    return rowsOf(model.store, "externalFiles").some(
      (row) => row.projectId === projectId && row._id === ref.id
    ) ? 0 : undefined;
  }
  return undefined;
};

/** Resolves aliases such as `externalFile` to the one persisted resource kind used everywhere else. */
export const readMaterialSyncTargetFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): MaterialSyncTarget | undefined => {
  const revision = readMaterialRevisionFor(model, projectId, ref);
  if (revision === undefined) return undefined;
  if (ref.kind !== "externalFile" && !ref.kind.startsWith("externalFile::")) {
    return { ref, revision };
  }
  const file = rowsOf(model.store, "externalFiles").find(
    (row) => row.projectId === projectId && row._id === ref.id
  );
  if (file === undefined) return undefined;
  const subkind = file.subkind ?? fileSubkindFor(file.mediaType, file.name);
  return { ref: { kind: `externalFile::${subkind}`, id: file._id }, revision };
};

const external = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): Promise<MaterialInventory | undefined> => {
  const file = rowsOf(model.store, "externalFiles").find(
    (row) => row.projectId === projectId && row._id === ref.id
  );
  if (file === undefined) return undefined;
  const subkind = file.subkind ?? fileSubkindFor(file.mediaType, file.name);
  const csv = isCsvFile(file.name, file.mediaType);
  const code = codeLanguage(file.name, file.mediaType) !== "unknown";
  const bytes = subkind === "image" || csv || code
    ? await model.materialContent.read({ storageId: file.storageId, hash: file.hash })
    : undefined;
  let text: string | undefined;
  if (bytes !== undefined && (code || csv)) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  const seed = projectExternalFileMaterial({
    fileId: file._id,
    name: file.name,
    mediaType: file.mediaType,
    subkind,
    hash: file.hash,
    ...(subkind === "image" && bytes !== undefined && bytes.byteLength <= 5_000_000
      ? {
          nativeImage: {
            kind: "bytes" as const,
            base64: Buffer.from(bytes).toString("base64"),
            mediaType: file.mediaType
          }
        }
      : {})
  }, text);
  if (seed === undefined && subkind === "data") {
    throw new Error(`Native content for '${file.name}' is unavailable or unsupported`);
  }
  if (seed?.kind === "image" && bytes !== undefined && bytes.byteLength <= 5_000_000) {
    seed.nativeImage = {
      kind: "bytes",
      base64: Buffer.from(bytes).toString("base64"),
      mediaType: file.mediaType
    };
  }
  return { ref, revision: 0, seeds: seed === undefined ? [] : [seed] };
};

export const readMaterialInventoryFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): Promise<MaterialInventory | undefined> => {
  if (ref.kind === "document" || ref.kind === "slides") {
    const projected = readProjectSemanticProjectionFor(model.store, projectId, ref);
    return projected === undefined
      ? undefined
      : { ref, revision: projected.exact.revision, seeds: projected.materials };
  }
  if (ref.kind === "spreadsheet") {
    const resource = rowsOf(model.store, "spreadsheets").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (resource === undefined) return undefined;
    const leader = rowsOf(model.store, "spreadsheetSnapshots").find(
      (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
    );
    if (leader === undefined) throw new Error(`Spreadsheet '${ref.id}' has no leader snapshot`);
    const cells = rowsOf(model.store, "sheetCells").filter(
      (cell) => cell.projectId === projectId && cell.resourceId === resource._id
    );
    return {
      ref,
      revision: leader.revision,
      seeds: [projectSpreadsheetMaterial({
        ref,
        revision: leader.revision,
        title: resource.title,
        body: leader.body,
        cells
      })]
    };
  }
  if (ref.kind === "externalFile" || ref.kind.startsWith("externalFile::")) {
    return external(model, projectId, ref);
  }
  return undefined;
};
