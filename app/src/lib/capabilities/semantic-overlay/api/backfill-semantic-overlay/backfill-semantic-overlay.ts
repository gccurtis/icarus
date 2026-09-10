import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
import { processSemanticSyncQueueFor } from "$capabilities/semantic-overlay/api/shared/queue-processor";
import { validateBackfillSemanticOverlay } from "$capabilities/semantic-overlay/api/backfill-semantic-overlay/validate-backfill-semantic-overlay";
import type { BackfillSemanticOverlayResult } from "$capabilities/semantic-overlay/types/semantic-sync-queue";
import { enqueueMaterialSyncFor } from "$capabilities/semantic-overlay/api/shared/material-queue";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";

/** Development maintenance entry: coalesce every leader revision, then drain bounded work. */
export const backfillSemanticOverlay = async (
  input: unknown
): Promise<BackfillSemanticOverlayResult> => {
  const scope = await requireScope();
  const asked = validateBackfillSemanticOverlay(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const refs = [
    ...rowsOf(model.store, "documentSnapshots")
      .filter((row) => row.projectId === projectId && row.role === "leader")
      .map((row) => ({
        ref: { kind: "document", id: row.resourceId } as const,
        revision: row.revision
      })),
    ...rowsOf(model.store, "slideDeckSnapshots")
      .filter((row) => row.projectId === projectId && row.role === "leader")
      .map((row) => ({
        ref: { kind: "slides", id: row.resourceId } as const,
        revision: row.revision
      })),
    ...rowsOf(model.store, "spreadsheetSnapshots")
      .filter((row) => row.projectId === projectId && row.role === "leader")
      .map((row) => ({
        ref: { kind: "spreadsheet", id: row.resourceId } as const,
        revision: row.revision
      })),
    ...rowsOf(model.store, "externalFiles")
      .filter((row) => row.projectId === projectId)
      .map((row) => ({
        ref: {
          kind: `externalFile::${row.subkind}`,
          id: row._id
        },
        revision: 0
      }))
  ];

  const queued = model.store.transaction((unit) => {
    const atomic = semanticUnitModel(model, unit);
    for (const resource of refs) {
      if (isStagedResource(unit, projectId, resource.ref)) continue;
      if (
        resource.ref.kind === "document" ||
        resource.ref.kind === "slides" ||
        resource.ref.kind === "externalFile::text"
      ) {
        enqueueSemanticSyncFor(atomic, projectId, resource.ref, resource.revision, asked.force);
      }
      enqueueMaterialSyncFor(atomic, projectId, resource.ref, resource.revision, asked.force);
    }
    return {
      text: rowsOf(unit, "semanticSyncJobs").filter(
        (row) => row.projectId === projectId && row.state === "queued"
      ).length,
      materials: rowsOf(unit, "semanticMaterialJobs").filter(
        (row) => row.projectId === projectId && row.state === "queued"
      ).length
    };
  });
  return {
    discovered: refs.length,
    queued: queued.text,
    materialQueued: queued.materials,
    queue: await processSemanticSyncQueueFor(model, projectId, asked.limit)
  };
};
