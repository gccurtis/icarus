// @architecture-complexity reviewed: the session deliberately presents one coherent, scope-bound tool catalog.
import { Buffer } from "node:buffer";

import type { ServerModel } from "$runtime/server/start.server";
import { intelligenceToolOutput, type IntelligenceTool } from "$model/server/intelligence/index.server";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import { sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import { blockText, tableMatrix } from "$representation/data/behavior/semantic/materials/profile";
import { parseCsv } from "$representation/data/behavior/semantic/materials/csv";
import { fileSubkindFor } from "$representation/data/behavior/external/file";
import { kindMatches } from "$representation/data/behavior/core/resource";
import { normalizeSlideDeckBody } from "$representation/data/behavior/slide-decks/normalize";
import type { ContentBlock, TableBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
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
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import {
  boundedJson,
  canvasSize,
  chartSeriesSelection,
  escaped,
  findBlock,
  findElement,
  flattenBlocks,
  integer,
  page,
  placedElements,
  record,
  samePath,
  schematicCoordinate,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

type EvidenceDraft =
  | Omit<SemanticTextCitation, "selections">
  | Omit<MaterialDescriptorCitation, "selections">
  | Omit<MaterialNativeCitation, "selections">;

type ReadingSessionInput = {
  model: ServerModel;
  projectId: Id<"projects">;
  scope?: ResourceSet;
  selection?: DerivedOutputSelection;
  issue(key: string, evidence: EvidenceDraft): string;
};

type MaterialHandle = { materialId: Id<"semanticMaterials">; snapshot: MaterialSourceSnapshot };

export const createResourceReadingSession = (input: ReadingSessionInput) => {
  const namedSets = new Map(
    rowsOf(input.model.store, "resourceSets")
      .filter((row) => row.projectId === input.projectId)
      .map((row) => [row._id, row.set])
  );
  const allowed = (ref: ResourceRef): boolean => input.scope === undefined ||
    resourceInScope(ref, input.scope, (id) => namedSets.get(id));
  const handles = new Map<string, MaterialHandle>();
  const handleBySnapshot = new Map<string, string>();
  let nextHandle = 1;

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
      (row) => row.projectId === input.projectId && row._id === remembered.materialId && row.state === "ready"
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
    ) throw new Error("materialHandle is stale");
    if (!allowed(material.source.ref) && !(remembered.snapshot.placement && allowed(remembered.snapshot.placement.ref))) {
      throw new Error("materialHandle is outside the Derived Output Resource Set");
    }
    return { held, material, snapshot: remembered.snapshot };
  };

  const exactProjection = async (ref: ResourceRef) => {
    if (!allowed(ref)) throw new Error("resource is outside the Derived Output Resource Set");
    const projection = await readSemanticResourceForModel(input.model, input.projectId, ref);
    if (projection === undefined) throw new Error("resource does not exist");
    return projection;
  };

  const slideDeck = (ref: ResourceRef) => {
    const leader = rowsOf(input.model.store, "slideDeckSnapshots").find((row) =>
      row.projectId === input.projectId && row.resourceId === ref.id && row.role === "leader"
    );
    if (leader === undefined) throw new Error("slide deck does not exist");
    return { leader, body: normalizeSlideDeckBody(leader.body) };
  };

  const directText = async (value: unknown) => {
    const held = record(value, "read_text input must be an object");
    const ref = { kind: text(held.kind, "kind"), id: text(held.resourceId, "resourceId") };
    const projection = await exactProjection(ref);
    const from = integer(held.from, "from", 0, projection.text.length);
    const to = integer(held.to, "to", from + 1, Math.min(projection.text.length, from + 20_000));
    if (projection.hardBoundaries.some((boundary) => from < boundary && boundary < to)) {
      throw new Error("read_text range crosses a hard resource boundary");
    }
    const span = { from, to, text: sliceByCoordinates(projection.text, projection.encoding, from, to) };
    const locators = projection.locators.filter((entry) => entry.from < to && from < entry.to);
    const generation = rowsOf(input.model.store, "semanticOverlays")
      .filter((row) => row.projectId === input.projectId)
      .sort((left, right) => right.generation - left.generation)[0]?.generation ?? 0;
    const partition = projection.hardBoundaries.length === 0
      ? undefined
      : `partition:${projection.hardBoundaries.filter((boundary) => boundary <= from).length}`;
    const evidenceId = input.issue(JSON.stringify([
      "text",
      projection.ref,
      projection.revision,
      projection.contentHash ?? null,
      from,
      to
    ]), {
      source: {
        ref: projection.ref,
        revision: projection.revision,
        ...(projection.contentHash === undefined ? {} : { contentHash: projection.contentHash }),
        encoding: projection.encoding
      },
      span,
      ...(locators.length === 0 ? {} : { locators }),
      ...(partition === undefined ? {} : { partition }),
      overlayGeneration: generation
    });
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
      const document = rowsOf(input.model.store, "documentSnapshots").find((row) =>
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
    if (locator.kind !== "slideElement") throw new Error("material does not resolve to a content block");
    const deck = slideDeck(ref);
    const slide = deck.body.slides.find((candidate) => candidate.id === locator.slideId);
    const element = slide === undefined ? undefined : findElement(slide.elements, locator.elementPath);
    if (element === undefined) throw new Error("slide material element is unavailable");
    const content = element.content;
    const root = content.type === "text" || content.type === "formula" || content.type === "prompt" || content.type === "image" || content.type === "table"
      ? content.block
      : content.type === "shape"
        ? content.block
        : undefined;
    if (root === undefined) throw new Error("slide element does not contain a readable block");
    if (locator.blockPath === undefined) return root;
    const nested = flattenBlocks([root]).find((candidate) => samePath(candidate.blockPath, locator.blockPath!));
    if (nested === undefined) throw new Error("slide material block is unavailable");
    return nested.block;
  };

  const nativeCitation = (
    key: unknown,
    citation: Omit<MaterialNativeCitation, "selections">
  ): string => input.issue(JSON.stringify(key), citation);

  const tools: IntelligenceTool[] = [
    {
      ...describedAgentTool("read_selection"),
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => {
        if (input.selection === undefined) throw new Error("this run has no user selection");
        return directText({
          kind: input.selection.ref.kind,
          resourceId: input.selection.ref.id,
          from: input.selection.from,
          to: input.selection.to
        });
      }
    },
    {
      ...describedAgentTool("find_resources"),
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          kinds: { type: "array", items: { type: "string" }, maxItems: 20 },
          cursor: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "find_resources input must be an object");
        const query = typeof held.query === "string" ? held.query.trim().toLowerCase() : "";
        const kinds = Array.isArray(held.kinds) ? new Set(held.kinds.filter((kind): kind is string => typeof kind === "string")) : undefined;
        const paging = page(value);
        const resources = [
          ...rowsOf(input.model.store, "documents").map((row) => ({ ref: { kind: "document", id: row._id }, name: row.title, projectId: row.projectId })),
          ...rowsOf(input.model.store, "slideDecks").map((row) => ({ ref: { kind: "slides", id: row._id }, name: row.title, projectId: row.projectId })),
          ...rowsOf(input.model.store, "spreadsheets").map((row) => ({ ref: { kind: "spreadsheet", id: row._id }, name: row.title, projectId: row.projectId })),
          ...rowsOf(input.model.store, "externalFiles").map((row) => ({ ref: { kind: `externalFile::${row.subkind ?? fileSubkindFor(row.mediaType, row.name)}`, id: row._id }, name: row.name, projectId: row.projectId }))
        ].filter((resource) =>
          resource.projectId === input.projectId &&
          allowed(resource.ref) &&
          (!query || resource.name.toLowerCase().includes(query)) &&
          (kinds === undefined || [...kinds].some((kind) => kindMatches(kind, resource.ref.kind)))
        );
        const items = resources.slice(paging.cursor, paging.cursor + paging.limit).map(({ ref, name }) => ({ ref, name }));
        return { items, nextCursor: paging.cursor + items.length < resources.length ? paging.cursor + items.length : null };
      }
    },
    {
      ...describedAgentTool("list_document_blocks"),
      inputSchema: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          area: {
            type: "string",
            enum: ["body", "header", "firstPageHeader", "footer", "firstPageFooter"]
          },
          cursor: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        required: ["resourceId"], additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "list_document_blocks input must be an object");
        const ref = { kind: "document", id: text(held.resourceId, "resourceId") };
        if (!allowed(ref)) throw new Error("document is outside the Derived Output Resource Set");
        const leader = rowsOf(input.model.store, "documentSnapshots").find((row) => row.projectId === input.projectId && row.resourceId === ref.id && row.role === "leader");
        if (leader === undefined) throw new Error("document does not exist");
        const area = held.area === undefined ? "body" : text(held.area, "area");
        if (!["body", "header", "firstPageHeader", "footer", "firstPageFooter"].includes(area)) {
          throw new Error("area is not a recognized document area");
        }
        const areas = {
          body: leader.body.rows,
          header: leader.body.header?.rows ?? [],
          firstPageHeader: leader.body.header?.firstPageRows ?? [],
          footer: leader.body.footer?.rows ?? [],
          firstPageFooter: leader.body.footer?.firstPageRows ?? []
        };
        const documentArea = area as keyof typeof areas;
        const projection = await exactProjection(ref);
        const paging = page(value);
        const blocks = areas[documentArea].flatMap((row) => row.kind === "blocks"
          ? flattenBlocks(row.blocks).map(({ block, blockPath }) => ({
              area: documentArea,
              rowId: row.id,
              blockPath,
              type: block.type,
              ranges: projection.locators.flatMap((entry) =>
                entry.locator.kind === "documentBlock" &&
                entry.locator.area === documentArea &&
                entry.locator.rowId === row.id &&
                samePath(entry.locator.blockPath, blockPath)
                  ? [{ from: entry.from, to: entry.to }]
                  : []
              )
            }))
          : []);
        const items = blocks.slice(paging.cursor, paging.cursor + paging.limit);
        return {
          area: documentArea,
          revision: leader.revision,
          items,
          nextCursor: paging.cursor + items.length < blocks.length ? paging.cursor + items.length : null
        };
      }
    },
    {
      ...describedAgentTool("list_deck_slides"),
      inputSchema: {
        type: "object", properties: { resourceId: { type: "string" }, cursor: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 100 } }, required: ["resourceId"], additionalProperties: false
      },
      execute: async (value) => {
        const held = record(value, "list_deck_slides input must be an object");
        const ref = { kind: "slides", id: text(held.resourceId, "resourceId") };
        if (!allowed(ref)) throw new Error("deck is outside the Derived Output Resource Set");
        const { body } = slideDeck(ref);
        const paging = page(value);
        const visible = body.slides.filter((slide) => slide.hidden !== true);
        const items = visible.slice(paging.cursor, paging.cursor + paging.limit).map((slide, offset) => ({ slideId: slide.id, position: paging.cursor + offset + 1 }));
        return { items, nextCursor: paging.cursor + items.length < visible.length ? paging.cursor + items.length : null };
      }
    },
    {
      ...describedAgentTool("read_text"),
      inputSchema: {
        type: "object", properties: { kind: { type: "string" }, resourceId: { type: "string" }, from: { type: "integer", minimum: 0 }, to: { type: "integer", minimum: 1 } }, required: ["kind", "resourceId", "from", "to"], additionalProperties: false
      },
      execute: async (value) => directText(value)
    },
    {
      ...describedAgentTool("inspect_dataset"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" } }, required: ["materialHandle"], additionalProperties: false },
      execute: async (value) => {
        const { material } = materialFor(value);
        if (material.kind !== "table" && material.kind !== "csv") throw new Error("material is not a dataset");
        if (material.profile.kind !== "table" && material.profile.kind !== "csv") {
          throw new Error("dataset profile is unavailable");
        }
        return {
          name: material.name,
          kind: material.kind,
          shape: {
            rows: material.profile.rows,
            columns: material.profile.columns,
            headers: material.profile.headers.slice(0, 50)
          },
          columns: material.profile.columnsProfile.slice(0, 50).map((column) => ({
            name: column.name,
            inferredType: column.inferredType,
            nullCount: column.nullCount,
            ...(column.distinctCount === undefined ? {} : { distinctCount: column.distinctCount })
          })),
          coverage: material.profile.kind === "csv"
            ? { sampledRows: material.profile.sampledRows, truncated: material.profile.truncated }
            : { sampledRows: material.profile.sample.length, truncated: material.profile.sample.length < material.profile.rows },
          warnings: material.profile.warnings,
          reader: material.kind === "csv" ? "read_csv" : "read_table",
          materialHandle: text(record(value, "input").materialHandle, "materialHandle")
        };
      }
    },
    {
      ...describedAgentTool("inspect_code"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" } }, required: ["materialHandle"], additionalProperties: false },
      execute: async (value) => {
        const { material } = materialFor(value);
        if (material.kind !== "code" || material.profile.kind !== "code") throw new Error("material is not code");
        return { name: material.name, language: material.profile.language, lines: material.profile.lines, symbols: material.profile.symbols };
      }
    },
    {
      ...describedAgentTool("inspect_slide"),
      inputSchema: { type: "object", properties: { resourceId: { type: "string" }, slideId: { type: "string" } }, required: ["resourceId", "slideId"], additionalProperties: false },
      execute: async (value) => {
        const held = record(value, "inspect_slide input must be an object");
        const ref = { kind: "slides", id: text(held.resourceId, "resourceId") };
        if (!allowed(ref)) throw new Error("slide is outside the Derived Output Resource Set");
        const slideId = text(held.slideId, "slideId");
        const { leader, body } = slideDeck(ref);
        const slide = body.slides.find((candidate) => candidate.id === slideId);
        if (slide === undefined) throw new Error("slide does not exist");
        const projection = await exactProjection(ref);
        const projectPlacements = rowsOf(input.model.store, "semanticMaterialPlacements").filter(
          (placement) => placement.projectId === input.projectId
        );
        const materials = rowsOf(input.model.store, "semanticMaterials").filter(
          (material) => material.projectId === input.projectId
        );
        const slidePlacements = projectPlacements.filter((placement) =>
          placement.ref.kind === "slides" &&
          placement.ref.id === ref.id &&
          placement.revision === leader.revision &&
          (placement.locator.kind === "slideElement" || placement.locator.kind === "slideBackground") &&
          placement.locator.slideId === slideId
        );
        const materialEntry = (placement: (typeof slidePlacements)[number]) => {
          const material = materials.find((candidate) => candidate._id === placement.semanticMaterialId);
          if (
            material === undefined ||
            material.state !== "ready" ||
            !materialRecordIsCurrent(input.model.store, input.projectId, material, projectPlacements)
          ) return undefined;
          const snapshot: MaterialSourceSnapshot = { materialId: material._id, kind: material.kind, name: material.name, source: material.source, profileHash: material.profileHash, contextHash: material.contextHash, revisionKey: material.revisionKey, placement: { ref, revision: placement.revision, locator: placement.locator } };
          const handle = rememberMaterial(snapshot);
          return {
            kind: material.kind,
            name: material.name,
            materialHandle: handle,
            locator: placement.locator
          };
        };
        const materialEntries = slidePlacements.flatMap((placement) => {
          const entry = materialEntry(placement);
          return entry === undefined ? [] : [entry];
        });
        const items = placedElements(slide.elements).map(({ element, elementPath: path, frame }) => {
          const ranges = projection.locators.flatMap((entry) =>
            entry.locator.kind === "slideElement" &&
            entry.locator.slideId === slideId &&
            JSON.stringify(entry.locator.elementPath) === JSON.stringify(path)
              ? [{ from: entry.from, to: entry.to, blockPath: entry.locator.blockPath }]
              : []
          );
          const ownMaterials = materialEntries.filter((entry) =>
            entry.locator.kind === "slideElement" && samePath(entry.locator.elementPath, path)
          );
          return {
            id: element.id,
            elementPath: path,
            type: element.content.type,
            frame,
            ...(element.rotation === undefined ? {} : { rotation: element.rotation }),
            ranges,
            materials: ownMaterials,
            // Kept as a convenience for simple elements while `materials` preserves
            // nested table/image multiplicity and each precise locator.
            materialHandle: ownMaterials[0]?.materialHandle ?? null
          };
        });
        const notes = slide.notes.map((block) => ({
          blockPath: [block.id],
          type: block.type,
          ranges: projection.locators.flatMap((entry) =>
            entry.locator.kind === "slideNote" &&
            entry.locator.slideId === slideId &&
            samePath(entry.locator.blockPath, [block.id])
              ? [{ from: entry.from, to: entry.to }]
              : []
          )
        }));
        const backgroundMaterials = materialEntries.filter(
          (entry) => entry.locator.kind === "slideBackground"
        );
        return {
          slideId,
          revision: leader.revision,
          background: slide.background?.kind ?? null,
          backgroundMaterials,
          items,
          notes,
          view: { tool: "view_slide", kind: "schematic", citable: false }
        };
      }
    },
    {
      ...describedAgentTool("view_slide"),
      inputSchema: { type: "object", properties: { resourceId: { type: "string" }, slideId: { type: "string" } }, required: ["resourceId", "slideId"], additionalProperties: false },
      execute: async (value) => {
        const held = record(value, "view_slide input must be an object");
        const ref = { kind: "slides", id: text(held.resourceId, "resourceId") };
        if (!allowed(ref)) throw new Error("slide is outside the Derived Output Resource Set");
        const slideId = text(held.slideId, "slideId");
        const { body } = slideDeck(ref);
        const slide = body.slides.find((candidate) => candidate.id === slideId);
        if (slide === undefined) throw new Error("slide does not exist");
        const { width, height } = canvasSize(body.aspectRatio);
        const render = (placed: ReturnType<typeof placedElements>): string => placed.map(({ element, frame }) => {
          const label = element.content.type === "text" || element.content.type === "formula"
            ? element.content.block.display
            : element.content.type === "prompt"
              ? "[Generated Prompt Block omitted]"
              : element.content.type === "shape"
                ? element.content.block?.display ?? element.content.shape
                : element.content.type;
          const pixels = {
            x: schematicCoordinate(frame.x * width),
            y: schematicCoordinate(frame.y * height),
            width: schematicCoordinate(frame.width * width),
            height: schematicCoordinate(frame.height * height)
          };
          const transform = element.rotation === undefined
            ? ""
            : ` transform="rotate(${element.rotation} ${pixels.x + pixels.width / 2} ${pixels.y + pixels.height / 2})"`;
          return `<g${transform}><rect x="${pixels.x}" y="${pixels.y}" width="${pixels.width}" height="${pixels.height}" fill="white" fill-opacity="0.04" stroke="white" stroke-opacity="0.35"/><text x="${pixels.x + 8}" y="${pixels.y + 24}" fill="white" font-size="18">${escaped(label.slice(0, 180))}</text></g>`;
        }).join("");
        const elements = render(placedElements(slide.elements));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#172036"/>${elements}</svg>`;
        return intelligenceToolOutput(
          { slideId, viewKind: "schematic", supportingContext: true },
          [{ kind: "bytes", base64: Buffer.from(svg).toString("base64"), mediaType: "image/svg+xml" }]
        );
      }
    },
    {
      ...describedAgentTool("read_table"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" }, rowFrom: { type: "integer", minimum: 0 }, rowTo: { type: "integer", minimum: 1 }, columnFrom: { type: "integer", minimum: 0 }, columnTo: { type: "integer", minimum: 1 } }, required: ["materialHandle"], additionalProperties: false },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "table" || material.profile.kind !== "table") throw new Error("material is not a table");
        if (material.profile.rows === 0 || material.profile.columns === 0) {
          throw new Error("table contains no readable cells");
        }
        if (material.source.kind === "resourceContent" && material.source.locator.kind === "spreadsheet") {
          const rowFrom = held.rowFrom === undefined ? 0 : integer(held.rowFrom, "rowFrom", 0, material.profile.rows - 1);
          const rowTo = held.rowTo === undefined ? Math.min(material.profile.rows, rowFrom + 100) : integer(held.rowTo, "rowTo", rowFrom + 1, Math.min(material.profile.rows, rowFrom + 100));
          const columnFrom = held.columnFrom === undefined ? 0 : integer(held.columnFrom, "columnFrom", 0, material.profile.columns - 1);
          const columnTo = held.columnTo === undefined ? Math.min(material.profile.columns, columnFrom + 50) : integer(held.columnTo, "columnTo", columnFrom + 1, Math.min(material.profile.columns, columnFrom + 50));
          const rowIds = material.source.locator.rowIds.slice(rowFrom, rowTo);
          const columnIds = material.source.locator.columnIds.slice(columnFrom, columnTo);
          const cells = rowsOf(input.model.store, "sheetCells").filter((cell) => cell.projectId === input.projectId && cell.resourceId === material.source.ref.id && rowIds.includes(cell.rowId) && columnIds.includes(cell.columnId));
          const valueOut = { rowIds, columnIds, cells: cells.map((cell) => ({ rowId: cell.rowId, columnId: cell.columnId, value: cell.value })) };
          const selection = { kind: "table" as const, rows: Array.from({ length: rowTo - rowFrom }, (_, index) => rowFrom + index), columns: Array.from({ length: columnTo - columnFrom }, (_, index) => columnFrom + index) };
          const evidenceId = nativeCitation(["table", material._id, selection], { evidenceKind: "structured", distance: 1, material: snapshot, selection, value: valueOut, overlayGeneration: currentGeneration() });
          return { evidenceId, ...valueOut };
        }
        if (material.source.kind !== "resourceContent") throw new Error("external tables use read_csv");
        const locator = material.source.locator;
        const block = materialBlock(snapshot.placement?.ref ?? snapshot.source.ref, locator);
        if (block.type !== "table") throw new Error("material source is no longer a table");
        return tableRead(held, block, snapshot, material._id);
      }
    },
    {
      ...describedAgentTool("read_chart"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" }, series: { type: "array", items: { type: "string" }, maxItems: 50 } }, required: ["materialHandle"], additionalProperties: false },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "chart" || material.source.kind !== "resourceContent" || material.source.locator.kind !== "slideElement") throw new Error("material is not a native slide chart");
        const ref = snapshot.placement?.ref ?? material.source.ref;
        const locator = material.source.locator;
        const deck = slideDeck(ref);
        const slide = deck.body.slides.find((candidate) => candidate.id === locator.slideId);
        const element = slide === undefined ? undefined : findElement(slide.elements, locator.elementPath);
        if (element?.content.type !== "chart") throw new Error("chart source is unavailable");
        const available = material.profile.kind === "chart" ? material.profile.series : [];
        const selected = Array.isArray(held.series)
          ? [...new Set(held.series.map((entry) => text(entry, "series")))]
          : available;
        if (Array.isArray(held.series) && selected.length === 0) {
          throw new Error("read_chart series must not be empty");
        }
        const missing = selected.find((series) => !available.includes(series));
        if (missing !== undefined) throw new Error(`chart series '${missing}' does not exist`);
        const native = boundedJson(chartSeriesSelection(element.content.spec, selected, available));
        const selection = { kind: "chart" as const, series: selected };
        const evidenceId = nativeCitation(["chart", material._id, selection], { evidenceKind: "structured", distance: 1, material: snapshot, selection, value: native, overlayGeneration: currentGeneration() });
        return { evidenceId, series: selected, spec: native };
      }
    },
    {
      ...describedAgentTool("read_csv"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" }, rows: { type: "array", items: { type: "integer", minimum: 0 }, maxItems: 100 }, columns: { type: "array", items: { type: "string" }, maxItems: 50 } }, required: ["materialHandle", "rows", "columns"], additionalProperties: false },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "csv" || material.profile.kind !== "csv" || material.source.kind !== "externalFile") throw new Error("material is not CSV");
        const profile = material.profile;
        if (profile.rows === 0) throw new Error("CSV contains no data rows");
        const rows = Array.isArray(held.rows)
          ? [...new Set(held.rows.map((row) => integer(row, "row", 0, profile.rows - 1)))]
          : [];
        const columns = Array.isArray(held.columns)
          ? [...new Set(held.columns.map((column) => text(column, "column")))]
          : [];
        if (rows.length === 0 || columns.length === 0) throw new Error("read_csv requires bounded rows and columns");
        const file = externalFile(material.source.fileId);
        const bytes = await input.model.materialContent.read({ storageId: file.storageId, hash: file.hash });
        if (bytes === undefined) throw new Error("CSV native content is unavailable");
        const parsed = parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        const headers = parsed.rows[0] ?? [];
        const indexes = columns.map((column) => {
          const index = headers.indexOf(column);
          if (index < 0) throw new Error(`CSV column '${column}' does not exist`);
          return index;
        });
        const values = rows.map((row) => ({ row, values: indexes.map((column) => parsed.rows[row + 1]?.[column] ?? "") }));
        const selection = { kind: "csv" as const, rows, columns };
        const valueOut = { headers: columns, rows: values };
        const evidenceId = nativeCitation(["csv", material._id, selection], { evidenceKind: "structured", distance: 1, material: snapshot, selection, value: valueOut, overlayGeneration: currentGeneration() });
        return { evidenceId, ...valueOut };
      }
    },
    {
      ...describedAgentTool("read_code"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" }, fromLine: { type: "integer", minimum: 1 }, toLine: { type: "integer", minimum: 1 } }, required: ["materialHandle", "fromLine", "toLine"], additionalProperties: false },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "code" || material.profile.kind !== "code" || material.source.kind !== "externalFile") throw new Error("material is not code");
        if (material.profile.lines === 0) throw new Error("code file contains no lines");
        const fromLine = integer(held.fromLine, "fromLine", 1, material.profile.lines);
        const toLine = integer(held.toLine, "toLine", fromLine, Math.min(material.profile.lines, fromLine + 499));
        const file = externalFile(material.source.fileId);
        const bytes = await input.model.materialContent.read({ storageId: file.storageId, hash: file.hash });
        if (bytes === undefined) throw new Error("code native content is unavailable");
        const valueOut = new TextDecoder("utf-8", { fatal: true }).decode(bytes).split(/\r?\n/).slice(fromLine - 1, toLine).join("\n");
        const selection = { kind: "code" as const, fromLine, toLine };
        const evidenceId = nativeCitation(["code", material._id, selection], { evidenceKind: "code", distance: 0, material: snapshot, selection, value: valueOut, overlayGeneration: currentGeneration() });
        return { evidenceId, language: material.profile.language, fromLine, toLine, text: valueOut };
      }
    },
    {
      ...describedAgentTool("read_image"),
      inputSchema: { type: "object", properties: { materialHandle: { type: "string" }, crop: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, required: ["x", "y", "width", "height"], additionalProperties: false } }, required: ["materialHandle"], additionalProperties: false },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "image" || material.profile.kind !== "image") throw new Error("material is not an image");
        const crop = held.crop === undefined ? undefined : (() => {
          const value = record(held.crop, "crop must be an object");
          const numbers = [value.x, value.y, value.width, value.height];
          if (numbers.some((entry) => typeof entry !== "number" || !Number.isFinite(entry as number))) throw new Error("crop values must be finite numbers");
          const crop = { x: value.x as number, y: value.y as number, width: value.width as number, height: value.height as number };
          if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) {
            throw new Error("crop must have a non-negative origin and positive dimensions");
          }
          if (
            (material.profile.width !== undefined && crop.x + crop.width > material.profile.width) ||
            (material.profile.height !== undefined && crop.y + crop.height > material.profile.height)
          ) throw new Error("crop exceeds the original image bounds");
          return crop;
        })();
        let image;
        const source = material.profile.source;
        if (source.kind === "url") {
          throw new Error("URL-backed images must be imported into content-addressed storage before they can be cited");
        }
        else if (source.kind === "file") {
          const file = externalFile(source.fileId);
          const bytes = await input.model.materialContent.read({ storageId: file.storageId, hash: file.hash });
          if (bytes === undefined) throw new Error("image native content is unavailable");
          image = { kind: "bytes" as const, base64: Buffer.from(bytes).toString("base64"), mediaType: file.mediaType };
        } else throw new Error("storage image content requires the upload object-store adapter");
        const selection = { kind: "image" as const, ...(crop === undefined ? {} : { crop }) };
        const visualValue = { assetHash: material.profile.assetHash, mediaType: material.profile.mediaType, crop: crop ?? null };
        const evidenceId = nativeCitation(["image", material._id, selection], { evidenceKind: "visual", distance: 1, material: snapshot, selection, value: visualValue, overlayGeneration: currentGeneration() });
        return intelligenceToolOutput({ evidenceId, ...visualValue }, [image]);
      }
    }
  ];

  function currentGeneration(): number {
    return rowsOf(input.model.store, "semanticOverlays")
      .filter((row) => row.projectId === input.projectId)
      .sort((left, right) => right.generation - left.generation)[0]?.generation ?? 0;
  }

  function externalFile(id: Id<"externalFiles">) {
    const file = rowsOf(input.model.store, "externalFiles").find((row) => row.projectId === input.projectId && row._id === id);
    if (file === undefined) throw new Error("external file does not exist");
    return file;
  }

  function tableRead(held: Record<string, unknown>, block: TableBlock, snapshot: MaterialSourceSnapshot, materialId: Id<"semanticMaterials">) {
    const matrix = tableMatrix(block);
    if (matrix.length === 0) throw new Error("table contains no rows");
    const rowFrom = held.rowFrom === undefined ? 0 : integer(held.rowFrom, "rowFrom", 0, matrix.length - 1);
    const rowTo = held.rowTo === undefined ? Math.min(matrix.length, rowFrom + 100) : integer(held.rowTo, "rowTo", rowFrom + 1, Math.min(matrix.length, rowFrom + 100));
    const width = matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    if (width === 0) throw new Error("table contains no columns");
    const columnFrom = held.columnFrom === undefined ? 0 : integer(held.columnFrom, "columnFrom", 0, width - 1);
    const columnTo = held.columnTo === undefined ? Math.min(width, columnFrom + 50) : integer(held.columnTo, "columnTo", columnFrom + 1, Math.min(width, columnFrom + 50));
    const rows = matrix.slice(rowFrom, rowTo).map((row) => row.slice(columnFrom, columnTo));
    const selection = { kind: "table" as const, rows: Array.from({ length: rowTo - rowFrom }, (_, index) => rowFrom + index), columns: Array.from({ length: columnTo - columnFrom }, (_, index) => columnFrom + index) };
    const valueOut = { rowFrom, rowTo, columnFrom, columnTo, rows };
    const evidenceId = nativeCitation(["table", materialId, selection], { evidenceKind: "structured", distance: 1, material: snapshot, selection, value: valueOut, overlayGeneration: currentGeneration() });
    return { evidenceId, ...valueOut };
  }

  return { tools, rememberMaterial };
};
