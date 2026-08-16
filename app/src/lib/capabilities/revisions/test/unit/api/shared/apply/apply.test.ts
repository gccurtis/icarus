import { describe, expect, it } from "vitest";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { invert } from "$revisions/api/shared/apply/invert";
import type { Op } from "$revisions/types/change";

type TextOp = Extract<Op, { op: "text" }>;

type Mark = { id: string; from: number; to: number; style?: string[] };
type Atom = { id: string; kind: string; text?: string; expression?: string; resolved?: string; state?: string };
type Block = { id: string; type: string; variant: string; atoms: Atom[]; display: string; marks: Mark[] };
type Row = { id: string; kind: string; blocks?: Block[] };
type Body = { page: { margins: { top: number; bottom: number } }; rows: Row[] };

/**
 * Rebuilt per test, so nothing here can assert its own fixture back.
 *
 * Three atoms rather than one, because a mark's offsets run across all of them:
 * an edit in the third must move a mark that follows it and no other.
 */
const body = (): Body => ({
  page: { margins: { top: 72, bottom: 72 } },
  rows: [
    {
      id: "r4m1",
      kind: "blocks",
      blocks: [
        {
          id: "b7x2",
          type: "text",
          variant: "paragraph",
          atoms: [
            { id: "a9x1", kind: "literal", text: "The quarterly report" },
            { id: "a9x2", kind: "formula", expression: "SUM(Sales!B:B)", resolved: "$4.2M", state: "fresh" },
            { id: "a9x3", kind: "literal", text: " overall" }
          ],
          display: "The quarterly report$4.2M overall",
          marks: [
            { id: "m01", from: 0, to: 3, style: ["italic"] },
            { id: "m03", from: 4, to: 20, style: ["bold"] },
            { id: "m07", from: 26, to: 33, style: ["code"] }
          ]
        }
      ]
    },
    { id: "r4m2", kind: "divider" }
  ]
});

const block = (doc: Body): Block => {
  const blocks = doc.rows[0].blocks;
  if (!blocks) throw new Error("the fixture's first row holds blocks");
  return blocks[0];
};

const marksOf = (doc: Body) => block(doc).marks.map(({ id, from, to }) => ({ id, from, to }));

const typed: TextOp = {
  op: "text",
  target: "atom",
  path: "#b7x2/atoms/#a9x1",
  at: 4,
  insert: "strong ",
  remove: ""
};

const margin: Op = { op: "set", target: "field", path: "page/margins/top", value: 96, was: 72 };

