import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { materialsAreCurrent } from "$capabilities/semantic-overlay/api/shared/material-current";
import {
  inventorySignature,
  normalizeMaterials,
  withDepartedExternalImages
} from "$capabilities/semantic-overlay/api/shared/material-normalization";
import { prepareMaterials } from "$capabilities/semantic-overlay/api/shared/material-preparation";
import {
  publishSemanticMaterials
} from "$capabilities/semantic-overlay/api/shared/material-publication";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { SyncSemanticMaterialsResult } from "$capabilities/semantic-overlay/types/material-sync";

export const syncSemanticMaterialsFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  force = false
): Promise<SyncSemanticMaterialsResult> => {
  const inventory = await readMaterialInventoryFor(model, projectId, ref);
  if (inventory === undefined) return { outcome: "missing", ref };
  const inventorySeeds = withDepartedExternalImages(
    model,
    projectId,
    ref,
    inventory.seeds
  );
  const requestedSignature = inventorySignature(inventorySeeds);
  const normalized = normalizeMaterials(model, projectId, ref, inventorySeeds);
  const materialIndex = rowsOf(model.store, "semanticIndexes").find(
    (index) => index.projectId === projectId && index.lane === "material"
  );
  if (
    !force &&
    materialIndex !== undefined &&
    materialsAreCurrent(model, projectId, ref, normalized)
  ) {
    const overlay = rowsOf(model.store, "semanticOverlays")
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.generation - left.generation)[0];
    return {
      outcome: "current",
      ref,
      revision: inventory.revision,
      overlayGeneration: overlay?.generation ?? 0,
      materialCount: normalized.length,
      facetCount: rowsOf(model.store, "semanticObjects").filter(
        (object) => object.projectId === projectId && object.lane === "material"
      ).length,
      usage: []
    };
  }

  const { prepared, usage } = await prepareMaterials(
    model,
    projectId,
    normalized,
    force
  );
  const latest = await readMaterialInventoryFor(model, projectId, ref);
  const latestSeeds =
    latest === undefined
      ? []
      : withDepartedExternalImages(model, projectId, ref, latest.seeds);
  if (
    latest === undefined ||
    latest.revision !== inventory.revision ||
    inventorySignature(latestSeeds) !== requestedSignature
  ) {
    const overlay = rowsOf(model.store, "semanticOverlays")
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.generation - left.generation)[0];
    return {
      outcome: "superseded",
      ref,
      revision: latest?.revision ?? inventory.revision,
      overlayGeneration: overlay?.generation ?? 0,
      materialCount: 0,
      facetCount: 0,
      usage
    };
  }
  return model.store.transaction((unit) =>
    publishSemanticMaterials(
      semanticUnitModel(model, unit),
      projectId,
      ref,
      inventory.revision,
      prepared,
      usage,
      force
    )
  );
};
