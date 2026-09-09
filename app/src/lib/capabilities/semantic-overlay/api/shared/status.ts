import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { semanticSourceIsCurrent, materialRecordIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import { materialProfileDigest } from "$capabilities/semantic-overlay/api/shared/material-facets";
import { readMaterialSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { readSemanticSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import type {
  ExactSemanticStatus,
  MaterialSemanticStatus,
  ReadSemanticStatusResult,
  SemanticLaneState
} from "$capabilities/semantic-overlay/types/read-semantic-status";

type Job = {
  readonly state: "queued" | "running" | "failed";
  readonly error?: string;
  readonly updatedAt: number;
  readonly _creationTime: number;
};

const newest = <T extends { updatedAt: number; _creationTime: number }>(rows: readonly T[]): T | undefined =>
  [...rows].sort((left, right) =>
    right.updatedAt - left.updatedAt || right._creationTime - left._creationTime
  )[0];

const laneState = (
  eligible: boolean,
  current: boolean,
  stale: boolean,
  job: Job | undefined
): SemanticLaneState => {
  if (!eligible) return "unsupported";
  if (job !== undefined) return job.state;
  if (current) return "current";
  return stale ? "stale" : "not-started";
};

const laneFields = (eligible: boolean, current: boolean, stale: boolean, job: Job | undefined) => ({
  eligible,
  state: laneState(eligible, current, stale, job),
  ...(job === undefined ? {} : { updatedAt: job.updatedAt }),
  ...(job?.error === undefined ? {} : { error: job.error })
});

/** Server-to-server status projection used by External without owning semantic tables. */
export const readSemanticStatusFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  asked: ResourceRef
): ReadSemanticStatusResult => {
  const exactTarget = readSemanticSyncTargetFor(model.store, projectId, asked);
  const materialTarget = readMaterialSyncTargetFor(model, projectId, asked);
  if (exactTarget === undefined && materialTarget === undefined) {
    const exists = rowsOf(model.store, "externalFiles").some(
      (row) => row.projectId === projectId && row._id === asked.id
    );
    if (!exists) return null;
  }

  const sources = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.id
  );
  const currentSource = sources.find((source) =>
    semanticSourceIsCurrent(model.store, projectId, source)
  );
  const exactJob = newest(rowsOf(model.store, "semanticSyncJobs").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.id
  ));
  const exactObjectCount = rowsOf(model.store, "semanticObjects").filter(
    (row) =>
      row.projectId === projectId &&
      (row.lane ?? "text") === "text" &&
      "semanticSourceId" in row &&
      row.semanticSourceId === currentSource?._id
  ).length;
  const exact: ExactSemanticStatus = {
    ...laneFields(
      exactTarget !== undefined,
      currentSource !== undefined,
      sources.length > 0 && currentSource === undefined,
      exactJob
    ),
    objectCount: currentSource === undefined ? 0 : exactObjectCount
  };

  const placements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (row) => row.projectId === projectId
  );
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (row) =>
      row.projectId === projectId &&
      row.source.kind === "externalFile" &&
      row.source.fileId === asked.id
  );
  const currentMaterial = newest(materials.filter((material) =>
    materialRecordIsCurrent(model.store, projectId, material, placements)
  ));
  const materialJob = newest(rowsOf(model.store, "semanticMaterialJobs").filter(
    (row) => row.projectId === projectId && row.ref.id === asked.id
  ));
  const material: MaterialSemanticStatus = {
    ...laneFields(
      materialTarget !== undefined,
      currentMaterial !== undefined,
      materials.length > 0 && currentMaterial === undefined,
      materialJob
    ),
    ...(currentMaterial === undefined
      ? {}
      : {
          kind: currentMaterial.kind,
          profile: materialProfileDigest(currentMaterial.profile),
          ...(currentMaterial.descriptor === undefined
            ? {}
            : { descriptor: currentMaterial.descriptor })
        })
  };
  const overlay = newest(rowsOf(model.store, "semanticOverlays").filter(
    (row) => row.projectId === projectId
  ));

  return {
    ref: materialTarget?.ref ?? exactTarget?.ref ?? asked,
    overlayGeneration: overlay?.generation ?? 0,
    exact,
    material
  };
};
