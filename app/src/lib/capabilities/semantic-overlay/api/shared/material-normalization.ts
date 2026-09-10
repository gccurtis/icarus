import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import type {
  MaterialAuthoredContext,
  MaterialSeed
} from "$representation/data/types/semantic/material";
import {
  shouldDescribeMaterial
} from "$capabilities/semantic-overlay/api/shared/material-description";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import {
  type PreparedMaterial
} from "$capabilities/semantic-overlay/api/shared/material-publication";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

const unique = (values: readonly (string | undefined)[], limit: number): string[] =>
  [
    ...new Set(
      values
        .filter(
          (value): value is string => typeof value === "string" && Boolean(value.trim())
        )
        .map((value) => value.trim())
    )
  ].slice(0, limit);

const mergedContext = (
  values: readonly MaterialAuthoredContext[]
): MaterialAuthoredContext => {
  const title = unique(
    values.map((value) => value.title),
    1
  )[0];
  const caption = unique(
    values.map((value) => value.caption),
    1
  )[0];
  const alt = unique(
    values.map((value) => value.alt),
    1
  )[0];
  const userDescription = unique(
    values.map((value) => value.userDescription),
    1
  )[0];
  const alternateLabels = unique(
    values.flatMap((value) => [value.title, value.caption, value.alt]),
    24
  ).filter((value) => value !== title && value !== caption && value !== alt);
  return {
    ...(title === undefined ? {} : { title }),
    ...(caption === undefined ? {} : { caption }),
    ...(alt === undefined ? {} : { alt }),
    ...(userDescription === undefined ? {} : { userDescription }),
    nearbyText: unique(
      [...alternateLabels, ...values.flatMap((value) => value.nearbyText)],
      24
    ),
    notes: unique(values.flatMap((value) => value.notes), 12)
  };
};

export const inventorySignature = (seeds: readonly MaterialSeed[]): string =>
  materialHash(
    seeds
      .map((seed) =>
        materialHash({
          identityKey: seed.identityKey,
          source: seed.source,
          profile: seed.profile,
          context: seed.context,
          placement: seed.placement
        })
      )
      .sort()
  );

export const canDescribeMaterial = (seed: MaterialSeed): boolean =>
  shouldDescribeMaterial(seed) ||
  (seed.kind === "image" && seed.source.kind === "externalFile");

export const withDepartedExternalImages = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  seeds: readonly MaterialSeed[]
): MaterialSeed[] => {
  const desired = new Set(seeds.map((seed) => seed.identityKey));
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const byId = new Map(materials.map((material) => [material._id, material]));
  const departed = rowsOf(model.store, "semanticMaterialPlacements")
    .filter(
      (placement) => placement.projectId === projectId && sameResourceRef(placement.ref, ref)
    )
    .flatMap((placement) => {
      const material = byId.get(placement.semanticMaterialId);
      if (
        material === undefined ||
        desired.has(material.identityKey) ||
        material.source.kind !== "externalFile" ||
        material.kind !== "image" ||
        material.profile.kind !== "image"
      ) {
        return [];
      }
      const source = material.source;
      const file = rowsOf(model.store, "externalFiles").find(
        (row) => row.projectId === projectId && row._id === source.fileId
      );
      if (file === undefined || file.hash !== source.hash) return [];
      const subkind = file.subkind;
      desired.add(material.identityKey);
      const context = {
        title: file.name,
        ...(material.userDescription === undefined
          ? {}
          : { userDescription: material.userDescription }),
        nearbyText: [],
        notes: []
      };
      return [
        {
          identityKey: material.identityKey,
          kind: "image" as const,
          name: file.name,
          source: {
            ...source,
            ref: { kind: externalFileResourceKind(subkind), id: file._id },
            mediaType: file.mediaType,
            subkind
          },
          profile: { ...material.profile, mediaType: file.mediaType, placementCount: 0 },
          context,
          ...(material.userDescription === undefined
            ? {}
            : { userDescription: material.userDescription })
        }
      ];
    });
  return [...seeds, ...departed];
};

export type NormalizedMaterial = {
  seed: MaterialSeed;
  placements: PreparedMaterial["placements"];
  contextRefs: ResourceRef[];
};

const uniqueResourceRefs = (refs: readonly ResourceRef[]): ResourceRef[] =>
  [...new Map(refs.map((held) => [`${held.kind}\u0000${held.id}`, held])).values()].sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) || String(left.id).localeCompare(String(right.id))
  );

export const materialContextHash = (
  seed: MaterialSeed,
  contextRefs: readonly ResourceRef[]
): string => materialHash({ context: seed.context, scopeRefs: contextRefs });

const canonicalProfile = (seed: MaterialSeed): unknown => {
  if (seed.profile.kind !== "image") return seed.profile;
  const { alt, caption, placementCount, ...native } = seed.profile;
  void alt;
  void caption;
  void placementCount;
  return native;
};

export const normalizeMaterials = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  seeds: readonly MaterialSeed[]
): NormalizedMaterial[] => {
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const priorByIdentity = new Map(
    materials.map((material) => [material.identityKey, material])
  );
  const allPlacements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId
  );
  const groups = new Map<string, MaterialSeed[]>();
  for (const seed of seeds) {
    groups.set(seed.identityKey, [...(groups.get(seed.identityKey) ?? []), seed]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const incompatible = group.some(
      (seed) =>
        seed.kind !== first.kind ||
        materialHash(seed.source) !== materialHash(first.source) ||
        materialHash(canonicalProfile(seed)) !== materialHash(canonicalProfile(first))
    );
    if (incompatible) {
      throw new Error(
        `Material identity '${first.identityKey}' resolved to incompatible native values`
      );
    }
    const placements = group.flatMap((seed) =>
      seed.placement === undefined
        ? []
        : [{ placement: seed.placement, context: seed.context }]
    );
    const prior = priorByIdentity.get(first.identityKey);
    const retained =
      first.source.kind !== "externalFile" || prior === undefined
        ? []
        : allPlacements.filter(
            (placement) =>
              placement.semanticMaterialId === prior._id &&
              !sameResourceRef(placement.ref, ref)
          );
    const context = mergedContext([
      ...group.map((seed) => seed.context),
      ...retained.map((placement) => placement.context)
    ]);
    const contextRefs = uniqueResourceRefs([
      ...group.map((seed) => seed.placement?.ref ?? seed.source.ref),
      ...retained.map((placement) => placement.ref)
    ]);
    const placementCount = placements.length + retained.length;
    const profile =
      first.profile.kind === "image"
        ? (() => {
            const { alt, caption, ...native } = first.profile;
            void alt;
            void caption;
            return {
              ...native,
              placementCount,
              ...(context.alt === undefined ? {} : { alt: context.alt }),
              ...(context.caption === undefined ? {} : { caption: context.caption })
            };
          })()
        : first.profile;
    return { seed: { ...first, profile, context }, placements, contextRefs };
  });
};
