import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { processSemanticSyncQueueFor } from "$capabilities/semantic-overlay/api/shared/queue-processor";
import { validateBackfillSemanticOverlay } from "$capabilities/semantic-overlay/api/backfill-semantic-overlay/validate-backfill-semantic-overlay";
import type { BackfillSemanticOverlayResult } from "$capabilities/semantic-overlay/types/semantic-sync-queue";

/** Development/migration entry point: coalesce every leader revision, then drain a batch. */
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
      }))
  ];

  for (const resource of refs) {
    enqueueSemanticSyncFor(model, projectId, resource.ref, resource.revision, asked.force);
  }
  return {
    discovered: refs.length,
    queued: rowsOf(model.store, "semanticSyncJobs").filter(
      (row) => row.projectId === projectId && row.state === "queued"
    ).length,
    queue: await processSemanticSyncQueueFor(model, projectId, asked.limit)
  };
};
