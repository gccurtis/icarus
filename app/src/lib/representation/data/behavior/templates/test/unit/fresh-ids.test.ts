import { describe, expect, it } from "vitest";

import type { DocumentRow } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";

const mint = (hint: IdHint, previous: string) => `${hint}:${previous}`;

describe("withFreshIds", () => {
  it("renames rows, blocks, atoms and marks and keeps mark ends attached", () => {
    const rows: DocumentRow[] = [
      {
        id: "r1",
        kind: "blocks",
        blocks: [
          {
            id: "b1",
            type: "text",
            variant: "paragraph",
            atoms: [{ id: "a1", kind: "literal", text: "Hello" }],
            display: "Hello",
            marks: [{ id: "m1", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"] }]
          },
          {
            id: "t1",
            type: "table",
            headerRows: 1,
            rows: [{ id: "tr1", cells: [{ id: "c1", blocks: [{ id: "b2", type: "text", variant: "paragraph", atoms: [{ id: "a2", kind: "literal", text: "" }], display: "", marks: [] }] }] }]
          }
        ]
      }
    ];
    const fresh = withFreshIds(rows, mint, "row");
    const row = fresh[0];
    if (row.kind !== "blocks") throw new Error("blocks expected");
    expect(row.id).toBe("row:r1");
    const text = row.blocks[0];
    if (text.type !== "text") throw new Error("text expected");
    expect(text.id).toBe("block:b1");
    expect(text.atoms[0].id).toBe("atom:a1");
    expect(text.marks[0]).toEqual({ id: "mark:m1", from: { atom: "atom:a1", offset: 0 }, to: { atom: "atom:a1", offset: 2 }, style: ["bold"] });
    const table = row.blocks[1];
    if (table.type !== "table") throw new Error("table expected");
    expect(table.rows[0].id).toBe("row:tr1");
    expect(table.rows[0].cells[0].id).toBe("cell:c1");
    expect(table.rows[0].cells[0].blocks[0].id).toBe("block:b2");
    expect(rows[0].id).toBe("r1");
  });

  it("renames slides, elements, groups, layouts and section anchors", () => {
    const deck: SlideDeckBody = {
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "blue" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [{ id: "l1", key: "title", name: "Title", locked: [{ id: "e0", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "shape", shape: "rectangle" } }], placeholders: [] }],
      slides: [
        {
          id: "s1",
          layoutKey: "title",
          elements: [
            { id: "e1", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "group", children: [{ id: "e2", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } }] } }
          ],
          notes: [{ id: "n1", type: "text", variant: "paragraph", atoms: [{ id: "na1", kind: "literal", text: "" }], display: "", marks: [] }]
        }
      ],
      sections: [{ id: "sec1", name: "Opening", firstSlideId: "s1" }]
    };
    const fresh = withFreshIds(deck, mint);
    expect(fresh.layouts[0].id).toBe("layout:l1");
    expect(fresh.layouts[0].key).toBe("title");
    expect(fresh.layouts[0].locked[0].id).toBe("element:e0");
    expect(fresh.slides[0].id).toBe("slide:s1");
    expect(fresh.slides[0].layoutKey).toBe("title");
    expect(fresh.slides[0].elements[0].id).toBe("element:e1");
    const group = fresh.slides[0].elements[0].content;
    if (group.type !== "group") throw new Error("group expected");
    expect(group.children[0].id).toBe("element:e2");
    expect(fresh.slides[0].notes[0].id).toBe("block:n1");
    expect(fresh.sections[0]).toEqual({ id: "section:sec1", name: "Opening", firstSlideId: "slide:s1" });
  });
});
