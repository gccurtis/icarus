import type { TableRow } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import {
  MATERIAL_DESCRIPTOR_PROMPT_VERSION,
  materialDescriptorInputHash,
  materialDescriptorModel
} from "$capabilities/semantic-overlay/api/shared/material-description";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import {
  canDescribeMaterial,
  materialContextHash,
  type NormalizedMaterial
} from "$capabilities/semantic-overlay/api/shared/material-normalization";
import { materialRevisionKey } from "$capabilities/semantic-overlay/api/shared/material-publication";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

const descriptorPolicyIsCurrent = (
  model: ServerModel,
  material: TableRow<"semanticMaterials">,
  seed: MaterialSeed
): boolean => {
  if (model.configuration.get("semanticOverlay.materials.generateDescriptors") !== true) {
    return material.descriptor === undefined;
  }
  const descriptor = material.descriptor;
  if (descriptor !== undefined) {
    return (
      descriptor.inputHash === materialDescriptorInputHash(seed) &&
      descriptor.promptVersion === MATERIAL_DESCRIPTOR_PROMPT_VERSION &&
      descriptor.model === materialDescriptorModel(model)
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
      !descriptorPolicyIsCurrent(model, material, seed)
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