describe("applyOps", () => {
  it("leaves the body it was given untouched", () => {
    const before = body();

    applyOps(before, [typed, margin]);

    expect(before).toEqual(body());
  });

  it("walks ops in order, so the second measures against the first", () => {
    const doc = applyOps(body(), [
      { ...typed, insert: "very " },
      { ...typed, at: 9, insert: "big " }
    ]);

    expect(block(doc).atoms[0].text).toBe("The very big quarterly report");
  });

  describe("paths", () => {
    it("walks field names down to a scalar", () => {
      const doc = applyOps(body(), [margin]);

      expect(doc.page.margins).toEqual({ top: 96, bottom: 72 });
    });

    it("resolves an id segment by searching, so it needs no path above it", () => {
      const doc = applyOps(body(), [
        { op: "set", target: "mark", path: "#m03/style", value: ["underline"], was: ["bold"] }
      ]);

      expect(block(doc).marks[1].style).toEqual(["underline"]);
    });

    it("sets a key that does not exist yet, which is how a cell comes into being", () => {
      const sheet = { sheets: [{ id: "sh1", cells: {} as Record<string, unknown>, merges: [] as string[] }] };

      const next = applyOps(sheet, [
        { op: "set", target: "cell", path: "sheets/#sh1/cells/B7", value: { display: "42" }, was: null }
      ]);

      expect(next.sheets[0].cells.B7).toEqual({ display: "42" });
    });

    it("resolves an id to the node carrying it, not a field holding the same string", () => {
      const doc = {
        blocks: [
          {
            id: "b1",
            style: "a9x1",
            atoms: [{ id: "a9x1", kind: "literal", text: "hi" }]
          }
        ]
      };

      const next = applyOps(doc, [
        { op: "set", target: "atom", path: "#a9x1/text", value: "hello", was: "hi" }
      ]);

      expect(next.blocks[0].style).toBe("a9x1");
      expect(next.blocks[0].atoms[0].text).toBe("hello");
    });

    it("refuses to index an ordered list with something that is not an index", () => {
      expect(() =>
        applyOps(body(), [{ op: "set", target: "row", path: "rows/last", value: {}, was: null }])
      ).toThrow();
    });

    it("refuses a path naming an id the body does not hold", () => {
      expect(() =>
        applyOps(body(), [{ op: "set", target: "block", path: "#nope/style", value: "x", was: null }])
      ).toThrow();
    });
  });

  describe("ordered lists", () => {
    it("inserts after the named entry", () => {
      const doc = applyOps(body(), [
        { op: "insert", target: "row", path: "rows", after: "r4m1", values: [{ id: "r9k2", kind: "pageBreak" }] }
      ]);

      expect(doc.rows.map((row) => row.id)).toEqual(["r4m1", "r9k2", "r4m2"]);
    });

    it("inserts at the head when there is nothing to follow", () => {
      const doc = applyOps(body(), [
        { op: "insert", target: "row", path: "rows", after: null, values: [{ id: "r9k2", kind: "pageBreak" }] }
      ]);

      expect(doc.rows.map((row) => row.id)).toEqual(["r9k2", "r4m1", "r4m2"]);
    });

    it("removes by id and leaves the rest in place", () => {
      const doc = applyOps(body(), [
        { op: "remove", target: "row", path: "rows", ids: ["r4m1"], after: null, values: [] }
      ]);

      expect(doc.rows.map((row) => row.id)).toEqual(["r4m2"]);
    });

    it("moves by id rather than by index", () => {
      const doc = applyOps(body(), [
        { op: "move", target: "row", path: "rows", id: "r4m2", after: null, wasAfter: "r4m1" }
      ]);

      expect(doc.rows.map((row) => row.id)).toEqual(["r4m2", "r4m1"]);
    });

    it("refuses to remove an entry that is not there", () => {
      expect(() =>
        applyOps(body(), [{ op: "remove", target: "row", path: "rows", ids: ["r9k2"], after: null, values: [] }])
      ).toThrow();
    });
  });

  describe("a text op", () => {
    it("splices the atom's own text", () => {
      const doc = applyOps(body(), [typed]);

      expect(block(doc).atoms[0].text).toBe("The strong quarterly report");
    });

    it("rebuilds the block's display from the atoms in order", () => {
      const doc = applyOps(body(), [typed]);

      expect(block(doc).display).toBe("The strong quarterly report$4.2M overall");
    });

    it("moves the marks after it and leaves the ones before it alone", () => {
      const doc = applyOps(body(), [typed]);

      expect(marksOf(doc)).toEqual([
        { id: "m01", from: 0, to: 3 },
        { id: "m03", from: 11, to: 27 },
        { id: "m07", from: 33, to: 40 }
      ]);
      expect(block(doc).display.slice(11, 27)).toBe("quarterly report");
      expect(block(doc).display.slice(33, 40)).toBe("overall");
    });

    it("measures marks from where the edited atom starts in the display string", () => {
      const doc = applyOps(body(), [{ ...typed, path: "#b7x2/atoms/#a9x3", at: 1, insert: "very " }]);

      expect(marksOf(doc)).toEqual([
        { id: "m01", from: 0, to: 3 },
        { id: "m03", from: 4, to: 20 },
        { id: "m07", from: 31, to: 38 }
      ]);
      expect(block(doc).display.slice(31, 38)).toBe("overall");
    });

    it("collapses a mark whose text it removed, rather than leaving it on strangers", () => {
      const doc = body();
      block(doc).marks.push({ id: "m05", from: 5, to: 12, style: ["code"] });

      const next = applyOps(doc, [{ ...typed, remove: "quarterly", insert: "Q3" }]);

      expect(block(next).display).toBe("The Q3 report$4.2M overall");
      expect(marksOf(next)).toEqual([
        { id: "m01", from: 0, to: 3 },
        { id: "m03", from: 4, to: 13 },
        { id: "m07", from: 19, to: 26 },
        { id: "m05", from: 4, to: 4 }
      ]);
    });

    it("refuses when the text it says it removed is not there", () => {
      expect(() => applyOps(body(), [{ ...typed, remove: "monthly", insert: "Q3" }])).toThrow();
    });

    it("refuses an offset past the end of the atom rather than appending there", () => {
      expect(() => applyOps(body(), [{ ...typed, at: 999 }])).toThrow();
    });

    it("appends at the very end, which is where typing usually happens", () => {
      const doc = applyOps(body(), [{ ...typed, at: 20, insert: "!" }]);

      expect(block(doc).atoms[0].text).toBe("The quarterly report!");
    });

    it("never splits a surrogate pair, because offsets are UTF-16 like the slicing", () => {
      const emoji = {
        blocks: [
          {
            id: "b1",
            atoms: [{ id: "a1", kind: "literal", text: "a😀b" }],
            display: "a😀b",
            marks: [{ id: "m1", from: 3, to: 4 }]
          }
        ]
      };

      const next = applyOps(emoji, [
        { op: "text", target: "atom", path: "#a1", at: 1, insert: "🎉🎉", remove: "😀" }
      ]);

      expect(next.blocks[0].display).toBe("a🎉🎉b");
      expect(next.blocks[0].marks).toEqual([{ id: "m1", from: 5, to: 6 }]);
      expect(next.blocks[0].display.slice(5, 6)).toBe("b");
    });
  });

  /**
   * The property the whole undo story rests on: an op and its inverse compose to
   * nothing, for every op there is.
   */
  describe("round trip", () => {
    const ops: Op[] = [
      margin,
      { op: "insert", target: "row", path: "rows", after: "r4m1", values: [{ id: "r9k2", kind: "pageBreak" }] },
      {
        op: "remove",
        target: "row",
        path: "rows",
        ids: ["r4m2"],
        after: "r4m1",
        values: [{ id: "r4m2", kind: "divider" }]
      },
      { op: "move", target: "row", path: "rows", id: "r4m2", after: null, wasAfter: "r4m1" },
      typed
    ];

    for (const op of ops) {
      it(`restores the body after a ${op.op} and its inverse`, () => {
        const applied = applyOps(body(), [op]);

        expect(applied).not.toEqual(body());
        expect(applyOps(applied, [invert(op)])).toEqual(body());
      });
    }
  });
});
