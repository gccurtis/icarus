import { Buffer } from "node:buffer";

import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  externalFileResourceKind,
  isExternalFileResourceKind
} from "$representation/data/behavior/core/resource";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import {
  isCsvFile,
  projectExternalFileMaterial
} from "$representation/data/behavior/semantic/materials/external-file";
import { codeLanguage } from "$representation/data/behavior/semantic/materials/code";
import { projectSpreadsheetMaterial } from "$representation/data/behavior/semantic/materials/spreadsheet";
import { readProjectSemanticProjectionFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { semanticMaximumNativeImageBytes } from "$capabilities/semantic-overlay/api/shared/configuration";

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
  if (isExternalFileResourceKind(ref.kind)) {
    const file = rowsOf(model.store, "externalFiles").find(
      (row) =>
        row.projectId === projectId &&
        row._id === ref.id &&
        externalFileResourceKind(row.subkind) === ref.kind
    );
    return file !== undefined &&
      (file.subkind === "code" || file.subkind === "data" || file.subkind === "image")
      ? file.revision
      : undefined;
  }
  return undefined;
};

export const readMaterialSyncTargetFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): MaterialSyncTarget | undefined => {
  const revision = readMaterialRevisionFor(model, projectId, ref);
  if (revision === undefined) return undefined;
  return { ref, revision };
};

const external = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  signal?: AbortSignal
): Promise<MaterialInventory | undefined> => {
  signal?.throwIfAborted();
  const file = rowsOf(model.store, "externalFiles").find(
    (row) =>
      row.projectId === projectId &&
      row._id === ref.id &&
      externalFileResourceKind(row.subkind) === ref.kind
  );
  if (file === undefined) return undefined;
  const subkind = file.subkind;
  const csv = isCsvFile(file.name, file.mediaType);
  const code = codeLanguage(file.name, file.mediaType) !== "unknown";
  const maximumNativeImageBytes = subkind === "image"
    ? semanticMaximumNativeImageBytes(model.configuration)
    : 0;
  const bytes = csv || code || (subkind === "image" && file.size <= maximumNativeImageBytes)
    ? await model.externalFileStorage.read({
        storageId: file.storageId,
        hash: file.hash,
        size: file.size
      }, signal)
    : undefined;
  signal?.throwIfAborted();
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
    ...(subkind === "image" && bytes !== undefined && bytes.byteLength <= maximumNativeImageBytes
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
  if (
    seed?.kind === "image" &&
    bytes !== undefined &&
    bytes.byteLength <= maximumNativeImageBytes
  ) {
    seed.nativeImage = {
      kind: "bytes",
      base64: Buffer.from(bytes).toString("base64"),
      mediaType: file.mediaType
    };
  }
  return { ref, revision: file.revision, seeds: seed === undefined ? [] : [seed] };
};

export const readMaterialInventoryFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  signal?: AbortSignal
): Promise<MaterialInventory | undefined> => {
  signal?.throwIfAborted();
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
  if (isExternalFileResourceKind(ref.kind)) {
    return external(model, projectId, ref, signal);
  }
  return undefined;
};
