import { describe, expect, it } from "vitest";

import { projectResource } from "$representation/data/behavior/semantic/projection/project-resource";
import type {
  ImageBlock,
  PromptBlock,
  TableBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}:atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const prompt = (id: string, display: string): PromptBlock => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}:atom`, kind: "literal", text: display }],
  display,
  marks: [],
  state: "fresh"
});

const table = (): TableBlock => ({
  id: "sales-table",
  type: "table",
  headerRows: 1,
  rows: [
    {
      id: "header",
      cells: [
        { id: "h-region", blocks: [text("region", "Region")] },
        { id: "h-revenue", blocks: [text("revenue", "Revenue")] }
      ]
    },
    {
      id: "north",
      cells: [
        { id: "north-name", blocks: [text("north-label", "North")] },
        {
          id: "north-value",
          blocks: [text("north-amount", "120"), prompt("generated-cell", "999")]
        }
      ]
    }
  ]
});

const deckWith = (block: TableBlock): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "#111", accent: "#08f" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  sections: [],
  slides: [
    {
      id: "slide-one",
      elements: [
        {
          id: "context-group",
          frame: { x: 40, y: 20, width: 500, height: 60 },
          content: {
            type: "group",
            children: [{
              id: "context-text",
              frame: { x: 0, y: 0, width: 1, height: 1 },
              content: { type: "text", block: text("context-block", "Quarter overview") }
            }]
          }
        },
        {
          id: "table-element",
          frame: { x: 40, y: 100, width: 500, height: 300 },
          content: { type: "table", block }
        }
      ],
      notes: []
    },
    {
      id: "slide-two",
      elements: [
        {
          id: "closing",
          frame: { x: 40, y: 40, width: 400, height: 80 },
          content: { type: "text", block: text("closing-text", "Closing thought") }
        }
      ],
      notes: []
    }
  ]
});

describe("semantic material projection", () => {
  it("keeps table values native while exact text retains only authored labels", () => {
    const projection = projectResource({
      kind: "document",
      ref: { kind: "document", id: "sales" },
      revision: 3,
      title: "Sales report",
      body: {
        rows: [
          {
            id: "body",
            kind: "blocks",
            blocks: [
              text("intro", "Quarterly results"),
              table(),
              text("outro", "Approved by finance"),
              prompt("answer", "North wins with 999")
            ]
          }
        ]
      }
    });

    expect(projection.exact.text).toBe("Quarterly results\n\nRegion\n\nRevenue\n\nApproved by finance");
    expect(projection.exact.text).not.toContain("North");
    expect(projection.exact.text).not.toContain("120");
    expect(projection.exact.text).not.toContain("999");
    expect(projection.materials).toHaveLength(1);
    expect(projection.materials[0]).toMatchObject({
      kind: "table",
      name: "Region / Revenue",
      profile: {
        kind: "table",
        rows: 2,
        columns: 2,
        headers: ["Region", "Revenue"],
        sample: [["Region", "Revenue"], ["North", "120"]]
      }
    });
    expect(projection.materials[0].context.nearbyText).toEqual([
      "Quarterly results",
      "Approved by finance"
    ]);
  });

  it("uses one shared table profiler for document and slide traversal", () => {
    const native = table();
    const documentProjection = projectResource({
      kind: "document",
      ref: { kind: "document", id: "doc" },
      revision: 1,
      title: "Doc",
      body: { rows: [{ id: "row", kind: "blocks", blocks: [native] }] }
    });
    const slides = projectResource({
      kind: "slides",
      ref: { kind: "slides", id: "deck" },
      revision: 1,
      title: "Deck",
      body: deckWith(native)
    });

    expect(slides.materials[0].profile).toEqual(documentProjection.materials[0].profile);
    expect(slides.materials[0].source).toMatchObject({
      kind: "resourceContent",
      locator: { kind: "slideElement", slideId: "slide-one", elementPath: ["table-element"] }
    });
    expect(slides.exact.text).toBe("Quarter overview\n\nRegion\n\nRevenue\n\nClosing thought");
    expect(slides.materials[0].context.nearbyText).toContain("Quarter overview");
    expect(slides.exact.hardBoundaries).toHaveLength(1);
    expect(slides.exact.hardBoundaries?.every((boundary) => Number.isInteger(boundary))).toBe(true);
  });

  it("identifies repeated file images once while retaining distinct placements", () => {
    const fileId = "externalFiles:logo" as Id<"externalFiles">;
    const image = (id: string, alt: string): ImageBlock => ({
      id,
      type: "image",
      source: { kind: "file", fileId },
      alt
    });
    const projection = projectResource({
      kind: "document",
      ref: { kind: "document", id: "brand" },
      revision: 2,
      title: "Brand",
      body: {
        rows: [{ id: "row", kind: "blocks", blocks: [image("logo-one", "Company mark"), image("logo-two", "Footer mark")] }]
      },
      externalFile: () => ({
        fileId,
        name: "logo.png",
        mediaType: "image/png",
        subkind: "image",
        hash: "a".repeat(64)
      })
    });

    expect(projection.materials).toHaveLength(2);
    expect(projection.materials[0].identityKey).toBe(projection.materials[1].identityKey);
    expect(projection.materials.map((seed) => seed.placement?.locator)).toEqual([
      { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["logo-one"] },
      { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["logo-two"] }
    ]);
  });

  it("profiles nested materials without leaking table bodies or generated notes into text facets", () => {
    const nestedImage: ImageBlock = {
      id: "evidence-image",
      type: "image",
      source: { kind: "url", url: "https://example.test/evidence.png" },
      alt: "Body-only chart"
    };
    const nestedTable: TableBlock = {
      id: "nested-table",
      type: "table",
      headerRows: 1,
      rows: [
        { id: "nested-head", cells: [{ id: "nested-head-cell", blocks: [text("nested-label", "Nested label")] }] },
        { id: "nested-data", cells: [{ id: "nested-data-cell", blocks: [text("nested-secret", "TOP SECRET VALUE")] }] }
      ]
    };
    const outer: TableBlock = {
      id: "outer-table",
      type: "table",
      headerRows: 1,
      rows: [
        { id: "outer-head", cells: [{ id: "outer-head-cell", blocks: [text("outer-label", "Outer label")] }] },
        {
          id: "outer-data",
          cells: [{ id: "outer-data-cell", blocks: [nestedTable, nestedImage] }]
        }
      ]
    };
    const documentProjection = projectResource({
      kind: "document",
      ref: { kind: "document", id: "nested" },
      revision: 1,
      title: "Nested",
      body: { rows: [{ id: "row", kind: "blocks", blocks: [outer] }] }
    });

    expect(documentProjection.exact.text).toBe("Outer label");
    expect(documentProjection.exact.text).not.toContain("Nested label");
    expect(documentProjection.exact.text).not.toContain("TOP SECRET VALUE");
    expect(documentProjection.exact.text).not.toContain("Body-only chart");
    expect(documentProjection.materials.map((material) => material.kind)).toEqual(["table", "table", "image"]);
    expect(documentProjection.materials.map((material) => material.placement?.locator)).toEqual([
      { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["outer-table"] },
      {
        kind: "documentBlock", area: "body", rowId: "row",
        blockPath: ["outer-table", "outer-data", "outer-data-cell", "nested-table"]
      },
      {
        kind: "documentBlock", area: "body", rowId: "row",
        blockPath: ["outer-table", "outer-data", "outer-data-cell", "evidence-image"]
      }
    ]);

    const slideProjection = projectResource({
      kind: "slides",
      ref: { kind: "slides", id: "nested-deck" },
      revision: 1,
      title: "Nested deck",
      body: {
        ...deckWith(outer),
        slides: [{
          ...deckWith(outer).slides[0],
          notes: [prompt("generated-note", "MODEL SECRET"), outer]
        }]
      }
    });
    expect(slideProjection.exact.text).not.toContain("MODEL SECRET");
    expect(slideProjection.exact.text).not.toContain("TOP SECRET VALUE");
    expect(slideProjection.materials.map((material) => material.kind)).toEqual(["table", "table", "image"]);
    for (const material of slideProjection.materials) {
      expect(material.context.notes).not.toContain("MODEL SECRET");
      expect(material.context.notes).not.toContain("TOP SECRET VALUE");
    }
  });
});
