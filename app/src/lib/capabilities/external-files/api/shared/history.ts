import { createHash } from "node:crypto";

import { asId } from "$representation/data/behavior/core/id";
import {
  hasExactFields,
  isStoredActor,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import {
  externalRelativePathWithin,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { ServerModel, Scope } from "$runtime/server/start.server";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import type {
  ExternalFileHistoryEntry,
  ExternalFileHistoryEvent
} from "$capabilities/external-files/types/external-files";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";

const EVENTS = [
  "uploaded",
  "re-uploaded",
  "renamed",
  "moved",
  "deleted",
  "context-updated"
] as const satisfies readonly ExternalFileHistoryEvent[];

const currentLabel = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  value === value.trim() &&
  value === value.normalize("NFC") &&
  !/[\u0000-\u001f\u007f]/u.test(value);

/** Activity ids are identifiers; the exact path remains the immutable label. */
export const externalPathActivityId = (relativePath: string): string =>
  `external-path:${createHash("sha256").update(relativePath).digest("hex")}`;

export const recordExternalFileHistory = (
  store: StoreUnitOfWork,
  scope: Scope,
  input: {
    readonly event: ExternalFileHistoryEvent;
    readonly externalFileId: Id<"externalFiles">;
    readonly name: string;
    readonly relativePath: string;
    readonly detail?: string;
  }
): void => {
  if (!EVENTS.includes(input.event)) throw new Error("external file history event is current");
  if (!isStoredRowId(input.externalFileId, "externalFiles")) {
    throw new Error("external file history id is canonical");
  }
  if (
    !currentLabel(input.name, 240) ||
    input.name.includes("/") ||
    input.name.includes("\\")
  ) throw new Error("external file history name is canonical");
  if (!isStoredText(scope.username) || scope.username.length === 0) {
    throw new Error("external file history actor label is current text");
  }
  const relativePath = normalizeExternalRelativePath(input.relativePath);
  if (relativePath !== input.relativePath) {
    throw new Error("external file history path is canonical");
  }
  if (input.detail !== undefined && !isStoredText(input.detail)) {
    throw new Error("external file history detail is current text");
  }
  store.create("activity", {
    projectId: asId<"projects">(scope.projectId),
    actor: { kind: "user", userId: asId<"users">(scope.userId) },
    actorLabel: scope.username,
    verb: input.event,
    target: { kind: "external-file", id: input.externalFileId, label: input.name },
    context: {
      kind: "external-path",
      id: externalPathActivityId(relativePath),
      label: relativePath
    },
    ...(input.detail === undefined ? {} : { detail: input.detail })
  });
};

const currentPath = (value: unknown, maxPathBytes: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    return externalRelativePathWithin(value, maxPathBytes) === value ? value : undefined;
  } catch {
    return undefined;
  }
};

const historyEntry = (
  value: unknown,
  scope: Scope,
  maxPathBytes: number
): ExternalFileHistoryEntry | undefined => {
  const row = storedFields(value);
  if (
    row === undefined ||
    !hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "actor", "actorLabel", "verb", "target"],
      ["context", "detail"]
    ) ||
    row.projectId !== scope.projectId ||
    !isStoredRowId(row._id, "activity") ||
    !isStoredTime(row._creationTime) ||
    !isStoredActor(row.actor) ||
    !isStoredText(row.actorLabel) ||
    row.actorLabel.length === 0 ||
    !EVENTS.includes(row.verb as ExternalFileHistoryEvent)
  ) return undefined;

  const target = storedFields(row.target);
  const context = storedFields(row.context);
  if (
    target === undefined ||
    !hasExactFields(target, ["kind", "id", "label"]) ||
    target.kind !== "external-file" ||
    !isStoredRowId(target.id, "externalFiles") ||
    !currentLabel(target.label, 240) ||
    target.label.includes("/") ||
    target.label.includes("\\") ||
    context === undefined ||
    !hasExactFields(context, ["kind", "id", "label"]) ||
    context.kind !== "external-path"
  ) return undefined;

  const relativePath = currentPath(context.label, maxPathBytes);
  if (
    relativePath === undefined ||
    context.id !== externalPathActivityId(relativePath) ||
    (row.detail !== undefined && !isStoredText(row.detail))
  ) return undefined;

  return {
    id: row._id,
    externalFileId: target.id,
    event: row.verb as ExternalFileHistoryEvent,
    name: target.label,
    relativePath,
    actorName: row.actorLabel,
    at: row._creationTime,
    ...(row.detail === undefined ? {} : { detail: row.detail })
  };
};

export const externalFileHistoryIn = (
  model: ServerModel,
  scope: Scope
): readonly ExternalFileHistoryEntry[] => {
  const maxPathBytes = externalFilesLimits(model.configuration).maxPathBytes;
  return rowsOf(model.store, "activity")
  .flatMap((row): ExternalFileHistoryEntry[] => {
    const entry = historyEntry(row, scope, maxPathBytes);
    return entry === undefined ? [] : [entry];
  })
  .sort((left, right) => right.at - left.at)
  .slice(0, 200);
};
