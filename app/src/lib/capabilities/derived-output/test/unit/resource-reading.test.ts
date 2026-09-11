import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { beforeEach, describe, it } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { MaterialHit, MaterialSourceSnapshot } from "$representation/data/types/semantic/material";
import { createResourceReadingSession } from "$capabilities/derived-output/api/shared/resource-reading";
import { activeSources } from "$capabilities/derived-output/api/shared/rows";
import { materialDescriptorEvidence } from "$capabilities/derived-output/api/shared/synthesis";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const projectId = "projects:reading" as Id<"projects">;
const hash = (character: string) => character.repeat(64);
const emptyColumns = () => [];

const textBlock = (id: string, display: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}:atom`, kind: "literal" as const, text: display }],
  display,
  marks: []
});

const materialHit = (snapshot: MaterialSourceSnapshot): MaterialHit => ({
  semanticObjectIds: [],
  evidenceKind: "interpreted",
  material: snapshot,
  profile: { facts: [], warnings: [] },
  profileFacet: { inputHash: "profile-facet", text: "material profile" },
  matchedFacets: [],
  matched: [],
  score: 1,
  overlayGeneration: 5
});

describe("Derived Output resource-reading session", () => {
  const tables = new Map<string, Row[]>();
  const issued = new Map<string, unknown>();
  let nextEvidence = 1;
  let model: ServerModel;

  const put = (table: string, rows: Row[]) => {
    tables.set(table, rows);
  };

  const material = (id: string) => {
    const row = (tables.get("semanticMaterials") ?? []).find((candidate) => candidate._id === id);
    if (row === undefined) throw new Error(`missing fixture material '${id}'`);
    return row as unknown as {
      _id: Id<"semanticMaterials">;
      kind: MaterialSourceSnapshot["kind"];
      name: string;
      source: MaterialSourceSnapshot["source"];
      profileHash: string;
      contextHash: string;
      revisionKey: string;
    };
  };

  const snapshot = (id: string, placement?: MaterialSourceSnapshot["placement"]): MaterialSourceSnapshot => {
    const found = material(id);
    return {
      materialId: found._id,
      kind: found.kind,
      name: found.name,
      source: found.source,
      profileHash: found.profileHash,
      contextHash: found.contextHash,
      revisionKey: found.revisionKey,
      ...(placement === undefined ? {} : { placement })
    };
  };

  const session = (scope?: ResourceSet, signal?: AbortSignal) =>
    createResourceReadingSession({
      model,
      projectId,
      ...(signal === undefined ? {} : { signal }),
      selection: {
        ref: { kind: "document", id: asId<"documents">("documents:doc") },
        from: 0,
        to: 13
      },
      ...(scope === undefined ? {} : { scope }),
      issue: (_key, evidence) => {
        const id = `evidence-${nextEvidence++}`;
        issued.set(id, evidence);
        return id;
      }
    });

  beforeEach(() => {
    tables.clear();
    issued.clear();
    nextEvidence = 1;
    put("semanticOverlays", [{
      _id: "semanticOverlays:one", _creationTime: 1, projectId, generation: 5,
      embedding: { provider: "jina", model: "test", dimensions: 2 }, updatedAt: 1
    }]);
    put("documents", [{
      _id: "documents:doc", _creationTime: 1, projectId, title: "Doc",
      createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
    }]);
    put("documentSnapshots", [{
      _id: "documentSnapshots:doc", _creationTime: 1, projectId,
      resourceId: "documents:doc", revision: 2, role: "leader", part: 0,
      body: { rows: [{ id: "row", kind: "blocks", blocks: [textBlock("fact", "Selected fact")] }] },
      at: 1
    }]);
    put("presentations", [{
      _id: "presentations:presentation", _creationTime: 1, projectId, title: "Presentation",
      createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
    }]);
    put("presentationSnapshots", [{
      _id: "presentationSnapshots:presentation", _creationTime: 1, projectId,
      resourceId: "presentations:presentation", revision: 3, role: "leader", part: 0,
      body: {
        aspectRatio: "16:9",
        theme: { colors: { text: "#111", accent: "#08f" } },
        styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
        layouts: [], sections: [],
        slides: [{
          id: "slide-one",
          elements: [
            {
              id: "headline", frame: { x: 0.05, y: 0.05, width: 0.4, height: 0.1 },
              content: { type: "text", block: textBlock("headline-block", "Launch mix") }
            },
            {
              id: "chart", frame: { x: 0.05, y: 0.2, width: 0.5, height: 0.5 },
              content: {
                type: "chart",
                spec: {
                  type: "bar",
                  series: [
                    { name: "Revenue", values: [10, 20] },
                    { name: "Cost", values: [4, 8] }
                  ]
                }
              }
            },
            {
              id: "prompt", frame: { x: 0.05, y: 0.8, width: 0.5, height: 0.1 },
              content: {
                type: "prompt",
                block: {
                  id: "prompt-block",
                  type: "prompt",
                  atoms: [{ id: "prompt-atom", kind: "literal", text: "SECRET GENERATED VALUE" }],
                  display: "SECRET GENERATED VALUE",
                  marks: [],
                  derivedOutputId: "derivedOutputs:slide-prompt",
                  refreshedAt: 1,
                  state: "fresh"
                }
              }
            },
            {
              id: "group", frame: { x: 0.55, y: 0.05, width: 0.4, height: 0.1 },
              content: {
                type: "group",
                children: [{
                  id: "group-child", frame: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                  content: { type: "shape", shape: "rectangle", block: textBlock("group-child-block", "Nested") }
                }]
              }
            }
          ],
          notes: []
        }]
      },
      at: 1
    }]);
    put("externalFiles", [
      {
        _id: "externalFiles:csv", _creationTime: 1, projectId, name: "sales.csv",
        originalName: "sales.csv", relativePath: "sales.csv", mediaType: "text/csv",
        subkind: "data", storageId: `_storage:${hash("a")}`, hash: hash("a"), size: 35,
        origin: { kind: "upload" }, createdBy: { kind: "system" },
        updatedBy: { kind: "system" }, revision: 1, updatedAt: 1
      },
      {
        _id: "externalFiles:code", _creationTime: 2, projectId, name: "answer.ts",
        originalName: "answer.ts", relativePath: "answer.ts", mediaType: "text/typescript",
        subkind: "code", storageId: `_storage:${hash("b")}`, hash: hash("b"), size: 46,
        origin: { kind: "upload" }, createdBy: { kind: "system" },
        updatedBy: { kind: "system" }, revision: 1, updatedAt: 2
      },
      {
        _id: "externalFiles:image", _creationTime: 3, projectId, name: "diagram.png",
        originalName: "diagram.png", relativePath: "diagram.png", mediaType: "image/png",
        subkind: "image", storageId: `_storage:${hash("c")}`, hash: hash("c"), size: 4,
        origin: { kind: "upload" }, createdBy: { kind: "system" },
        updatedBy: { kind: "system" }, revision: 1, updatedAt: 3
      }
    ]);
    put("semanticMaterials", [
      {
        _id: "semanticMaterials:csv", _creationTime: 1, projectId, identityKey: "csv",
        kind: "csv", name: "sales.csv",
        source: { kind: "externalFile", ref: { kind: "externalFile::data", id: "externalFiles:csv" }, fileId: "externalFiles:csv", hash: hash("a"), mediaType: "text/csv", subkind: "data" },
        profile: { kind: "csv", delimiter: ",", encoding: "utf-8", rows: 2, columns: 2, headers: ["Region", "Revenue"], columnsProfile: emptyColumns(), sample: [], sampledRows: 2, malformedRows: 0, truncated: false, warnings: [] },
        profileHash: "csv-profile", contextHash: "csv-context", revisionKey: `hash:${hash("a")}`, state: "ready", updatedAt: 1
      },
      {
        _id: "semanticMaterials:code", _creationTime: 2, projectId, identityKey: "code",
        kind: "code", name: "answer.ts",
        source: { kind: "externalFile", ref: { kind: "externalFile::code", id: "externalFiles:code" }, fileId: "externalFiles:code", hash: hash("b"), mediaType: "text/typescript", subkind: "code" },
        profile: { kind: "code", language: "typescript", lines: 2, imports: [], exports: ["answer"], symbols: [{ name: "answer", kind: "variable", fromLine: 1, toLine: 1 }], parser: "bounded-regex", truncated: false, warnings: [] },
        profileHash: "code-profile", contextHash: "code-context", revisionKey: `hash:${hash("b")}`, state: "ready", updatedAt: 1
      },
      {
        _id: "semanticMaterials:image", _creationTime: 3, projectId, identityKey: "image",
        kind: "image", name: "diagram.png",
        source: { kind: "externalFile", ref: { kind: "externalFile::image", id: "externalFiles:image" }, fileId: "externalFiles:image", hash: hash("c"), mediaType: "image/png", subkind: "image" },
        profile: { kind: "image", width: 640, height: 480, assetHash: hash("c"), mediaType: "image/png", source: { kind: "file", fileId: "externalFiles:image" }, placementCount: 0, warnings: [] },
        profileHash: "image-profile", contextHash: "image-context", revisionKey: `hash:${hash("c")}`, state: "ready", updatedAt: 1
      },
      {
        _id: "semanticMaterials:chart", _creationTime: 4, projectId, identityKey: "chart",
        kind: "chart", name: "Launch chart",
        source: { kind: "resourceContent", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3, locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["chart"] } },
        profile: { kind: "chart", chartType: "bar", axes: [], series: ["Revenue", "Cost"], measures: ["Revenue", "Cost"], points: 0, sourceHandles: [], warnings: [] },
        profileHash: "chart-profile", contextHash: "chart-context", revisionKey: "revision:presentation:presentations:presentation:3", state: "ready", updatedAt: 1
      }
    ]);
    put("semanticMaterialPlacements", [{
      _id: "semanticMaterialPlacements:chart", _creationTime: 1, projectId,
      semanticMaterialId: "semanticMaterials:chart", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3,
      locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["chart"] },
      context: { nearbyText: ["Launch mix"], notes: [] }, contextHash: "chart-context", updatedAt: 1
    }]);
    put("spreadsheets", []);
    put("resourceSets", []);
    const content = new Map([
      [`_storage:${hash("a")}`, new TextEncoder().encode("Region,Revenue\nNorth,120\nSouth,200\n")],
      [`_storage:${hash("b")}`, new TextEncoder().encode("export const answer = 42;\nconsole.log(answer);")],
      [`_storage:${hash("c")}`, new Uint8Array([137, 80, 78, 71])]
    ]);
    model = {
      store: {
        read(path: string) {
          const [table] = path.split(".");
          return { kind: "table", table, rows: tables.get(table) ?? [] } as never;
        }
      },
      externalFileStorage: {
        read: async (ref: { storageId: Id<"_storage"> }) => content.get(ref.storageId)
      }
    } as unknown as ServerModel;
  });

  it("exposes narrow tools and keeps orientation calls outside the evidence registry", async () => {
    const held = session();
    assert.deepEqual(held.tools.map((tool) => tool.name), [
      "read_selection", "find_resources", "list_document_blocks", "list_presentation_slides", "read_text",
      "inspect_dataset", "inspect_code", "inspect_slide", "view_slide", "read_table", "read_chart",
      "read_csv", "read_code", "read_image"
    ]);
    const tool = (name: string) => {
      const found = held.tools.find((candidate) => candidate.name === name);
      if (found === undefined) throw new Error(`missing tool '${name}'`);
      return found;
    };

    const selected = await tool("read_selection").execute({}) as { evidenceId: string; span: { text: string } };
    assert.equal(selected.span.text, "Selected fact");
    assert.equal(issued.size, 1);
    assert.equal(
      (issued.get(selected.evidenceId) as { evidenceKind: string }).evidenceKind,
      "text"
    );
    const inspected = await tool("inspect_slide").execute({ resourceId: "presentations:presentation", slideId: "slide-one" }) as {
      items: Array<{ id: string; frame: { x: number; y: number; width: number; height: number }; ranges: unknown[]; materialHandle: string | null }>;
    };
    assert.equal(inspected.items.find((item) => item.id === "headline")?.ranges.length, 1);
    const grouped = inspected.items.find((item) => item.id === "group-child")!;
    assert.ok(Math.abs(grouped.frame.x - 0.65) < 1e-10);
    assert.ok(Math.abs(grouped.frame.y - 0.075) < 1e-10);
    assert.ok(Math.abs(grouped.frame.width - 0.2) < 1e-10);
    assert.ok(Math.abs(grouped.frame.height - 0.05) < 1e-10);
    const chartHandle = inspected.items.find((item) => item.id === "chart")?.materialHandle;
    assert.ok(chartHandle !== null && chartHandle !== undefined);
    assert.equal(issued.size, 1);

    const viewed = await tool("view_slide").execute({ resourceId: "presentations:presentation", slideId: "slide-one" }) as {
      kind: string;
      value: { slideId: string; viewKind: string; supportingContext: boolean };
      images: Array<{ base64: string }>;
    };
    assert.equal(viewed.kind, "intelligenceToolOutput");
    assert.deepEqual(viewed.value, {
      slideId: "slide-one",
      viewKind: "schematic",
      supportingContext: true
    });
    assert.equal("evidenceId" in viewed.value, false);
    const rendered = Buffer.from(viewed.images[0].base64, "base64").toString("utf8");
    assert.equal(rendered.includes("SECRET GENERATED VALUE"), false);
    assert.match(rendered, /Generated Prompt Block omitted/);
    assert.match(rendered, /<svg[^>]+width="1600" height="900"/);
    assert.match(rendered, /<rect x="80" y="45" width="640" height="90"/);
    assert.match(rendered, /<rect x="1040" y="67\.5" width="320" height="45"/);
    assert.equal(issued.size, 1);

    const chart = await tool("read_chart").execute({ materialHandle: chartHandle, series: ["Revenue"] }) as {
      evidenceId: string;
      spec: { series: Array<{ name: string }> };
    };
    assert.equal(chart.evidenceId, "evidence-2");
    assert.deepEqual(chart.spec.series.map((series) => series.name), ["Revenue"]);
    assert.equal((issued.get(chart.evidenceId) as { evidenceKind: string }).evidenceKind, "structured");
    await assert.rejects(() => tool("read_chart").execute({ materialHandle: chartHandle, series: ["Unknown"] }), /does not exist/);
  });

  it("maps every document area and nested block to authoritative exact-text ranges", async () => {
    const leader = (tables.get("documentSnapshots") ?? [])[0];
    leader.body = {
      header: {
        rows: [{ id: "header-row", kind: "blocks", blocks: [textBlock("running-title", "Private brief")] }],
        distanceFromEdge: 20
      },
      rows: [{
        id: "body-row",
        kind: "blocks",
        blocks: [
          {
            id: "metrics",
            type: "table",
            headerRows: 1,
            rows: [
              { id: "head", cells: [{ id: "head-cell", blocks: [textBlock("metric-label", "Metric")] }] },
              { id: "data", cells: [{ id: "data-cell", blocks: [textBlock("raw-value", "900")] }] }
            ]
          },
          {
            id: "generated",
            type: "prompt",
            atoms: [{ id: "generated-atom", kind: "literal", text: "MODEL VALUE" }],
            display: "MODEL VALUE",
            marks: [],
            derivedOutputId: "derivedOutputs:document-prompt",
            refreshedAt: 1,
            state: "fresh"
          }
        ]
      }]
    };
    const held = session();
    const list = held.tools.find((candidate) => candidate.name === "list_document_blocks")!;

    const body = await list.execute({ resourceId: "documents:doc" }) as {
      area: string;
      items: Array<{ blockPath: string[]; ranges: Array<{ from: number; to: number }> }>;
    };
    assert.equal(body.area, "body");
    assert.deepEqual(body.items.map((item) => item.blockPath), [
      ["metrics"],
      ["metrics", "head", "head-cell", "metric-label"],
      ["metrics", "data", "data-cell", "raw-value"],
      ["generated"]
    ]);
    const label = body.items.find((item) => item.blockPath.at(-1) === "metric-label")!;
    assert.equal(label.ranges.length, 1);
    assert.equal(body.items.find((item) => item.blockPath.at(-1) === "raw-value")?.ranges.length, 0);
    assert.equal(body.items.find((item) => item.blockPath.at(-1) === "generated")?.ranges.length, 0);

    const header = await list.execute({ resourceId: "documents:doc", area: "header" }) as {
      items: Array<{ blockPath: string[]; ranges: Array<{ from: number; to: number }> }>;
    };
    assert.deepEqual(header.items[0].blockPath, ["running-title"]);
    assert.equal(header.items[0].ranges.length, 1);

    const read = held.tools.find((candidate) => candidate.name === "read_text")!;
    const exact = await read.execute({
      kind: "document",
      resourceId: "documents:doc",
      ...label.ranges[0]
    }) as { span: { text: string }; evidenceId: string };
    assert.equal(exact.span.text, "Metric");
    assert.equal((issued.get(exact.evidenceId) as { source: { revision: number } }).source.revision, 2);
  });

  it("preserves multiple slide materials and background placement identity", async () => {
    const presentation = (tables.get("presentationSnapshots") ?? [])[0];
    const slide = (presentation.body as { slides: Array<Record<string, unknown>> }).slides[0];
    slide.background = { kind: "image", fileId: "externalFiles:image", fit: "cover" };
    (slide.elements as unknown[]).push({
      id: "table",
      frame: { x: 0.55, y: 0.2, width: 0.4, height: 0.5 },
      content: {
        type: "table",
        block: {
          id: "table-block",
          type: "table",
          headerRows: 1,
          rows: [
            { id: "head", cells: [{ id: "head-cell", blocks: [textBlock("heading", "Artifact")] }] },
            {
              id: "data",
              cells: [{
                id: "image-cell",
                blocks: [{
                  id: "nested-image",
                  type: "image",
                  source: { kind: "file", fileId: "externalFiles:image" },
                  alt: "Architecture diagram"
                }]
              }]
            }
          ]
        }
      }
    });
    const materials = tables.get("semanticMaterials") ?? [];
    const image = materials.find((row) => row._id === "semanticMaterials:image")!;
    (image.profile as { placementCount: number }).placementCount = 2;
    materials.push({
      _id: "semanticMaterials:table", _creationTime: 5, projectId,
      identityKey: "table", kind: "table", name: "Artifact",
      source: {
        kind: "resourceContent", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3,
        locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["table"], blockPath: ["table-block"] }
      },
      profile: { kind: "table", rows: 2, columns: 1, headerRows: 1, headers: ["Artifact"], columnsProfile: [], mergedRegions: 0, sample: [], warnings: [] },
      profileHash: "table-profile", contextHash: "table-context",
      revisionKey: "revision:presentation:presentations:presentation:3", state: "ready", updatedAt: 1
    });
    const placements = tables.get("semanticMaterialPlacements") ?? [];
    placements.push(
      {
        _id: "semanticMaterialPlacements:table", _creationTime: 2, projectId,
        semanticMaterialId: "semanticMaterials:table", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3,
        locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["table"], blockPath: ["table-block"] },
        context: { nearbyText: [], notes: [] }, contextHash: "table-context", updatedAt: 1
      },
      {
        _id: "semanticMaterialPlacements:nested-image", _creationTime: 3, projectId,
        semanticMaterialId: "semanticMaterials:image", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3,
        locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["table"], blockPath: ["table-block", "data", "image-cell", "nested-image"] },
        context: { nearbyText: [], notes: [] }, contextHash: "nested-context", updatedAt: 1
      },
      {
        _id: "semanticMaterialPlacements:background", _creationTime: 4, projectId,
        semanticMaterialId: "semanticMaterials:image", ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3,
        locator: { kind: "slideBackground", slideId: "slide-one" },
        context: { nearbyText: [], notes: [] }, contextHash: "background-context", updatedAt: 1
      }
    );

    const held = session();
    const inspect = held.tools.find((candidate) => candidate.name === "inspect_slide")!;
    const result = await inspect.execute({ resourceId: "presentations:presentation", slideId: "slide-one" }) as {
      items: Array<{ id: string; materials: Array<{ materialHandle: string; locator: { kind: string } }> }>;
      backgroundMaterials: Array<{ materialHandle: string; locator: { kind: string } }>;
    };
    const table = result.items.find((item) => item.id === "table")!;
    assert.deepEqual(table.materials.map((entry) => entry.locator.kind), ["slideElement", "slideElement"]);
    assert.equal(result.backgroundMaterials.length, 1);
    const nestedImage = table.materials.find((entry) => entry.locator.kind === "slideElement" && entry.materialHandle !== table.materials[0].materialHandle)!;
    assert.notEqual(nestedImage.materialHandle, result.backgroundMaterials[0].materialHandle);
  });

  it("resolves a nested slide table by its complete block path", async () => {
    const presentation = (tables.get("presentationSnapshots") ?? [])[0];
    const slide = (presentation.body as { slides: Array<{ elements: unknown[] }> }).slides[0];
    const nestedTable = {
      id: "nested-table",
      type: "table" as const,
      headerRows: 1,
      rows: [
        { id: "nested-head", cells: [{ id: "nested-head-cell", blocks: [textBlock("nested-heading", "Year")] }] },
        { id: "nested-row", cells: [{ id: "nested-value-cell", blocks: [textBlock("nested-value", "2026")] }] }
      ]
    };
    slide.elements.push({
      id: "outer-table-element",
      frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      content: {
        type: "table",
        block: {
          id: "outer-table",
          type: "table",
          headerRows: 0,
          rows: [{
            id: "outer-row",
            cells: [{ id: "outer-cell", blocks: [nestedTable] }]
          }]
        }
      }
    });
    const locator = {
      kind: "slideElement" as const,
      slideId: "slide-one",
      elementPath: ["outer-table-element"],
      blockPath: ["outer-table", "outer-row", "outer-cell", "nested-table"]
    };
    (tables.get("semanticMaterials") ?? []).push({
      _id: "semanticMaterials:nested-table", _creationTime: 6, projectId,
      identityKey: "nested-table", kind: "table", name: "Year",
      source: {
        kind: "resourceContent", ref: { kind: "presentation", id: "presentations:presentation" },
        revision: 3, locator
      },
      profile: {
        kind: "table", rows: 2, columns: 1, headerRows: 1,
        headers: ["Year"], columnsProfile: [], mergedRegions: 0,
        sample: [["Year"], ["2026"]], warnings: []
      },
      profileHash: "nested-table-profile", contextHash: "nested-table-context",
      revisionKey: "revision:presentation:presentations:presentation:3", state: "ready", updatedAt: 1
    });
    (tables.get("semanticMaterialPlacements") ?? []).push({
      _id: "semanticMaterialPlacements:nested-table", _creationTime: 6, projectId,
      semanticMaterialId: "semanticMaterials:nested-table",
      ref: { kind: "presentation", id: "presentations:presentation" }, revision: 3, locator,
      context: { nearbyText: [], notes: [] }, contextHash: "nested-table-context", updatedAt: 1
    });

    const held = session();
    const handle = held.rememberMaterial(snapshot("semanticMaterials:nested-table", {
      ref: { kind: "presentation", id: asId<"presentations">("presentations:presentation") }, revision: 3, locator
    }));
    const read = held.tools.find((candidate) => candidate.name === "read_table")!;
    const result = await read.execute({ materialHandle: handle }) as { rows: string[][] };
    assert.deepEqual(result.rows, [["Year"], ["2026"]]);
  });

  it("reads bounded CSV, code, and original-image authority with typed evidence", async () => {
    const held = session();
    const tool = (name: string) => held.tools.find((candidate) => candidate.name === name)!;
    const csvHandle = held.rememberMaterial(snapshot("semanticMaterials:csv"));
    const codeHandle = held.rememberMaterial(snapshot("semanticMaterials:code"));
    const imageHandle = held.rememberMaterial(snapshot("semanticMaterials:image"));

    const csv = await tool("read_csv").execute({
      materialHandle: csvHandle,
      rows: [1],
      columns: ["Region", "Revenue"]
    }) as { evidenceId: string; rows: unknown };
    assert.deepEqual(csv.rows, [{ row: 1, values: ["South", "200"] }]);
    assert.equal((issued.get(csv.evidenceId) as { evidenceKind: string }).evidenceKind, "structured");
    await assert.rejects(() => tool("read_csv").execute({ materialHandle: csvHandle, rows: [2], columns: ["Region"] }), /row must be/);

    const code = await tool("read_code").execute({ materialHandle: codeHandle, fromLine: 1, toLine: 1 }) as { evidenceId: string; text: string };
    assert.equal(code.text, "export const answer = 42;");
    assert.equal((issued.get(code.evidenceId) as { distance: number }).distance, 0);

    await assert.rejects(() => tool("read_image").execute({
      materialHandle: imageHandle,
      crop: { x: 630, y: 0, width: 20, height: 20 }
    }), /exceeds/);
    const image = await tool("read_image").execute({ materialHandle: imageHandle }) as {
      value: { evidenceId: string };
      images: Array<{ kind: string; base64: string }>;
    };
    assert.equal(image.images[0].kind, "bytes");
    assert.equal(image.images[0].base64, Buffer.from([137, 80, 78, 71]).toString("base64"));
    assert.equal((issued.get(image.value.evidenceId) as { evidenceKind: string }).evidenceKind, "visual");

    const imageRow = (tables.get("semanticMaterials") ?? []).find(
      (row) => row._id === "semanticMaterials:image"
    )!;
    (imageRow.profile as { source: unknown }).source = {
      kind: "url",
      url: "https://example.invalid/mutable.png"
    };
    await assert.rejects(
      () => tool("read_image").execute({ materialHandle: imageHandle }),
      /content-addressed storage/
    );

  });

  it("rechecks the Resource Set even for an attempt-local material handle", async () => {
    const held = session({ include: [], exclude: [{ select: "project" }] });
    const handle = held.rememberMaterial(snapshot("semanticMaterials:csv"));
    const read = held.tools.find((tool) => tool.name === "read_csv")!;
    await assert.rejects(
      () => read.execute({ materialHandle: handle, rows: [0], columns: ["Region"] }),
      /outside the Derived Output Resource Set/
    );
  });

  it("checks cancellation around every tool and passes it into native reads", async () => {
    const alreadyStopped = new AbortController();
    alreadyStopped.abort();
    const stopped = session(undefined, alreadyStopped.signal);
    const find = stopped.tools.find((candidate) => candidate.name === "find_resources")!;
    await assert.rejects(() => find.execute({}), /aborted/i);

    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const originalRead = model.externalFileStorage.read;
    model.externalFileStorage.read = async (ref, signal) => {
      received = signal;
      const bytes = await originalRead(ref, signal);
      controller.abort();
      return bytes;
    };
    const held = session(undefined, controller.signal);
    const handle = held.rememberMaterial(snapshot("semanticMaterials:code"));
    const read = held.tools.find((candidate) => candidate.name === "read_code")!;

    await assert.rejects(
      () => read.execute({ materialHandle: handle, fromLine: 1, toLine: 1 }),
      /aborted/i
    );
    assert.equal(received, controller.signal);
  });

  it("does not resolve an unnamed private Resource Set supplied as the output scope", async () => {
    put("resourceSets", [
      {
        _id: "resourceSets:private",
        _creationTime: 1,
        projectId,
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:doc" },
          hole: "evidence"
        },
        set: {
          include: [{ select: "resources", refs: [{ kind: "document", id: "documents:doc" }] }],
          exclude: []
        },
        createdBy: { kind: "system" },
        revision: 1,
        updatedAt: 1
      }
    ]);
    const held = session({
      include: [{ select: "set", setId: "resourceSets:private" as Id<"resourceSets"> }],
      exclude: []
    });
    const read = held.tools.find((candidate) => candidate.name === "read_text")!;

    await assert.rejects(
      () => read.execute({ kind: "document", resourceId: "documents:doc", from: 0, to: 8 }),
      /resource set 'resourceSets:private' does not exist/
    );
  });

  it("fails closed on duplicate or malformed named Resource Sets while reading", async () => {
    const reusable: Row = {
      _id: "resourceSets:evidence",
      _creationTime: 1,
      projectId,
      name: "Evidence",
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:doc" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    };
    const read = () => {
      const held = session({
        include: [{ select: "set", setId: "resourceSets:evidence" as Id<"resourceSets"> }],
        exclude: []
      });
      return held.tools.find((candidate) => candidate.name === "read_text")!.execute({
        kind: "document",
        resourceId: "documents:doc",
        from: 0,
        to: 8
      });
    };

    put("resourceSets", [reusable]);
    const allowed = await read() as { span: { text: string } };
    assert.equal(allowed.span.text, "Selected");

    put("resourceSets", [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Duplicate claimant" }
    ]);
    assert.throws(read, /repeats row id/);

    put("resourceSets", [
      { ...reusable, createdBy: { kind: "user" } }
    ]);
    assert.throws(read, /non-current field values/);
  });

  it("rejects a material handle as soon as its native resource revision advances", async () => {
    const held = session();
    const handle = held.rememberMaterial(snapshot("semanticMaterials:chart", {
      ref: { kind: "presentation", id: asId<"presentations">("presentations:presentation") },
      revision: 3,
      locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["chart"] }
    }));
    (tables.get("presentationSnapshots") ?? [])[0].revision = 4;
    const read = held.tools.find((tool) => tool.name === "read_chart")!;
    await assert.rejects(
      () => read.execute({ materialHandle: handle, series: ["Revenue"] }),
      /materialHandle is stale/
    );
  });

  it("projects an External text authority with its current represented revision", () => {
    (tables.get("externalFiles") ?? []).push({
      _id: "externalFiles:notes",
      _creationTime: 4,
      projectId,
      name: "notes.md",
      originalName: "notes.md",
      relativePath: "notes.md",
      mediaType: "text/markdown",
      subkind: "text",
      storageId: `_storage:${hash("d")}`,
      hash: hash("d"),
      size: 12,
      origin: { kind: "upload" },
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      revision: 7,
      updatedAt: 4
    });

    const source = activeSources(model.store, projectId).find(
      (candidate) => candidate.ref.id === "externalFiles:notes"
    );

    assert.deepEqual(source, {
      ref: { kind: "externalFile::text", id: "externalFiles:notes" },
      revision: 7,
      contentHash: hash("d"),
      encoding: "utf-16"
    });
  });
});

describe("material discovery evidence", () => {
  it("never presents a native visual match as if it contained descriptor text", () => {
    const hit = materialHit({
      materialId: "semanticMaterials:image" as Id<"semanticMaterials">,
      kind: "image",
      name: "Architecture sketch",
      source: {
        kind: "externalFile",
        ref: {
          kind: "externalFile::image",
          id: asId<"externalFiles">("externalFiles:image")
        },
        fileId: "externalFiles:image" as Id<"externalFiles">,
        hash: hash("d"),
        mediaType: "image/png",
        subkind: "image"
      },
      profileHash: "profile-hash",
      contextHash: "context-hash",
      revisionKey: `hash:${hash("d")}`
    });
    hit.profile = { facts: ["image", "image/png"], warnings: [] };
    hit.profileFacet = { inputHash: "profile-facet-hash", text: "image. image/png" };
    hit.matchedFacets = ["nativeVisual"];
    hit.matched = [{ facet: "nativeVisual", inputHash: "visual-hash" }];
    hit.description = {
      provenance: "generated",
      text: "A generated interpretation that was not the matching facet.",
      model: "descriptor-model",
      promptVersion: "v1",
      coverage: { mode: "complete", description: "bounded profile" }
    };

    assert.deepEqual(materialDescriptorEvidence(hit), {
      facet: "profile",
      inputHash: "profile-facet-hash",
      text: "image. image/png"
    });
  });
});
