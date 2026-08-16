import { describe, expect, it } from "vitest";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { invert } from "$revisions/api/shared/apply/invert";
import { check, touchedBy } from "$revisions/api/submit/check";
import { asCtx, asking } from "$revisions/test/fixture";
import type { Op } from "$revisions/types/change";

/**
 * **The claim this task exists to test.** The snapshot and change-set machinery
 * is generic over `resourceType`: an op names a path and a value, and nothing
 * applying, inverting, or conflict-checking it ever asks what kind of resource
 * it is in.
 *
 * So a deck and a workbook are supposed to come along for free, and the way to
 * find out is to run the spec's own op table against all three bodies. A
 * resource-specific branch anywhere below `revisions/` would show up here as a
 * test that only passes for documents.
 */

const paragraph = (id: string, text: string) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}a`, kind: "literal", text }],
  display: text,
  marks: [{ id: "m03", from: 0, to: 3 }]
});

const documentBody = () => ({
  page: { paper: "a4", orientation: "portrait", margins: { top: 72, right: 72, bottom: 72, left: 72 } },
  styles: { styles: { heading1: { name: "Heading 1", fontSize: 18 } }, defaultKey: "heading1" },
  rows: [
    { id: "r4m1", kind: "blocks", blocks: [paragraph("b7x2", "The quarterly report")] },
    { id: "r4m2", kind: "pageBreak" }
  ]
});

const deckBody = () => ({
  theme: { colors: { text: "black", accent: "blue" } },
  styles: { styles: { heading1: { name: "Heading 1", fontSize: 18 } }, defaultKey: "heading1" },
  layouts: [],
  slides: [
    {
      id: "s12",
      elements: [
        {
          id: "e4",
          frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
          blocks: [paragraph("b7x2", "The quarterly report")],
          overflow: "shrink"
        }
      ],
      notes: []
    },
    { id: "s13", elements: [], notes: [] }
  ],
  sections: [{ id: "sec1", name: "Findings", firstSlideId: "s12" }]
});

const cell = (text: string) => ({ blocks: [paragraph(`c${text}`, text)] });

const sheetBody = () => ({
  sheets: [
    {
      id: "sh1",
      name: "Sheet1",
      cells: { A1: cell("Region"), B2: cell("North"), B6: cell("6"), B7: cell("7"), D9: cell("9") },
      merges: ["B2:D4"],
      spills: [],
      charts: [],
      rowCount: 1000,
      columnCount: 26,
      columnWidths: { B: 72 },
      print: {
        page: {
          paper: "a4",
          orientation: "landscape",
          margins: { top: 36, right: 36, bottom: 36, left: 36 }
        }
      }
    }
  ],
  styles: { styles: { heading1: { name: "Heading 1", fontSize: 18 } }, defaultKey: "heading1" }
});

const setting = (target: Op["target"], path: string, value: unknown, was: unknown): Op => ({
  op: "set",
  target,
  path,
  value,
  was
});

/** Every row of the op table in `docs/data-models/revisions/change-set.md`. */
const theOpTable: { intent: string; body: () => unknown; op: Op }[] = [
  {
    intent: "insert a document row",
    body: documentBody,
    op: {
      op: "insert",
      target: "row",
      path: "rows",
      after: "#r4m1",
      values: [{ id: "r9k2", kind: "pageBreak" }]
    }
  },
  {
    intent: "type in a paragraph",
    body: documentBody,
    op: { op: "text", target: "atom", path: "#b7x2/atoms/#b7x2a", at: 4, insert: "strong ", remove: "" }
  },
  {
    intent: "bold a phrase",
    body: documentBody,
    op: setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 0, to: 3, style: ["bold"] }, { id: "m03", from: 0, to: 3 })
  },
  {
    intent: "change a page margin",
    body: documentBody,
    op: setting("field", "page/margins/top", 96, 72)
  },
  {
    intent: "restyle every heading",
    body: documentBody,
    op: setting("field", "styles/styles/heading1/fontSize", 24, 18)
  },
  {
    intent: "add a slide",
    body: deckBody,
    op: {
      op: "insert",
      target: "slide",
      path: "slides",
      after: "#s12",
      values: [{ id: "s99", elements: [], notes: [] }]
    }
  },
  {
    intent: "move a slide element",
    body: deckBody,
    op: setting(
      "element",
      "#e4/frame",
      { x: 0.2, y: 0.2, width: 0.8, height: 0.2 },
      { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }
    )
  },
  {
    intent: "change the deck accent colour",
    body: deckBody,
    op: setting("field", "theme/colors/accent", "orange", "blue")
  },
  {
    intent: "set a cell",
    body: sheetBody,
    op: setting("cell", "sheets/#sh1/cells/B7", cell("42"), cell("7"))
  },
  {
    intent: "resize a column",
    body: sheetBody,
    op: setting("field", "sheets/#sh1/columnWidths/B", 96, 72)
  },
  {
    intent: "merge cells",
    body: sheetBody,
    op: { op: "insert", target: "merge", path: "sheets/#sh1/merges", after: null, values: ["F2:G3"] }
  }
];

describe("the five ops over all three bodies", () => {
  for (const { intent, body, op } of theOpTable) {
    it(`applies and undoes: ${intent}`, () => {
      const before = body();

      const after = applyOps(before, [op]);

      expect(after).not.toEqual(before);
      expect(applyOps(after, [invert(op)])).toEqual(before);
      // Applying copies: the anchor a reader holds is not edited underneath it.
      expect(before).toEqual(body());
    });
  }
});

describe("restyling and recolouring", () => {
  it("are ordinary change sets, because the style set and the theme are in the body", () => {
    const restyled = applyOps(documentBody(), [
      setting("field", "styles/styles/heading1/fontSize", 24, 18)
    ]);
    const recoloured = applyOps(deckBody(), [setting("field", "theme/colors/accent", "orange", "blue")]);

    // On the row they would be a patch, and a patch is not a revision — nothing
    // would have anything to undo.
    expect(restyled.styles.styles.heading1.fontSize).toBe(24);
    expect(recoloured.theme.colors.accent).toBe("orange");
  });
});

/**
 * The awkward case the model names: a cell's identity is its address, so
 * inserting a row rekeys every populated cell below it.
 */
const rowOf = (address: string) => Number(address.replace(/^[A-Z]+/, ""));

const at = (address: string) => `sheets/#sh1/cells/${address}`;

