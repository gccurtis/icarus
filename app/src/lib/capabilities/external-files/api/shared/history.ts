import { asId } from "$representation/data/behavior/core/id";
import type { ServerModel, Scope } from "$runtime/server/start.server";
import type {
  ExternalFileHistoryEntry,
  ExternalFileHistoryEvent
} from "$capabilities/external-files/types/external-files";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";

export const recordExternalFileHistory = (
  model: ServerModel,
  scope: Scope,
  input: {
    readonly event: ExternalFileHistoryEvent;
    readonly externalFileId: string;
    readonly name: string;
    readonly relativePath: string;
    readonly detail?: string;
  }
): void => {
  model.store.create("activity", {
    projectId: asId<"projects">(scope.projectId),
    actor: { kind: "user", userId: asId<"users">(scope.userId) },
    actorLabel: scope.username,
    verb: input.event,
    target: { kind: "external-file", id: input.externalFileId, label: input.name },
    context: { kind: "external-path", id: input.relativePath, label: input.relativePath },
    ...(input.detail === undefined ? {} : { detail: input.detail.slice(0, 500) })
  });
};

export const externalFileHistoryIn = (
  model: ServerModel,
  scope: Scope
): readonly ExternalFileHistoryEntry[] => rowsOf(model.store, "activity")
  .flatMap((row): ExternalFileHistoryEntry[] => {
    if (
      row.projectId !== scope.projectId ||
      row.target?.kind !== "external-file" ||
      typeof row.target.id !== "string" ||
      typeof row.target.label !== "string" ||
      row.context?.kind !== "external-path" ||
      typeof row.context.id !== "string" ||
      !["uploaded", "re-uploaded", "renamed", "moved", "deleted", "context-updated"]
        .includes(row.verb)
    ) return [];
    return [{
      id: row._id,
      externalFileId: row.target.id,
      event: row.verb as ExternalFileHistoryEvent,
      name: row.target.label,
      relativePath: row.context.id,
      actorName: typeof row.actorLabel === "string" && row.actorLabel.trim()
        ? row.actorLabel.slice(0, 240)
        : "Someone",
      at: row._creationTime,
      ...(typeof row.detail === "string" && row.detail.trim()
        ? { detail: row.detail.slice(0, 500) }
        : {})
    }];
  })
  .sort((left, right) => right.at - left.at)
  .slice(0, 200);
