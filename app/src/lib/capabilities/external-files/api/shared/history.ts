import { activityPresentation } from "$capabilities/activity";
import type { ServerModel, Scope } from "$runtime/server/start.server";
import type { ExternalFileHistoryEntry } from "$capabilities/external-files/types/external-files";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";

export const externalFileHistoryIn = (
  model: ServerModel,
  scope: Scope
): readonly ExternalFileHistoryEntry[] => rowsOf(model.store, "activity")
  .flatMap((row): ExternalFileHistoryEntry[] => {
    if (row.projectId !== scope.projectId || !("file" in row.event)) return [];
    const presentation = activityPresentation(row.event);
    return [{
      id: row._id,
      externalFileId: row.event.file.id,
      ...presentation,
      name: row.event.file.name,
      relativePath: row.event.file.relativePath,
      actorName: row.actorLabel,
      at: row._creationTime
    }];
  })
  .sort((left, right) => right.at - left.at)
  .slice(0, 200);
