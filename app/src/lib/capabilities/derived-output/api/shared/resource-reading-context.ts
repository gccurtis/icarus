import type { ServerModel } from "$runtime/server/start.server";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import { sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import type { ContentBlock, TableBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  DerivedOutputSelection,
  MaterialDescriptorCitation,
  MaterialNativeCitation,
  SemanticTextCitation
} from "$representation/data/types/semantic/derived-output";
import type {
  MaterialLocator,
  MaterialSourceSnapshot
} from "$representation/data/types/semantic/material";
import {
  materialRecordIsCurrent,
  readSemanticResourceForModel
} from "$capabilities/semantic-overlay";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";
import { readContentTable } from "$capabilities/derived-output/api/shared/resource-reading-table";
import {
  findBlock,
  findElement,
  flattenBlocks,
  integer,
  record,
  samePath,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

type EvidenceDraft =
  | Omit<SemanticTextCitation, "selections">
  | Omit<MaterialDescriptorCitation, "selections">
  | Omit<MaterialNativeCitation, "selections">;

export type ResourceReadingSessionInput = {
  model: ServerModel;
  projectId: Id<"projects">;
  signal?: AbortSignal;
  scope?: ResourceSet;
  selection?: DerivedOutputSelection;
  issue(key: string, evidence: EvidenceDraft): string;
};

type MaterialHandle = {
  materialId: Id<"semanticMaterials">;
  snapshot: MaterialSourceSnapshot;
};

export const createResourceReadingContext = (input: ResourceReadingSessionInput) => {
  const namedSets = admittedReusableResourceSets(
    rowsOf(input.model.store, "resourceSets"),
    input.projectId
  );
  const allowed = (ref: ResourceRef): boolean =>
    input.scope === undefined ||
    resourceInScope(ref, input.scope, (id) => namedSets.get(id)?.set);
  const handles = new Map<string, MaterialHandle>();
  const handleBySnapshot = new Map<string, string>();
  let nextHandle = 1;

  const currentGeneration = (): number =>
    rowsOf(input.model.store, "semanticOverlays")
      .filter((row) => row.projectId === input.projectId)
      .sort((left, right) => right.generation - left.generation)[0]?.generation ?? 0;

  const rememberMaterial = (snapshot: MaterialSourceSnapshot): string => {
    const snapshotKey = JSON.stringify([
      snapshot.materialId,
      snapshot.revisionKey,
      snapshot.profileHash,
      snapshot.contextHash,
      snapshot.placement ?? null
    ]);
    const existing = handleBySnapshot.get(snapshotKey);
    if (existing !== undefined) return existing;
    const handle = `material-${nextHandle++}`;
    handleBySnapshot.set(snapshotKey, handle);
    handles.set(handle, { materialId: snapshot.materialId, snapshot });
    return handle;
  };

  const materialFor = (value: unknown) => {
    const held = record(value, "material read input must be an object");
    const handle = text(held.materialHandle, "materialHandle");
    const remembered = handles.get(handle);
    if (remembered === undefined) throw new Error("materialHandle was not issued in this attempt");
    const material = rowsOf(input.model.store, "semanticMaterials").find(
      (row) =>
        row.projectId === input.projectId &&
        row._id === remembered.materialId &&
        row.state === "ready"
    );
    const placements = rowsOf(input.model.store, "semanticMaterialPlacements").filter(
      (row) => row.projectId === input.projectId
    );
    if (
      material === undefined ||
      material.revisionKey !== remembered.snapshot.revisionKey ||
      material.profileHash !== remembered.snapshot.profileHash ||
      material.contextHash !== remembered.snapshot.contextHash ||
      !materialRecordIsCurrent(input.model.store, input.projectId, material, placements)
    ) {
      throw new Error("materialHandle is stale");
    }
    if (
      !allowed(material.source.ref) &&
      !(remembered.snapshot.placement && allowed(remembered.snapshot.placement.ref))
    ) {
      throw new Error("materialHandle is outside the Derived Output Resource Set");
    }
    return { held, material, snapshot: remembered.snapshot };
  };

  const exactProjection = async (ref: ResourceRef) => {
    input.signal?.throwIfAborted();
    if (!allowed(ref)) throw new Error("resource is outside the Derived Output Resource Set");
    const projection = await readSemanticResourceForModel(
      input.model,
      input.projectId,
      ref,
      input.signal
    );
    input.signal?.throwIfAborted();
    if (projection === undefined) throw new Error("resource does not exist");
    return projection;
  };

  const slideDeck = (ref: ResourceRef) => {
    const leader = rowsOf(input.model.store, "slideDeckSnapshots").find(
      (row) =>
        row.projectId === input.projectId && row.resourceId === ref.id && row.role === "leader"
    );
    if (leader === undefined) throw new Error("slide deck does not exist");
    return { leader, body: leader.body };
  };

  const directText = async (value: unknown) => {
    const held = record(value, "read_text input must be an object");
    const ref = admitResourceRef(
      { kind: text(held.kind, "kind"), id: text(held.resourceId, "resourceId") },
      "read_text resource"
    );
    const projection = await exactProjection(ref);
    const from = integer(held.from, "from", 0, projection.text.length);
    const to = integer(
      held.to,
      "to",
      from + 1,
      Math.min(projection.text.length, from + 20_000)
    );
    if (projection.hardBoundaries.some((boundary) => from < boundary && boundary < to)) {
      throw new Error("read_text range crosses a hard resource boundary");
    }
    const span = {
      from,
      to,
      text: sliceByCoordinates(projection.text, projection.encoding, from, to)
    };
    const locators = projection.locators.filter((entry) => entry.from < to && from < entry.to);
    const partition =
      projection.hardBoundaries.length === 0
        ? undefined
        : `partition:${projection.hardBoundaries.filter((boundary) => boundary <= from).length}`;
    const evidenceId = input.issue(
      JSON.stringify([
        "text",
        projection.ref,
        projection.revision,
        projection.contentHash ?? null,
        from,
        to
      ]),
      {
        evidenceKind: "text",
        source: {
          ref: projection.ref,
          revision: projection.revision,
          ...(projection.contentHash === undefined ? {} : { contentHash: projection.contentHash }),
          encoding: projection.encoding
        },
        span,
        ...(locators.length === 0 ? {} : { locators }),
        ...(partition === undefined ? {} : { partition }),
        overlayGeneration: currentGeneration()
      }
    );
    return {
      evidenceId,
      source: {
        ref: projection.ref,
        revision: projection.revision,
        ...(projection.contentHash === undefined ? {} : { contentHash: projection.contentHash })
      },
      span,
      locators
    };
  };

  const materialBlock = (ref: ResourceRef, locator: MaterialLocator): ContentBlock => {
    if (locator.kind === "documentBlock") {
      const document = rowsOf(input.model.store, "documentSnapshots").find(
        (row) =>
          row.projectId === input.projectId && row.resourceId === ref.id && row.role === "leader"
      );
      if (document === undefined) throw new Error("document material source is unavailable");
      const areas = {
        body: document.body.rows,
        header: document.body.header?.rows ?? [],
        firstPageHeader: document.body.header?.firstPageRows ?? [],
        footer: document.body.footer?.rows ?? [],
        firstPageFooter: document.body.footer?.firstPageRows ?? []
      };
      const row = areas[locator.area].find((candidate) => candidate.id === locator.rowId);
      if (row?.kind !== "blocks") throw new Error("document material row is unavailable");
      const block = findBlock(row.blocks, locator.blockPath.at(-1) ?? "");
      if (block === undefined) throw new Error("document material block is unavailable");
      return block;
    }
    if (locator.kind !== "slideElement") {
      throw new Error("material does not resolve to a content block");
    }
    const deck = slideDeck(ref);
    const slide = deck.body.slides.find((candidate) => candidate.id === locator.slideId);
    const element =
      slide === undefined ? undefined : findElement(slide.elements, locator.elementPath);
    if (element === undefined) throw new Error("slide material element is unavailable");
    const content = element.content;
    const root =
      content.type === "text" ||
      content.type === "formula" ||
      content.type === "prompt" ||
      content.type === "image" ||
      content.type === "table"
        ? content.block
        : content.type === "shape"
          ? content.block
          : undefined;
    if (root === undefined) throw new Error("slide element does not contain a readable block");
    if (locator.blockPath === undefined) return root;
    const nested = flattenBlocks([root]).find((candidate) =>
      samePath(candidate.blockPath, locator.blockPath!)
    );
    if (nested === undefined) throw new Error("slide material block is unavailable");
    return nested.block;
  };

  const externalFile = (id: Id<"externalFiles">) => {
    const file = rowsOf(input.model.store, "externalFiles").find(
      (row) => row.projectId === input.projectId && row._id === id
    );
    if (file === undefined) throw new Error("external file does not exist");
    return file;
  };

  const nativeCitation = (
    key: unknown,
    citation: Omit<MaterialNativeCitation, "selections">
  ): string => input.issue(JSON.stringify(key), citation);

  const tableRead = (
    held: Record<string, unknown>,
    block: TableBlock,
    snapshot: MaterialSourceSnapshot,
    materialId: Id<"semanticMaterials">
  ) =>
    readContentTable({
      held,
      block,
      snapshot,
      materialId,
      generation: currentGeneration(),
      issue: nativeCitation
    });

  return {
    input,
    allowed,
    rememberMaterial,
    materialFor,
    exactProjection,
    slideDeck,
    directText,
    materialBlock,
    nativeCitation,
    currentGeneration,
    externalFile,
    tableRead
  };
};

export type ResourceReadingContext = ReturnType<typeof createResourceReadingContext>;
