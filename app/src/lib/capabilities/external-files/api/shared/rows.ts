import type { StoreModel, TableRow } from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { canonicalFileSubkind, normalizeExternalRelativePath } from "$representation/data/behavior/external/file";
import type { Actor } from "$representation/data/types/core/actor";
import type { ExternalFileOrigin } from "$representation/data/types/external/file";
import { readSemanticStatusFor } from "$capabilities/semantic-overlay";
import type {
  ExternalFileLibraryItem,
  ExternalFileOriginView,
  ExternalFileUnavailable
} from "$capabilities/external-files/types/external-files";

export const rowsOf = <T extends Parameters<StoreModel["create"]>[0]>(
  store: StoreModel,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

const canonicalId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("externalFiles:") ||
    value.length <= "externalFiles:".length ||
    value.length > 500 ||
    /[.:\s]/.test(value.slice("externalFiles:".length))
  ) {
    throw new Error("external file id is one canonical row segment");
  }
  return value;
};

const boundedName = (value: unknown, label: string): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 240 ||
    value !== value.trim() ||
    value.includes("\u0000")
  ) {
    throw new Error(`${label} is bounded canonical text`);
  }
  return value;
};

const finiteTime = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is finite and non-negative`);
  }
  return value;
};

const revisionOf = (value: unknown): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("external file revision is a non-negative safe integer");
  }
  return value as number;
};

const sizeOf = (value: unknown): number | null => {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("external file size is a non-negative safe integer");
  }
  return value as number;
};

const semanticContextOf = (value: unknown): string | undefined => {
  if (value === undefined || value === "") return undefined;
  if (
    typeof value !== "string" ||
    value.length > 4_000 ||
    value !== value.trim() ||
    value.includes("\u0000")
  ) {
    throw new Error("external file semantic context is bounded canonical text");
  }
  return value;
};

const actorOf = (value: unknown): Actor => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("external file actor is represented");
  }
  const actor = value as Record<string, unknown>;
  const exact = (fields: readonly string[]) =>
    Object.keys(actor).every((field) => fields.includes(field));
  if (actor.kind === "system" && exact(["kind"])) return { kind: "system" };
  if (
    actor.kind === "user" &&
    exact(["kind", "userId"]) &&
    typeof actor.userId === "string" &&
    actor.userId.length > 0
  ) {
    return { kind: "user", userId: actor.userId } as Actor;
  }
  if (
    actor.kind === "connector" &&
    exact(["kind", "connectorId"]) &&
    typeof actor.connectorId === "string" &&
    actor.connectorId.length > 0
  ) {
    return { kind: "connector", connectorId: actor.connectorId } as Actor;
  }
  if (
    actor.kind === "agent" &&
    exact(["kind", "taskId"]) &&
    typeof actor.taskId === "string" &&
    actor.taskId.length > 0
  ) {
    return { kind: "agent", taskId: actor.taskId } as Actor;
  }
  throw new Error("external file actor is represented");
};

const actorName = (store: StoreModel, scope: Scope, actor: Actor): string => {
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

const originOf = (value: ExternalFileOrigin): ExternalFileOriginView => {
  if (value?.kind === "upload" && Object.keys(value).length === 1) {
    return { kind: "upload", label: "Uploaded" };
  }
  if (
    value?.kind === "connector" &&
    Object.keys(value).every((field) => ["kind", "connectorId", "sourceId"].includes(field)) &&
    typeof value.connectorId === "string" &&
    value.connectorId.length > 0 &&
    typeof value.sourceId === "string" &&
    value.sourceId.length > 0 &&
    value.sourceId.length <= 500
  ) {
    return {
      kind: "connector",
      label: "Connector",
      connectorId: value.connectorId,
      sourceId: value.sourceId
    };
  }
  throw new Error("external file origin is represented");
};

export type AdmittedExternalFile = {
  readonly row: TableRow<"externalFiles">;
  readonly item: ExternalFileLibraryItem;
};

export const admitExternalFile = (
  model: ServerModel,
  scope: Scope,
  row: TableRow<"externalFiles">
): AdmittedExternalFile => {
  const id = canonicalId(row._id);
  if (row.projectId !== scope.projectId) throw new Error("external file belongs to the project");
  const name = boundedName(row.name, "external file name");
  const originalName = boundedName(row.originalName ?? row.name, "original file name");
  const relativePath = normalizeExternalRelativePath(row.relativePath ?? originalName);
  if (
    typeof row.mediaType !== "string" ||
    row.mediaType.length === 0 ||
    row.mediaType.length > 200 ||
    row.mediaType !== row.mediaType.trim() ||
    !/^[\x20-\x7e]+$/.test(row.mediaType)
  ) {
    throw new Error("external file media type is bounded text");
  }
  const subkind = canonicalFileSubkind(row.subkind, row.mediaType, name);
  if (!["code", "data", "image", "audio", "video", "unknown"].includes(subkind)) {
    throw new Error("external file subkind is represented");
  }
  if (typeof row.hash !== "string" || !/^[a-f0-9]{64}$/i.test(row.hash)) {
    throw new Error("external file hash is SHA-256");
  }
  if (typeof row.storageId !== "string" || row.storageId.length === 0) {
    throw new Error("external file storage id is represented");
  }
  const createdBy = actorOf(row.createdBy);
  const updatedBy = actorOf(row.updatedBy ?? row.createdBy);
  const semantic = readSemanticStatusFor(model, asId<"projects">(scope.projectId), {
    kind: `externalFile::${subkind}`,
    id
  });
  if (semantic === null) throw new Error("external file semantic status is readable");
  return {
    row,
    item: {
      id,
      name,
      originalName,
      relativePath,
      mediaType: row.mediaType,
      subkind,
      size: sizeOf(row.size),
      revision: revisionOf(row.revision),
      createdAt: finiteTime(row._creationTime, "external file creation time"),
      updatedAt: finiteTime(row.updatedAt, "external file update time"),
      createdByName: actorName(model.store, scope, createdBy),
      updatedByName: actorName(model.store, scope, updatedBy),
      origin: originOf(row.origin),
      ...(semanticContextOf(row.semanticContext) === undefined
        ? {}
        : { semanticContext: semanticContextOf(row.semanticContext) }),
      semantic
    }
  };
};

export const externalFilesIn = (model: ServerModel, scope: Scope) => {
  const files: AdmittedExternalFile[] = [];
  const unavailable: ExternalFileUnavailable[] = [];
  for (const row of rowsOf(model.store, "externalFiles")) {
    if (row.projectId !== scope.projectId) continue;
    try {
      files.push(admitExternalFile(model, scope, row));
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
    return admitExternalFile(model, scope, row);
  } catch (error) {
    return {
      unavailable: true,
      externalFileId,
      reason: "corrupt",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
};
