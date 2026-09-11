import type { TableRow } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import {
  MATERIAL_DESCRIPTOR_PROMPT_VERSION,
  materialDescriptorInputHash
} from "$capabilities/semantic-overlay/api/shared/material-description";
import {
  semanticMaterialDescriptorModel,
  semanticMaterialDescriptorsEnabled
} from "$capabilities/semantic-overlay/api/shared/configuration";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import {
  canDescribeMaterial,
  materialContextHash,
  normalizeMaterials,
  type NormalizedMaterial,
  withDepartedExternalImages
} from "$capabilities/semantic-overlay/api/shared/material-normalization";
import { materialRevisionKey } from "$capabilities/semantic-overlay/api/shared/material-publication";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

const descriptorPolicyIsCurrent = (
  material: TableRow<"semanticMaterials">,
  seed: MaterialSeed,
  descriptionsEnabled: boolean,
  descriptorModel: string | undefined
): boolean => {
  if (!descriptionsEnabled) {
    return material.descriptor === undefined;
  }
  const descriptor = material.descriptor;
  if (descriptor !== undefined) {
    return (
      descriptor.inputHash === materialDescriptorInputHash(seed) &&
      descriptor.promptVersion === MATERIAL_DESCRIPTOR_PROMPT_VERSION &&
      descriptor.model === descriptorModel
    );
  }
  return !canDescribeMaterial(seed) || material.error !== undefined;
};

export const materialsAreCurrent = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  desired: readonly NormalizedMaterial[]
): boolean => {
  const descriptionsEnabled = semanticMaterialDescriptorsEnabled(model.configuration);
  const descriptorModel = descriptionsEnabled
    ? semanticMaterialDescriptorModel(model.configuration)
    : undefined;
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const byIdentity = new Map(materials.map((material) => [material.identityKey, material]));
  const placements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId && sameResourceRef(placement.ref, ref)
  );
  const desiredIdentities = new Set(desired.map(({ seed }) => seed.identityKey));
  const currentIdentities = new Set([
    ...placements.flatMap((placement) => {
      const material = materials.find(
        (candidate) => candidate._id === placement.semanticMaterialId
      );
      return material === undefined ? [] : [material.identityKey];
    }),
    ...materials
      .filter((material) => sameResourceRef(material.source.ref, ref))
      .map((material) => material.identityKey)
  ]);
  if (
    currentIdentities.size !== desiredIdentities.size ||
    [...currentIdentities].some((identity) => !desiredIdentities.has(identity))
  ) {
    return false;
  }

  return desired.every(({ seed, placements: expectedPlacements, contextRefs }) => {
    const material = byIdentity.get(seed.identityKey);
    if (
      material === undefined ||
      material.revisionKey !== materialRevisionKey(seed) ||
      material.profileHash !== materialHash(seed.profile) ||
      material.contextHash !== materialContextHash(seed, contextRefs) ||
      !descriptorPolicyIsCurrent(material, seed, descriptionsEnabled, descriptorModel)
    ) {
      return false;
    }
    const actual = placements
      .filter((placement) => placement.semanticMaterialId === material._id)
      .map((placement) =>
        materialHash({
          ref: placement.ref,
          revision: placement.revision,
          locator: placement.locator,
          context: placement.context
        })
      )
      .sort();
    const expected = expectedPlacements
      .map(({ placement, context }) => materialHash({ ...placement, context }))
      .sort();
    return materialHash(actual) === materialHash(expected);
  });
};

/** Whether one native resource's complete material lane already matches its authority. */
export const materialProjectionIsCurrentFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  signal?: AbortSignal
): Promise<boolean> => {
  signal?.throwIfAborted();
  if (ref.kind !== "document" && ref.kind !== "presentation" && ref.kind !== "spreadsheet") {
    return false;
  }
  try {
    const inventory = await readMaterialInventoryFor(model, projectId, ref, signal);
    signal?.throwIfAborted();
    if (inventory === undefined) return false;
    const index = rowsOf(model.store, "semanticIndexes").find(
      (candidate) => candidate.projectId === projectId && candidate.lane === "material"
    );
    if (index === undefined) return false;
    const seeds = withDepartedExternalImages(model, projectId, ref, inventory.seeds);
    return materialsAreCurrent(
      model,
      projectId,
      ref,
      normalizeMaterials(model, projectId, ref, seeds)
    );
  } catch (error) {
    if (signal?.aborted === true) throw error;
    // A readiness probe proves only currency. The durable worker owns projection
    // failures, retries, and the terminal error visible to research preparation.
    return false;
  }
};