const down = (address: string) => address.replace(/\d+$/, String(rowOf(address) + 1));

/**
 * What a client sends when a row is inserted: bottom-up, so a cell is written to
 * its new address before the one above it is moved down onto the old one.
 *
 * A cell that comes into being is an `insert` and a vacated one is a `remove`,
 * exactly as an ordered list's entries are — which is what makes the whole set
 * invertible. `set` is for an address that already held something.
 *
 * The vacated addresses are only those nothing moved into: everything else is
 * overwritten by the cell above it.
 */
const insertRowOps = (cells: Record<string, unknown>, row: number, rowCount: number): Op[] => {
  const moving = Object.keys(cells)
    .filter((address) => rowOf(address) >= row)
    .sort((a, b) => rowOf(b) - rowOf(a));
  const targets = new Set(moving.map(down));

  const ops: Op[] = moving.map((address) =>
    down(address) in cells
      ? setting("cell", at(down(address)), cells[address], cells[down(address)])
      : { op: "insert", target: "cell", path: at(down(address)), after: null, values: [cells[address]] }
  );
  for (const address of moving.filter((address) => !targets.has(address))) {
    ops.push({
      op: "remove",
      target: "cell",
      path: at(address),
      ids: [address],
      after: null,
      values: [cells[address]]
    });
  }
  ops.push(setting("field", "sheets/#sh1/rowCount", rowCount + 1, rowCount));
  return ops;
};

