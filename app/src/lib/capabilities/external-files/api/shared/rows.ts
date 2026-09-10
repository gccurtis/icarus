import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
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
  const found = store.read(table);
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

const actorName = (store: StoreUnitOfWork, scope: Scope, actor: Actor): string => {
  if (actor.kind === "system") return "Icarus";
  if (actor.kind === "user") {
    if (actor.userId === scope.userId) return scope.username;
    const visible = rowsOf(store, "memberships").some(
      (row) => row.projectId === scope.projectId && row.userId === actor.userId
    );
    return visible
      ? rowsOf(store, "users").find((row) => row._id === actor.userId)?.displayName ?? "Someone"
      : "Someone";
  }
  if (actor.kind === "connector") {
    return rowsOf(store, "connectors").find(
      (row) => row.projectId === scope.projectId && row._id === actor.connectorId
    )?.name ?? "A connector";
  }
  return rowsOf(store, "agentTasks").find(
    (row) => row.projectId === scope.projectId && row._id === actor.taskId
  )?.title ?? "An agent";
};

const originView = (value: ExternalFileOrigin): ExternalFileOriginView => value.kind === "upload"
  ? { kind: "upload", label: "Uploaded" }
  : {
      kind: "connector",
      label: "Connector",
      connectorId: value.connectorId,
      sourceId: value.sourceId
    };

export type AdmittedExternalFile = {
  readonly row: TableRow<"externalFiles">;
  readonly item: ExternalFileLibraryItem;
};

const projectItem = (
  model: ServerModel,
  scope: Scope,
  row: TableRow<"externalFiles">,
  semanticStatus: SemanticStatusReader
): AdmittedExternalFile => {
  const admitted = admitExternalFileRow(row, externalFilesLimits(model.configuration).maxPathBytes);
  if (admitted.projectId !== scope.projectId) throw new Error("external file belongs to the project");
  const semantic = semanticStatus({
    kind: `externalFile::${admitted.subkind}`,
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
      createdByName: actorName(model.store, scope, admitted.createdBy),
      updatedByName: actorName(model.store, scope, admitted.updatedBy),
      origin: originView(admitted.origin),
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
  const semanticStatus = semanticStatusReaderFor(model, asId<"projects">(scope.projectId));
  for (const row of rowsOf(model.store, "externalFiles")) {
    if (row.projectId !== scope.projectId) continue;
    try {
      files.push(projectItem(model, scope, row, semanticStatus));
    } catch (error) {
      unavailable.push({
        unavailable: true,
        externalFileId: typeof row._id === "string" ? row._id.slice(0, 500) : "externalFiles:invalid",
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
  try {
    return projectItem(
      model,
      scope,
      row,
      semanticStatusReaderFor(model, asId<"projects">(scope.projectId))
    );
  } catch (error) {
    return {
      unavailable: true,
      externalFileId,
      reason: "corrupt",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
};
