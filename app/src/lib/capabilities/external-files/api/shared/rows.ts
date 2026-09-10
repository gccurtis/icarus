import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableRow
} from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import { admitExternalFileRow } from "$representation/data/behavior/external/row";
import type { Actor } from "$representation/data/types/core/actor";
import type { ExternalFileOrigin } from "$representation/data/types/external/file";
import {
  semanticStatusReaderFor,
  type SemanticStatusReader
} from "$capabilities/semantic-overlay";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import type {
  ExternalFileLibraryItem,
  ExternalFileOriginView,
  ExternalFileUnavailable
} from "$capabilities/external-files/types/external-files";

export const rowsOf = <T extends Parameters<StoreUnitOfWork["create"]>[0]>(
  store: StoreUnitOfWork,
  table: T
): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};

type ExternalFileRelations = {
  readonly users: readonly TableRow<"users">[];
  readonly memberships: readonly TableRow<"memberships">[];
  readonly connectors: readonly TableRow<"connectors">[];
  readonly agentTasks: readonly TableRow<"agentTasks">[];
};

/** All tables needed to project a file are admitted before availability is classified. */
const relationsIn = (store: StoreUnitOfWork): ExternalFileRelations => ({
  users: rowsOf(store, "users"),
  memberships: rowsOf(store, "memberships"),
  connectors: rowsOf(store, "connectors"),
  agentTasks: rowsOf(store, "agentTasks")
});

const actorName = (relations: ExternalFileRelations, scope: Scope, actor: Actor): string => {
  if (actor.kind === "system") return "Icarus";
  if (actor.kind === "user") {
    if (actor.userId === scope.userId) return scope.username;
    const visible = relations.memberships.some(
      (row) => row.projectId === scope.projectId && row.userId === actor.userId
    );
    if (!visible) return "Someone";
    const user = relations.users.find((row) => row._id === actor.userId);
    if (user === undefined) throw new Error("external file actor names an existing visible user");
    return user.displayName;
  }
  if (actor.kind === "connector") {
    const connector = relations.connectors.find(
      (row) => row.projectId === scope.projectId && row._id === actor.connectorId
    );
    if (connector === undefined) throw new Error("external file actor names a project connector");
    return connector.name;
  }
  const task = relations.agentTasks.find(
    (row) => row.projectId === scope.projectId && row._id === actor.taskId
  );
  if (task === undefined) throw new Error("external file actor names a project agent task");
  return task.title;
};

const originView = (
  relations: ExternalFileRelations,
  scope: Scope,
  value: ExternalFileOrigin
): ExternalFileOriginView => {
  if (value.kind === "upload") return { kind: "upload", label: "Uploaded" };
  if (!relations.connectors.some(
    (row) => row.projectId === scope.projectId && row._id === value.connectorId
  )) throw new Error("external file origin names a project connector");
  return {
    kind: "connector",
    label: "Connector",
    connectorId: value.connectorId,
    sourceId: value.sourceId
  };
};

export type AdmittedExternalFile = {
  readonly row: TableRow<"externalFiles">;
  readonly item: ExternalFileLibraryItem;
};

const projectItem = (
  scope: Scope,
  row: TableRow<"externalFiles">,
  semanticStatus: SemanticStatusReader,
  relations: ExternalFileRelations
): AdmittedExternalFile => {
  const admitted = row;
  const semantic = semanticStatus({
    kind: externalFileResourceKind(admitted.subkind),
    id: admitted._id
  });
  if (semantic === null) throw new Error("external file semantic status is readable");
  return {
    row: admitted,
    item: {
      id: admitted._id,
      name: admitted.name,
      originalName: admitted.originalName,
      relativePath: admitted.relativePath,
      mediaType: admitted.mediaType,
      subkind: admitted.subkind,
      size: admitted.size,
      revision: admitted.revision,
      createdAt: admitted._creationTime,
      updatedAt: admitted.updatedAt,
      createdByName: actorName(relations, scope, admitted.createdBy),
      updatedByName: actorName(relations, scope, admitted.updatedBy),
      origin: originView(relations, scope, admitted.origin),
      ...(admitted.semanticContext === undefined
        ? {}
        : { semanticContext: admitted.semanticContext }),
      semantic
    }
  };
};

export const externalFileRowIn = (
  store: StoreUnitOfWork,
  projectId: string,
  externalFileId: string,
  maxPathBytes: number
): TableRow<"externalFiles"> | null => {
  const row = rowsOf(store, "externalFiles").find(
    (candidate) => candidate.projectId === projectId && candidate._id === externalFileId
  );
  return row === undefined ? null : admitExternalFileRow(row, maxPathBytes);
};

export const externalFilesIn = (model: ServerModel, scope: Scope) => {
  const files: AdmittedExternalFile[] = [];
  const unavailable: ExternalFileUnavailable[] = [];
  const relations = relationsIn(model.store);
  const semanticStatus = semanticStatusReaderFor(model, asId<"projects">(scope.projectId));
  for (const row of rowsOf(model.store, "externalFiles")) {
    if (row.projectId !== scope.projectId) continue;
    const admitted = admitExternalFileRow(
      row,
      externalFilesLimits(model.configuration).maxPathBytes
    );
    try {
      files.push(projectItem(scope, admitted, semanticStatus, relations));
    } catch (error) {
      unavailable.push({
        unavailable: true,
        externalFileId: admitted._id,
        reason: "corrupt",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { files, unavailable };
};

export const externalFileIn = (
  model: ServerModel,
  scope: Scope,
  externalFileId: string
): AdmittedExternalFile | ExternalFileUnavailable | null => {
  const row = rowsOf(model.store, "externalFiles").find(
    (candidate) => candidate.projectId === scope.projectId && candidate._id === externalFileId
  );
  if (row === undefined) return null;
  const admitted = admitExternalFileRow(
    row,
    externalFilesLimits(model.configuration).maxPathBytes
  );
  const relations = relationsIn(model.store);
  const semanticStatus = semanticStatusReaderFor(model, asId<"projects">(scope.projectId));
  try {
    return projectItem(
      scope,
      admitted,
      semanticStatus,
      relations
    );
  } catch (error) {
    return {
      unavailable: true,
      externalFileId: admitted._id,
      reason: "corrupt",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
};
