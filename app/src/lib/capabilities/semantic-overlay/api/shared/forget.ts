import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

export type ForgottenSemanticResource = {
  readonly jobs: number;
  readonly sources: number;
  readonly materials: number;
  readonly objects: number;
};

/**
 * Everything the overlay learned about one resource, unlearned.
 *
 * A resource that is going away leaves rows behind that retrieval would still
 * answer from: queued work, the exact-text projection it was chunked into, the
 * materials read out of it and the vectors over both. The project's index rows
 * are left alone — they cluster the whole project and are rebuilt, not owned by
 * any one resource, so removing them here would cost every other resource its
 * index.
 */
export const forgetSemanticResourceFor = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  ref: ResourceRef
): ForgottenSemanticResource => {
  const mine = <T extends { projectId: Id<"projects">; ref: ResourceRef }>(
    rows: readonly T[]
  ): readonly T[] =>
    rows.filter((row) => row.projectId === projectId && sameResourceRef(row.ref, ref));

  const syncJobs = mine(rowsOf(store, "semanticSyncJobs"));
  const materialJobs = mine(rowsOf(store, "semanticMaterialJobs"));
  const sources = mine(rowsOf(store, "semanticSources"));
  const placements = mine(rowsOf(store, "semanticMaterialPlacements"));
  const materials = rowsOf(store, "semanticMaterials").filter(
    (row) => row.projectId === projectId && sameResourceRef(row.source.ref, ref)
  );
  const history = rowsOf(store, "semanticMaterialHistory").filter(
    (row) => row.projectId === projectId && sameResourceRef(row.material.source.ref, ref)
  );

  const sourceIds = new Set<string>(sources.map((row) => row._id));
  const materialIds = new Set<string>(materials.map((row) => row._id));
  const objects = rowsOf(store, "semanticObjects").filter(
    (row) =>
      row.projectId === projectId &&
      (row.lane === "text" ? sourceIds.has(row.semanticSourceId) : materialIds.has(row.semanticMaterialId))
  );

  store.removeRows("semanticObjects", objects.map((row) => row._id));
  store.removeRows("semanticSources", sources.map((row) => row._id));
  store.removeRows("semanticMaterialPlacements", placements.map((row) => row._id));
  store.removeRows("semanticMaterials", materials.map((row) => row._id));
  store.removeRows("semanticMaterialHistory", history.map((row) => row._id));
  store.removeRows("semanticSyncJobs", syncJobs.map((row) => row._id));
  store.removeRows("semanticMaterialJobs", materialJobs.map((row) => row._id));

  return {
    jobs: syncJobs.length + materialJobs.length,
    sources: sources.length,
    materials: materials.length + placements.length + history.length,
    objects: objects.length
  };
};
