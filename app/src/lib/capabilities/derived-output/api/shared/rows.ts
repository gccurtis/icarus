import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName,
  type TableRow
} from "$model/server/store/index.server";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutputFields } from "$representation/data/types/semantic/derived-output";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import { isStoredDerivedOutput } from "$representation/data/behavior/semantic/stored-derived-output";
import { materialRecordIsCurrent } from "$capabilities/semantic-overlay";

/** Internal transition patch; the resulting whole row is still admitted before writing. */
export type DerivedOutputPatch = {
  [K in keyof DerivedOutputFields]?: DerivedOutputFields[K];
};

export const rowsOf = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};

export const outputOf = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  id: Id<"derivedOutputs">
): TableRow<"derivedOutputs"> | undefined =>
  rowsOf(store, "derivedOutputs").find(
    (output) => output._id === id && output.projectId === projectId
  );

const chosen = <K extends keyof DerivedOutputFields>(
  output: TableRow<"derivedOutputs">,
  patch: DerivedOutputPatch,
  field: K
): DerivedOutputFields[K] | undefined =>
  Object.hasOwn(patch, field) ? patch[field] : output[field];

const outputFields = (
  output: TableRow<"derivedOutputs">,
  patch: DerivedOutputPatch
): DerivedOutputFields => {
  const candidate = Object.fromEntries(Object.entries({
    _id: output._id,
    _creationTime: output._creationTime,
    projectId: chosen(output, patch, "projectId"),
    prompt: chosen(output, patch, "prompt"),
    definitionRevision: chosen(output, patch, "definitionRevision"),
    origin: chosen(output, patch, "origin"),
    template: chosen(output, patch, "template"),
    scope: chosen(output, patch, "scope"),
    valueSource: chosen(output, patch, "valueSource"),
    queries: chosen(output, patch, "queries"),
    evidence: chosen(output, patch, "evidence"),
    lastVariables: chosen(output, patch, "lastVariables"),
    lastResponse: chosen(output, patch, "lastResponse"),
    lastRevision: chosen(output, patch, "lastRevision"),
    lastGeneration: chosen(output, patch, "lastGeneration"),
    state: chosen(output, patch, "state"),
    error: chosen(output, patch, "error"),
    refreshedAt: chosen(output, patch, "refreshedAt"),
    createdBy: chosen(output, patch, "createdBy"),
    updatedAt: chosen(output, patch, "updatedAt")
  }).filter(([, value]) => value !== undefined));
  if (!isStoredDerivedOutput(candidate)) {
    throw new Error("the derived output update is not a complete current row");
  }
  const { _id, _creationTime, ...current } = candidate;
  void _id;
  void _creationTime;
  return current;
};

/** Replaces one row in a single store write and deliberately removes undefined optionals. */
export const writeOutput = (
  store: StoreUnitOfWork,
  output: TableRow<"derivedOutputs">,
  patch: DerivedOutputPatch
): TableRow<"derivedOutputs"> => {
  if (!isStoredDerivedOutput(output)) {
    throw new Error("the derived output to update is not a complete current row");
  }
  const fields = outputFields(output, patch);
  store.update(`derivedOutputs.${output._id}`, fields);
  const written = outputOf(store, output.projectId, output._id);
  if (written === undefined) throw new Error("derived output disappeared during a synchronous write");
  return written;
};

export const responseBlock = (
  output: TableRow<"derivedOutputs">,
  revision: number,
  text: string,
  at: number
): TextBlock => ({
  id: `${output._id}:response:${revision}`,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${output._id}:response:${revision}:text`, kind: "literal", text }],
  display: text,
  marks: [],
  resolvedAt: at
});

export const activeSources = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">
) => {
  const active = new Map<string, SemanticSourceSnapshot>(
    rowsOf(store, "semanticSources")
      .filter((source) => source.projectId === projectId)
      .map((source) => [`${source.ref.kind}\u0000${source.ref.id}`, {
        ref: source.ref,
        revision: source.revision,
        ...(source.contentHash === undefined ? {} : { contentHash: source.contentHash }),
        encoding: source.encoding
      }] as const)
  );
  const documents = new Set(
    rowsOf(store, "documents")
      .filter((row) => row.projectId === projectId)
      .map((row) => row._id)
  );
  for (const snapshot of rowsOf(store, "documentSnapshots")) {
    if (snapshot.projectId !== projectId || snapshot.role !== "leader" || !documents.has(snapshot.resourceId)) continue;
    const ref = { kind: "document" as const, id: snapshot.resourceId };
    active.set(`${ref.kind}\u0000${ref.id}`, { ref, revision: snapshot.revision, encoding: "utf-16" });
  }
  const decks = new Set(
    rowsOf(store, "slideDecks")
      .filter((row) => row.projectId === projectId)
      .map((row) => row._id)
  );
  for (const snapshot of rowsOf(store, "slideDeckSnapshots")) {
    if (snapshot.projectId !== projectId || snapshot.role !== "leader" || !decks.has(snapshot.resourceId)) continue;
    const ref = { kind: "slides" as const, id: snapshot.resourceId };
    active.set(`${ref.kind}\u0000${ref.id}`, { ref, revision: snapshot.revision, encoding: "utf-16" });
  }
  for (const file of rowsOf(store, "externalFiles")) {
    if (file.projectId !== projectId) continue;
    const subkind = file.subkind;
    if (subkind !== "text") continue;
    const ref = { kind: "externalFile::text" as const, id: file._id };
    active.set(`${ref.kind}\u0000${ref.id}`, {
      ref,
      revision: file.revision,
      contentHash: file.hash,
      encoding: "utf-16"
    });
  }
  return [...active.values()];
};

export const activeMaterials = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">
) => {
  const placements = rowsOf(store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId
  );
  return rowsOf(store, "semanticMaterials")
    .filter((material) =>
      material.projectId === projectId &&
      material.state === "ready" &&
      materialRecordIsCurrent(store, projectId, material, placements)
    )
    .map((material) => ({
    materialId: material._id,
    kind: material.kind,
    name: material.name,
    source: material.source,
    profileHash: material.profileHash,
    contextHash: material.contextHash,
    revisionKey: material.revisionKey
    }));
};

export const currentGeneration = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">
): number => {
  const overlay = rowsOf(store, "semanticOverlays")
    .filter((candidate) => candidate.projectId === projectId)
    .sort((left, right) => right.generation - left.generation)[0];
  if (overlay === undefined) throw new Error("The project has no active Semantic Overlay");
  return overlay.generation;
};
