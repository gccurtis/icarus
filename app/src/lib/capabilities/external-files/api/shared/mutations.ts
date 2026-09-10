import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableRow
} from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import { admitExternalFileRow } from "$representation/data/behavior/external/row";
import { externalPathsConflict } from "$representation/data/behavior/external/file";
import type { ExternalFileResourceRef } from "$representation/data/types/core/resource";
import {
  enqueueSemanticOutboxFor,
  forgetSemanticResourceFor,
  type SemanticOutboxReceipt
} from "$capabilities/semantic-overlay";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import type { ExternalFileHistoryEvent } from "$capabilities/external-files/types/external-files";

type ExternalFileFields = Omit<TableRow<"externalFiles">, "_id" | "_creationTime">;

const fieldsOf = (row: TableRow<"externalFiles">): ExternalFileFields => {
  const { _id, _creationTime, ...fields } = row;
  void _id;
  void _creationTime;
  return fields;
};

export const semanticDisposition = (
  receipt: SemanticOutboxReceipt
): "queued" | "unsupported" =>
  receipt.jobId === undefined && receipt.materialJobId === undefined ? "unsupported" : "queued";

export const externalFileRef = (
  row: TableRow<"externalFiles">
): ExternalFileResourceRef => ({
  kind: externalFileResourceKind(row.subkind),
  id: row._id
});

export const externalPathIsAvailable = (
  store: StoreUnitOfWork,
  projectId: string,
  relativePath: string,
  excluding: ReadonlySet<string> = new Set()
): boolean => !rowsOf(store, "externalFiles").some(
  (row) =>
    row.projectId === projectId &&
    !excluding.has(row._id) &&
    externalPathsConflict(row.relativePath, relativePath)
);

type History = {
  readonly event: ExternalFileHistoryEvent;
  readonly detail?: string;
};

export const createExternalFileIn = (
  model: ServerModel,
  unit: StoreUnitOfWork,
  scope: Scope,
  fields: ExternalFileFields,
  history: History
): { readonly row: TableRow<"externalFiles">; readonly semantic: "queued" | "unsupported" } => {
  const id = unit.create("externalFiles", fields);
  const created = readCurrentRows(unit, "externalFiles").filter((row) => row._id === id);
  if (created.length !== 1) {
    throw new Error("The new External row was not readable in its transaction");
  }
  const row = admitExternalFileRow(
    created[0],
    externalFilesLimits(model.configuration).maxPathBytes
  );
  const projectId = asId<"projects">(scope.projectId);
  forgetSemanticResourceFor(unit, projectId, externalFileRef(row));
  recordExternalFileHistory(unit, scope, {
    ...history,
    externalFileId: row._id,
    name: row.name,
    relativePath: row.relativePath
  });
  const receipt = enqueueSemanticOutboxFor(
    model,
    unit,
    projectId,
    externalFileRef(row),
    row.revision
  );
  return { row, semantic: semanticDisposition(receipt) };
};

export const replaceExternalFileIn = (
  model: ServerModel,
  unit: StoreUnitOfWork,
  scope: Scope,
  row: TableRow<"externalFiles">,
  changes: Partial<ExternalFileFields>,
  history: History,
  at: number
): { readonly row: TableRow<"externalFiles">; readonly semantic: "queued" | "unsupported" } => {
  const fields: ExternalFileFields = {
    ...fieldsOf(row),
    ...changes,
    updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
    revision: row.revision + 1,
    updatedAt: at
  };
  if (
    fields.subkind !== "data" ||
    ("semanticContext" in changes && changes.semanticContext === undefined)
  ) {
    delete fields.semanticContext;
  }
  const next = admitExternalFileRow(
    { ...fields, _id: row._id, _creationTime: row._creationTime },
    externalFilesLimits(model.configuration).maxPathBytes
  );
  const projectId = asId<"projects">(scope.projectId);
  forgetSemanticResourceFor(unit, projectId, externalFileRef(row));
  unit.update(`externalFiles.${row._id}`, fields);
  recordExternalFileHistory(unit, scope, {
    ...history,
    externalFileId: next._id,
    name: next.name,
    relativePath: next.relativePath
  });
  const receipt = enqueueSemanticOutboxFor(
    model,
    unit,
    projectId,
    externalFileRef(next),
    next.revision
  );
  return { row: next, semantic: semanticDisposition(receipt) };
};

export const removeExternalFileIn = (
  model: ServerModel,
  unit: StoreUnitOfWork,
  scope: Scope,
  row: TableRow<"externalFiles">,
  detail: string
): void => {
  const projectId = asId<"projects">(scope.projectId);
  forgetSemanticResourceFor(
    unit,
    projectId,
    externalFileRef(row)
  );
  enqueueSemanticOutboxFor(
    model,
    unit,
    projectId,
    externalFileRef(row),
    row.revision + 1
  );
  unit.removeRows("externalFiles", [row._id]);
  recordExternalFileHistory(unit, scope, {
    event: "deleted",
    externalFileId: row._id,
    name: row.name,
    relativePath: row.relativePath,
    detail
  });
};
