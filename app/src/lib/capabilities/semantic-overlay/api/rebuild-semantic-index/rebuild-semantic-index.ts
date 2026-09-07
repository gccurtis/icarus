import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { currentOverlay } from "$capabilities/semantic-overlay/api/shared/overlay";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { stageSemanticIndex } from "$capabilities/semantic-overlay/api/shared/index-publication";
import { validateRebuildSemanticIndex } from "$capabilities/semantic-overlay/api/rebuild-semantic-index/validate-rebuild-semantic-index";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

const sameSpace = (
  left: { provider: string; model: string; dimensions: number },
  right: { provider: string; model: string; dimensions: number }
): boolean =>
  left.provider === right.provider &&
  left.model === right.model &&
  left.dimensions === right.dimensions;

/** Replaces the project's derived tree only after its successor is complete. */
export const rebuildSemanticIndex = async (
  input: unknown
): Promise<RebuildSemanticIndexResult> => {
  const scope = await requireScope();
  validateRebuildSemanticIndex(input);

  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const overlay = currentOverlay(model.store, projectId);
  if (!sameSpace(overlay.embedding, model.embedding.space)) {
    throw new Error("The active Semantic Overlay and configured embedding model use different vector spaces");
  }

  const objects = rowsOf(model.store, "semanticObjects").filter(
    (row) => row.projectId === projectId
  );
  const staged = stageSemanticIndex(
    model,
    projectId,
    overlay,
    objects.map((object) => ({ id: object._id, vector: object.vector })),
  );
  staged.commit();
  model.observability.logger.info("semanticOverlay.index.rebuilt", {
    projectId,
    indexId: staged.indexId,
    objectCount: objects.length,
    nodeCount: staged.nodeCount,
    rootCount: staged.rootCount
  });

  return {
    indexId: staged.indexId,
    objectCount: staged.objectCount,
    nodeCount: staged.nodeCount,
    rootCount: staged.rootCount
  };
};