describe("inserting a row into a sheet", () => {
  const before = sheetBody();
  const ops = insertRowOps(before.sheets[0].cells, 5, before.sheets[0].rowCount);

  it("is many per-key ops, bounded by populated cells rather than declared extent", () => {
    // Three cells at or below row 5, out of 26,000 the extent declares.
    expect(ops.length).toBeLessThanOrEqual(3 * 2 + 1);
    expect(before.sheets[0].rowCount).toBe(1000);
  });

  it("rekeys the cells below it and leaves the ones above alone", () => {
    const after = applyOps(before, ops);

    expect(Object.keys(after.sheets[0].cells).sort()).toEqual(["A1", "B2", "B7", "B8", "D10"]);
    expect(after.sheets[0].cells.B7).toEqual(before.sheets[0].cells.B6);
    expect(after.sheets[0].cells.A1).toEqual(before.sheets[0].cells.A1);
    expect(after.sheets[0].rowCount).toBe(1001);
  });

  it("undoes as one change set, because every op in it is invertible", () => {
    const after = applyOps(before, ops);

    expect(applyOps(after, [...ops].reverse().map(invert))).toEqual(before);
  });

  it("names a restored keyed entry, because undoing a cell removal is an insert", () => {
    const removal: Op = {
      op: "remove",
      target: "cell",
      path: at("D9"),
      ids: ["D9"],
      after: null,
      values: [cell("9")]
    };

    expect(touchedBy([invert(removal)])).toEqual(touchedBy([removal]));
  });

  it("leaves a concurrent edit above the insertion point on a disjoint path", async () => {
    const { ctx, scope, projectId } = await asking();
    const resource = { resourceType: "spreadsheet", resourceId: "spreadsheets:1" } as const;
    await ctx.db.insert("changeSets", {
      projectId,
      ...resource,
      revision: 8,
      baseRevision: 7,
      tier: "recent",
      ops,
      touched: touchedBy(ops),
      actor: { kind: "system" },
      at: 1
    });
    const mine = [setting("cell", "sheets/#sh1/cells/B2", cell("South"), cell("North"))];

    // The coarse alternative — one `set` on the whole `cells` map — would be a
    // prefix of every cell path in the sheet, so this would collide instead.
    expect(await check(asCtx(ctx), scope, { ...resource, baseRevision: 7, ops: mine, touched: touchedBy(mine) }, 8)).toEqual(
      mine
    );
  });

  it("collides with a concurrent edit to a cell it rekeyed", async () => {
    const { ctx, scope, projectId } = await asking();
    const resource = { resourceType: "spreadsheet", resourceId: "spreadsheets:1" } as const;
    await ctx.db.insert("changeSets", {
      projectId,
      ...resource,
      revision: 8,
      baseRevision: 7,
      tier: "recent",
      ops,
      touched: touchedBy(ops),
      actor: { kind: "system" },
      at: 1
    });
    const mine = [setting("cell", "sheets/#sh1/cells/B7", cell("42"), cell("7"))];

    await expect(
      check(asCtx(ctx), scope, { ...resource, baseRevision: 7, ops: mine, touched: touchedBy(mine) }, 8)
    ).rejects.toThrow();
  });

  it("collides with a concurrent edit to a cell it created", async () => {
    const { ctx, scope, projectId } = await asking();
    const resource = { resourceType: "spreadsheet", resourceId: "spreadsheets:1" } as const;
    await ctx.db.insert("changeSets", {
      projectId,
      ...resource,
      revision: 8,
      baseRevision: 7,
      tier: "recent",
      ops,
      touched: touchedBy(ops),
      actor: { kind: "system" },
      at: 1
    });
    const mine: Op[] = [
      { op: "insert", target: "cell", path: at("D10"), after: null, values: [cell("42")] }
    ];

    await expect(
      check(asCtx(ctx), scope, { ...resource, baseRevision: 7, ops: mine, touched: touchedBy(mine) }, 8)
    ).rejects.toThrow();
  });
});
