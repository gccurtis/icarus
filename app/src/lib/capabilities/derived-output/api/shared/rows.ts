import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutputFields } from "$representation/data/types/semantic/derived-output";

export const rowsOf = <T extends TableName>(
  store: StoreModel,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) return [];
  return found.rows as unknown as readonly TableRow<T>[];
};

export const outputOf = (
  store: StoreModel,
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
  store: StoreModel,
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

export const activeSources = (
  store: StoreModel,
  projectId: Id<"projects">
) =>
  rowsOf(store, "semanticSources")
    .filter((source) => source.projectId === projectId)
    .map((source) => ({
      ref: source.ref,
      revision: source.revision,
      encoding: source.encoding
    }));

export const currentGeneration = (
  store: StoreModel,
  projectId: Id<"projects">
): number => {
  const overlay = rowsOf(store, "semanticOverlays")
    .filter((candidate) => candidate.projectId === projectId)
    .sort((left, right) => right.generation - left.generation)[0];
  if (overlay === undefined) throw new Error("The project has no active Semantic Overlay");
  return overlay.generation;
};
