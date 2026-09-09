import type { StoreUnitOfWork, TableName, TableRow } from "$model/server/store/index.server";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutputFields } from "$representation/data/types/semantic/derived-output";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import { fileSubkindFor } from "$representation/data/behavior/external/file";
import { materialRecordIsCurrent } from "$capabilities/semantic-overlay";

export const rowsOf = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) return [];
  return found.rows as unknown as readonly TableRow<T>[];
};

export const outputOf = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  id: Id<"derivedOutputs">
): TableRow<"derivedOutputs"> | undefined =>
  rowsOf(store, "derivedOutputs").find(
    (output) => output._id === id && output.projectId === projectId
  );

const fieldsOf = (output: TableRow<"derivedOutputs">): DerivedOutputFields => {
  const { _id, _creationTime, ...fields } = output;
  void _id;
  void _creationTime;
  return fields;
};

/** Replaces one row in a single store write and deliberately removes undefined optionals. */
export const writeOutput = (
  store: StoreUnitOfWork,
  output: TableRow<"derivedOutputs">,
  patch: Partial<DerivedOutputFields>
): TableRow<"derivedOutputs"> => {
  const fields = Object.fromEntries(
    Object.entries({ ...fieldsOf(output), ...patch }).filter(([, value]) => value !== undefined)
  );
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
    const ref = { kind: "document", id: snapshot.resourceId };
    active.set(`${ref.kind}\u0000${ref.id}`, { ref, revision: snapshot.revision, encoding: "utf-16" });
  }
  const decks = new Set(
    rowsOf(store, "slideDecks")
      .filter((row) => row.projectId === projectId)
      .map((row) => row._id)
  );
  for (const snapshot of rowsOf(store, "slideDeckSnapshots")) {
    if (snapshot.projectId !== projectId || snapshot.role !== "leader" || !decks.has(snapshot.resourceId)) continue;
    const ref = { kind: "slides", id: snapshot.resourceId };
    active.set(`${ref.kind}\u0000${ref.id}`, { ref, revision: snapshot.revision, encoding: "utf-16" });
  }
  for (const file of rowsOf(store, "externalFiles")) {
    if (file.projectId !== projectId) continue;
    const subkind = file.subkind ?? fileSubkindFor(file.mediaType, file.name);
    if (subkind !== "text") continue;
    const ref = { kind: "externalFile::text", id: file._id };
    active.set(`${ref.kind}\u0000${ref.id}`, {
      ref,
      revision: 0,
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
