import type { StoreModel } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { projectResource } from "$representation/data/behavior/semantic/projection/project-resource";
import type { ProjectSemanticProjection } from "$representation/data/behavior/semantic/projection/contract";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

const MAX_EXTERNAL_TEXT_BYTES = 5_000_000;

const externalFileLookup = (store: StoreModel, projectId: Id<"projects">) => {
  const files = new Map(
    rowsOf(store, "externalFiles")
      .filter((file) => file.projectId === projectId)
      .map((file) => [file._id, file])
  );
  return (fileId: Id<"externalFiles">) => {
    const file = files.get(fileId);
    return file === undefined ? undefined : {
      fileId: file._id,
      name: file.name,
      mediaType: file.mediaType,
      subkind: file.subkind,
      hash: file.hash
    };
  };
};

/** Resolves an editable resource's leader revision without walking its body. */
export const readSemanticResourceRevisionFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): number | undefined => {
  if (ref.kind === "document") {
    const resource = rowsOf(store, "documents").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return resource === undefined
      ? undefined
      : rowsOf(store, "documentSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
        )?.revision;
  }
  if (ref.kind === "slides") {
    const resource = rowsOf(store, "slideDecks").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return resource === undefined
      ? undefined
      : rowsOf(store, "slideDeckSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
        )?.revision;
  }
  if (ref.kind === "externalFile" || ref.kind.startsWith("externalFile::")) {
    const file = rowsOf(store, "externalFiles").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (file === undefined) return undefined;
    const subkind = file.subkind;
    return subkind === "text" ? 0 : undefined;
  }
  return undefined;
};

/** Canonical queue identity for exact-text resources, without reading their body or bytes. */
export const readSemanticSyncTargetFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): { ref: ResourceRef; revision: number } | undefined => {
  const revision = readSemanticResourceRevisionFor(store, projectId, ref);
  if (revision === undefined) return undefined;
  if (ref.kind !== "externalFile" && !ref.kind.startsWith("externalFile::")) {
    return { ref, revision };
  }
  const file = rowsOf(store, "externalFiles").find(
    (row) => row.projectId === projectId && row._id === ref.id
  );
  if (file === undefined) return undefined;
  return { ref: { kind: "externalFile::text", id: file._id }, revision };
};

/** Reads one editable resource once and emits exact text plus material inventory. */
export const readProjectSemanticProjectionFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): ProjectSemanticProjection | undefined => {
  const externalFile = externalFileLookup(store, projectId);

  /** Reads a project-owned resource and produces the only text shape translation accepts. */
  if (ref.kind === "document") {
    const resource = rowsOf(store, "documents").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (resource === undefined) return undefined;
    const leader = rowsOf(store, "documentSnapshots").find(
      (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
    );
    if (leader === undefined) throw new Error(`Document '${ref.id}' has no leader snapshot`);
    return projectResource({
      kind: "document",
      ref,
      revision: leader.revision,
      title: resource.title,
      body: leader.body,
      externalFile
    });
  }

  if (ref.kind === "slides") {
    const resource = rowsOf(store, "slideDecks").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (resource === undefined) return undefined;
    const leader = rowsOf(store, "slideDeckSnapshots").find(
      (row) => row.projectId === projectId && row.resourceId === resource._id && row.role === "leader"
    );
    if (leader === undefined) throw new Error(`Slide deck '${ref.id}' has no leader snapshot`);
    return projectResource({
      kind: "slides",
      ref,
      revision: leader.revision,
      title: resource.title,
      body: leader.body,
      externalFile
    });
  }

  throw new Error(`Semantic projection does not support resource kind '${ref.kind}'`);
};

/** Reads a project-owned resource and produces the only text shape translation accepts. */
export const readSemanticResourceFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): SemanticResourceProjection | undefined => readProjectSemanticProjectionFor(store, projectId, ref)?.exact;

/** Worker/direct-read adapter that also resolves immutable UTF-8 external text. */
export const readSemanticResourceForModel = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): Promise<SemanticResourceProjection | undefined> => {
  if (ref.kind === "document" || ref.kind === "slides") {
    return readSemanticResourceFor(model.store, projectId, ref);
  }
  if (ref.kind !== "externalFile" && !ref.kind.startsWith("externalFile::")) return undefined;
  const file = rowsOf(model.store, "externalFiles").find(
    (row) => row.projectId === projectId && row._id === ref.id
  );
  if (file === undefined) return undefined;
  const subkind = file.subkind;
  if (subkind !== "text") return undefined;
  const bytes = await model.materialContent.read({ storageId: file.storageId, hash: file.hash });
  if (bytes === undefined) throw new Error(`Native text for '${file.name}' is unavailable`);
  if (bytes.byteLength > MAX_EXTERNAL_TEXT_BYTES) {
    throw new Error(`Native text for '${file.name}' exceeds the bounded exact-text limit`);
  }
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Native text for '${file.name}' is not valid UTF-8`);
  }
  const canonicalRef = { kind: "externalFile::text", id: file._id };
  return {
    ref: canonicalRef,
    revision: 0,
    contentHash: file.hash,
    text: content,
    encoding: "utf-16",
    locators: content.length === 0
      ? []
      : [{ from: 0, to: content.length, locator: { kind: "externalFileContent" } }],
    hardBoundaries: []
  };
};
