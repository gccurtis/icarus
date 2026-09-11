import { describe, expect, it } from "vitest";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import { INSERT_GROUPS, frameFor, makeElement } from "$app-views/categories/presentation-editor/procedures/inserting";
import { withInsertedElements } from "$app-views/categories/presentation-editor/procedures/presentation-elements";

const body = (): PresentationBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 } } },
  layouts: [],
  sections: [],
  slides: [{ id: "s1", notes: [], elements: [] }]
});

const kinds = INSERT_GROUPS.flatMap((group) => group.entries);

describe("the catalogue", () => {
  it("offers every kind exactly once", () => {
    const seen = kinds.map((entry) => entry.kind);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain("text");
    expect(seen).toContain("rectangle");
    expect(seen).toContain("line");
    expect(seen).toContain("table");
  });

  it("refuses the chart, and says why on the row", () => {
    const chart = kinds.find((entry) => entry.kind === "chart");
    expect(chart?.ready).toBe(false);
    expect(chart?.note.length).toBeGreaterThan(0);
  });

  it("nests only the group too long to read as a list", () => {
    expect(INSERT_GROUPS.filter((group) => group.nested).map((group) => group.title)).toEqual(["Shapes"]);
  });
});

describe("where a fresh object lands", () => {
  it("centres on the point it was asked for", () => {
    const frame = frameFor("rectangle", { x: 0.5, y: 0.6 });
    expect(frame.x + frame.width / 2).toBeCloseTo(0.5);
    expect(frame.y + frame.height / 2).toBeCloseTo(0.6);
  });

  it("centres on the slide when nothing was pointed at", () => {
    const frame = frameFor("table");
    expect(frame.x + frame.width / 2).toBeCloseTo(0.5);
    expect(frame.y + frame.height / 2).toBeCloseTo(0.5);
  });

  it("never hangs off an edge", () => {
    for (const corner of [{ x: 0, y: 0 }, { x: 1, y: 1 }]) {
      const frame = frameFor("table", corner);
      expect(frame.x).toBeGreaterThanOrEqual(0.02);
      expect(frame.y).toBeGreaterThanOrEqual(0.02);
      expect(frame.x + frame.width).toBeLessThanOrEqual(0.98);
      expect(frame.y + frame.height).toBeLessThanOrEqual(0.98);
    }
  });
});

describe("what a fresh object is", () => {
  it("makes each shape kind as that shape", () => {
    for (const kind of ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"] as const) {
      const element = makeElement(kind, body(), frameFor(kind));
      expect(element.content.type).toBe("shape");
      if (element.content.type !== "shape") throw new Error("not a shape");
      expect(element.content.shape).toBe(kind);
      expect(element.content.block?.style).toBe("body");
      expect(element.content.block?.display).toBe("");
      expect(element.paint?.fill).toBe("--token-color-accent-1-fill");
    }
  });

  it("gives a text box the presentation's default style and a height that follows its text", () => {
    const element = makeElement("text", body(), frameFor("text"));
    if (element.content.type !== "text") throw new Error("not text");
    expect(element.content.block.style).toBe("body");
    expect(element.overflow).toBe("grow");
  });

  it("runs a line corner to corner of its frame, arrow last", () => {
    const frame = frameFor("line", { x: 0.5, y: 0.5 });
    const element = makeElement("line", body(), frame);
    if (element.content.type !== "line") throw new Error("not a line");
    expect(element.content.from).toEqual({ x: frame.x, y: frame.y + frame.height });
    expect(element.content.to).toEqual({ x: frame.x + frame.width, y: frame.y });
    expect(element.content.ends?.end).toBe("arrow");
  });

  it("makes a table three by three with one header row", () => {
    const element = makeElement("table", body(), frameFor("table"));
    if (element.content.type !== "table") throw new Error("not a table");
    expect(element.content.block.rows).toHaveLength(3);
    expect(element.content.block.rows[0].cells).toHaveLength(3);
    expect(element.content.block.headerRows).toBe(1);
  });

  it("makes a picture with no source and an empty description", () => {
    const element = makeElement("image", body(), frameFor("image"));
    if (element.content.type !== "image") throw new Error("not an image");
    expect(element.content.block.source).toBeUndefined();
    expect(element.content.block.alt).toBe("");
  });

  it("mints an id nothing else on the slide holds", () => {
    const presentation = body();
    const one = makeElement("rectangle", presentation, frameFor("rectangle"));
    const two = makeElement("rectangle", presentation, frameFor("rectangle"));
    expect(one.id).not.toBe(two.id);

    const edit = withInsertedElements(presentation, "s1", [one, two]);
    expect(edit.body.slides[0].elements.map((element) => element.id)).toEqual([one.id, two.id]);
  });
});
