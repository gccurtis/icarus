import type { TableRow } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  externalFileResourceKind,
  isExternalFileResourceKind
} from "$representation/data/behavior/core/resource";

import {
  materialRecordIsCurrent,
  materialSourceIsCurrent,
  semanticSourceIsCurrent
} from "$capabilities/semantic-overlay/api/shared/freshness";
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

const grouped = <T>(rows: readonly T[], key: (row: T) => string): ReadonlyMap<string, readonly T[]> => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return groups;
};

const resourceKey = (ref: ResourceRef): string => `${ref.kind}\u0000${ref.id}`;

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

export type SemanticStatusReader = (asked: ResourceRef) => ReadSemanticStatusResult;

/**
 * Indexes every semantic table once, then answers any number of status reads.
 * External's library constructs one reader per library response, keeping its
 * cost linear in rows rather than files multiplied by semantic rows.
 */
export const semanticStatusReaderFor = (
  model: ServerModel,
  projectId: Id<"projects">
): SemanticStatusReader => {
  const files = new Map(rowsOf(model.store, "externalFiles")
    .filter((row) => row.projectId === projectId)
    .map((row) => [row._id, row]));
  const sources = rowsOf(model.store, "semanticSources").filter(
    (row) => row.projectId === projectId
  );
  const sourcesByResource = grouped(sources, (row) => resourceKey(row.ref));
  const exactJobsByResource = grouped(
    rowsOf(model.store, "semanticSyncJobs").filter((row) => row.projectId === projectId),
    (row) => resourceKey(row.ref)
  );
  const exactObjectCount = new Map<string, number>();
  for (const row of rowsOf(model.store, "semanticObjects")) {
    if (row.projectId !== projectId || row.lane !== "text") continue;
    exactObjectCount.set(row.semanticSourceId, (exactObjectCount.get(row.semanticSourceId) ?? 0) + 1);
  }
  const placements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (row) => row.projectId === projectId
  );
  const placementsByMaterial = grouped(placements, (row) => row.semanticMaterialId);
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (row) => row.projectId === projectId
  );
  const materialsByResource = grouped(materials, (row) => resourceKey(row.source.ref));
  const materialJobsByResource = grouped(
    rowsOf(model.store, "semanticMaterialJobs").filter((row) => row.projectId === projectId),
    (row) => resourceKey(row.ref)
  );
  const overlay = newest(rowsOf(model.store, "semanticOverlays").filter(
    (row) => row.projectId === projectId
  ));

  const currentSource = (source: TableRow<"semanticSources">): boolean => {
    if (source.ref.kind !== "externalFile::text") {
      return semanticSourceIsCurrent(model.store, projectId, source);
    }
    const file = files.get(source.ref.id as Id<"externalFiles">);
    return file !== undefined &&
      file.subkind === "text" &&
      source.revision === file.revision &&
      source.contentHash === file.hash;
  };

  const currentMaterial = (material: TableRow<"semanticMaterials">): boolean => {
    if (material.source.kind !== "externalFile") {
      return materialRecordIsCurrent(model.store, projectId, material, placements);
    }
    const file = files.get(material.source.fileId);
    if (
      file === undefined ||
      material.source.ref.id !== file._id ||
      material.source.ref.kind !== `externalFile::${file.subkind}` ||
      material.source.hash !== file.hash ||
      material.source.mediaType !== file.mediaType ||
      material.source.subkind !== file.subkind ||
      material.revisionKey !== `hash:${file.hash}` ||
      material.name !== file.name
    ) return false;
    const own = placementsByMaterial.get(material._id) ?? [];
    return material.profile.kind !== "image" || material.profile.placementCount === own.length;
  };

  return (asked) => {
    const externalKind = isExternalFileResourceKind(asked.kind);
    const candidateFile = externalKind
      ? files.get(asked.id as Id<"externalFiles">)
      : undefined;
    const file = candidateFile !== undefined &&
      externalFileResourceKind(candidateFile.subkind) === asked.kind
      ? candidateFile
      : undefined;
    if (externalKind && file === undefined) return null;
    const exactTarget = file === undefined
      ? readSemanticSyncTargetFor(model.store, projectId, asked)
      : file.subkind === "text"
        ? { ref: asked, revision: file.revision }
        : undefined;
    const materialTarget = file === undefined
      ? readMaterialSyncTargetFor(model, projectId, asked)
      : file.subkind === "code" || file.subkind === "data" || file.subkind === "image"
        ? { ref: asked, revision: file.revision }
        : undefined;
    if (exactTarget === undefined && materialTarget === undefined && file === undefined) return null;

    const key = resourceKey(asked);
    const ownSources = sourcesByResource.get(key) ?? [];
    const currentExact = ownSources.find(currentSource);
    const exactJob = newest(exactJobsByResource.get(key) ?? []);
    const exact: ExactSemanticStatus = {
      ...laneFields(
        exactTarget !== undefined,
        currentExact !== undefined,
        ownSources.length > 0 && currentExact === undefined,
        exactJob
      ),
      objectCount: currentExact === undefined ? 0 : (exactObjectCount.get(currentExact._id) ?? 0)
    };

    const ownMaterials = materialsByResource.get(key) ?? [];
    const current = newest(ownMaterials.filter(currentMaterial));
    const materialJob = newest(materialJobsByResource.get(key) ?? []);
    const material: MaterialSemanticStatus = {
      ...laneFields(
        materialTarget !== undefined,
        current !== undefined,
        ownMaterials.length > 0 && current === undefined,
        materialJob
      ),
      ...(current === undefined
        ? {}
        : {
            kind: current.kind,
            profile: materialProfileDigest(current.profile),
            ...(current.descriptor === undefined ? {} : { descriptor: current.descriptor })
          })
    };

    return {
      ref: materialTarget?.ref ?? exactTarget?.ref ?? asked,
      overlayGeneration: overlay?.generation ?? 0,
      exact,
      material
    };
  };
};

/** Server-to-server status projection used by one-off reads. */
export const readSemanticStatusFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  asked: ResourceRef
): ReadSemanticStatusResult => semanticStatusReaderFor(model, projectId)(asked);
