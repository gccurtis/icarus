import { describe, expect, it } from "vitest";

import type { Mark, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";

const bold = (id: string, atom: string, from: number, to: number): Mark => ({
  id,
  from: { atom, offset: from },
  to: { atom, offset: to },
  style: ["bold"]
});

const block = (id: string, text: string, marks: Mark[] = []): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-a`, kind: "literal", text }],
  display: text,
  marks
});

const body = (): DocumentBody => ({
  rows: [
    { id: "r1", kind: "blocks", blocks: [block("b1", "Peak demand is forecast", [bold("m1", "b1-a", 5, 11)])] },
    { id: "r2", kind: "blocks", blocks: [block("b2", "Substation 14")] }
  ]
});

const textOf = (held: DocumentBody, blockId: string): TextBlock => {
  for (const row of held.rows) {
    if (row.kind !== "blocks") continue;
    const found = row.blocks.find((candidate) => candidate.id === blockId);
    if (found?.type === "text") return found;
  }
  throw new Error(`no text block ${blockId}`);
};

const roundTrips = (start: DocumentBody, ops: DocumentOp[]) => {
  const after = applyOps(start, ops);
  expect(applyOps(after, invertAll(ops))).toEqual(start);
  return after;
};

describe("text splices", () => {
  it("splices the atom and rebuilds display", () => {
    const after = applyOps(body(), [
      { op: "text", target: "atom", path: "b2/atoms/b2-a", at: 13, insert: " is", remove: "" }
    ]);
    expect(textOf(after, "b2").display).toBe("Substation 14 is");
  });

  it("shifts a mark after the splice and leaves one before it alone", () => {
    const after = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 0, insert: "The ", remove: "" }
    ]);
    expect(textOf(after, "b1").marks[0]).toEqual(bold("m1", "b1-a", 9, 15));

    const later = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 20, insert: "ed", remove: "" }
    ]);
    expect(textOf(later, "b1").marks[0]).toEqual(bold("m1", "b1-a", 5, 11));
  });

  it("grows a mark typed inside and does not grow one typed at its edge", () => {
    const inside = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 7, insert: "xx", remove: "" }
    ]);
    expect(textOf(inside, "b1").marks[0]).toEqual(bold("m1", "b1-a", 5, 13));

    const atEnd = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 11, insert: "x", remove: "" }
    ]);
    expect(textOf(atEnd, "b1").marks[0]).toEqual(bold("m1", "b1-a", 5, 11));

    const atStart = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 5, insert: "x", remove: "" }
    ]);
    expect(textOf(atStart, "b1").marks[0]).toEqual(bold("m1", "b1-a", 6, 12));
  });

  it("truncates a mark the splice cuts into and drops one it swallows", () => {
    const cut = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 8, insert: "", remove: "and is" }
    ]);
    expect(textOf(cut, "b1").marks[0]).toEqual(bold("m1", "b1-a", 5, 8));

    const swallowed = applyOps(body(), [
      { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 4, insert: "", remove: " demand is" }
    ]);
    expect(textOf(swallowed, "b1").marks).toEqual([]);
  });

  it("refuses a splice authored against moved text", () => {
    expect(() =>
      applyOps(body(), [
        { op: "text", target: "atom", path: "b1/atoms/b1-a", at: 0, insert: "", remove: "Nope" }
      ])
    ).toThrow(/authored against text that has moved/);
  });
});

describe("marks", () => {
  it("inserts, sets and removes a mark by id, and inverts", () => {
    const start = body();
    const mark = bold("m2", "b2-a", 0, 10);

    const inserted = roundTrips(start, [
      { op: "insert", target: "mark", path: "b2/marks", ids: ["m2"], after: null, values: [mark] }
    ]);
    expect(textOf(inserted, "b2").marks).toEqual([mark]);

    const styled = roundTrips(inserted, [
      { op: "set", target: "mark", path: "m2/style", value: ["bold", "italic"], was: ["bold"] }
    ]);
    expect(textOf(styled, "b2").marks[0].style).toEqual(["bold", "italic"]);

    const moved = roundTrips(styled, [
      { op: "set", target: "mark", path: "m2/to", value: { atom: "b2-a", offset: 13 }, was: mark.to }
    ]);
    expect(textOf(moved, "b2").marks[0].to).toEqual({ atom: "b2-a", offset: 13 });

    const removed = roundTrips(moved, [
      { op: "remove", target: "mark", path: "b2/marks", ids: ["m2"], after: null, values: [textOf(moved, "b2").marks[0]] }
    ]);
    expect(textOf(removed, "b2").marks).toEqual([]);
  });

  it("clears a field set to null", () => {
    const start = body();
    const after = applyOps(start, [
      { op: "set", target: "mark", path: "m1/style", value: null, was: ["bold"] }
    ]);
    expect(textOf(after, "b1").marks[0]).toEqual({ id: "m1", from: { atom: "b1-a", offset: 5 }, to: { atom: "b1-a", offset: 11 } });
  });
});

describe("blocks", () => {
  it("sets a block's variant, level, style and format, and inverts", () => {
    const start = body();
    const after = roundTrips(start, [
      { op: "set", target: "block", path: "b2/variant", value: "heading", was: "paragraph" },
      { op: "set", target: "block", path: "b2/level", value: 2, was: null },
      { op: "set", target: "block", path: "b2/style", value: "heading-2", was: null },
      { op: "set", target: "block", path: "b2/format", value: { horizontalAlignment: "center" }, was: null }
    ]);
    const held = textOf(after, "b2");
    expect(held.variant).toBe("heading");
    expect(held.level).toBe(2);
    expect(held.style).toBe("heading-2");
    expect(held.format).toEqual({ horizontalAlignment: "center" });
  });

  it("inserts and removes an atom, rebuilding display and dropping marks on it", () => {
    const start = body();
    const formula = {
      id: "f1",
      kind: "formula" as const,
      expression: "forecast.delta",
      lastResolvedValue: { kind: "text" as const, value: "four percent" },
      lastResolvedDisplay: "four percent",
      state: "fresh" as const
    };
    const inserted = roundTrips(start, [
      { op: "insert", target: "atom", path: "b2/atoms", ids: ["f1"], after: "b2-a", values: [formula] }
    ]);
    expect(textOf(inserted, "b2").display).toBe("Substation 14four percent");
  });
});

describe("rows", () => {
  it("inserts, moves and removes rows in the body and in furniture", () => {
    const start: DocumentBody = {
      ...body(),
      header: { rows: [{ id: "h1", kind: "blocks", blocks: [block("hb1", "Header")] }], distanceFromEdge: 0.5 }
    };
    const row = { id: "r3", kind: "blocks" as const, blocks: [block("b3", "New")] };

    const inserted = roundTrips(start, [
      { op: "insert", target: "row", path: "rows", ids: ["r3"], after: "r1", values: [row] }
    ]);
    expect(inserted.rows.map((held) => held.id)).toEqual(["r1", "r3", "r2"]);

    const moved = roundTrips(inserted, [
      { op: "move", target: "row", path: "rows", id: "r3", after: null, wasAfter: "r1" }
    ]);
    expect(moved.rows.map((held) => held.id)).toEqual(["r3", "r1", "r2"]);

    const furnished = roundTrips(start, [
      { op: "insert", target: "row", path: "header/rows", ids: ["h2"], after: "h1", values: [{ id: "h2", kind: "divider" }] }
    ]);
    expect(furnished.header?.rows.map((held) => held.id)).toEqual(["h1", "h2"]);
  });

  it("refuses furniture rows on a document with no furniture", () => {
    expect(() =>
      applyOps(body(), [
        { op: "insert", target: "row", path: "footer/rows", ids: ["f1"], after: null, values: [{ id: "f1", kind: "divider" }] }
      ])
    ).toThrow(/has no footer/);
  });
});

describe("the document", () => {
  it("sets page setup whole and by field, and inverts", () => {
    const start = body();
    const setup = { paper: "a4", orientation: "portrait", margins: { top: 1, right: 1, bottom: 1, left: 1 } };

    const whole = roundTrips(start, [
      { op: "set", target: "document", path: "pageSetup", value: setup, was: null }
    ]);
    expect(whole.pageSetup).toEqual(setup);

    const field = roundTrips(whole, [
      { op: "set", target: "document", path: "pageSetup/margins/top", value: 0.75, was: 1 }
    ]);
    expect(field.pageSetup?.margins.top).toBe(0.75);
  });

  it("creates furniture, sets a field on it, and removes it", () => {
    const start = body();
    const header = { rows: [], distanceFromEdge: 0.5 };

    const made = roundTrips(start, [
      { op: "set", target: "document", path: "header", value: header, was: null }
    ]);
    expect(made.header).toEqual(header);

    const numbered = roundTrips(made, [
      { op: "set", target: "document", path: "header/pageNumber", value: { position: "end" }, was: null }
    ]);
    expect(numbered.header?.pageNumber).toEqual({ position: "end" });
  });

  it("inserts, edits and removes named styles", () => {
    const start = body();
    const bodyStyle = { name: "Body", fontSize: 15, lineHeight: 26 };

    const made = roundTrips(start, [
      { op: "insert", target: "document", path: "styles", ids: ["body"], after: null, values: [bodyStyle] }
    ]);
    expect(made.styles).toEqual({ styles: { body: bodyStyle }, defaultKey: "body" });

    const edited = roundTrips(made, [
      { op: "set", target: "document", path: "styles/body/fontSize", value: 16, was: 15 }
    ]);
    expect(edited.styles?.styles.body.fontSize).toBe(16);

    const keyed = roundTrips(edited, [
      { op: "set", target: "document", path: "styles/defaultKey", value: "caption", was: "body" }
    ]);
    expect(keyed.styles?.defaultKey).toBe("caption");
  });
});
