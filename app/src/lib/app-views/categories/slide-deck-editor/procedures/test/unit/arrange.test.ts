import { describe, expect, it } from "vitest";
import { aligned, bounds, distributed, matched, restacked } from "$app-views/categories/slide-deck-editor/procedures/arrange";
import { snapped, targetsOf } from "$app-views/categories/slide-deck-editor/procedures/snapping";
import { diffed, replaced, stylesAt, toggledMark } from "$app-views/categories/slide-deck-editor/procedures/typing";
import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const items = [
  { id: "a", frame: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } },
  { id: "b", frame: { x: 0.4, y: 0.3, width: 0.1, height: 0.3 } },
  { id: "c", frame: { x: 0.8, y: 0.2, width: 0.1, height: 0.2 } }
];

describe("align and distribute are geometry", () => {
  it("finds the bounds of a selection", () => {
    expect(bounds(items.map((item) => item.frame))).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.5 });
  });

  it("aligns to an edge of the selection and reports only what moved", () => {
    const to = bounds(items.map((item) => item.frame));
    const left = aligned(items, "left", to);
    expect(left.map((item) => item.id)).toEqual(["b", "c"]);
    expect(left.every((item) => item.frame.x === 0.1)).toBe(true);

    const middle = aligned(items, "middle", to);
    expect(middle.find((item) => item.id === "a")?.frame.y).toBeCloseTo(0.3);
  });

  it("distributes with equal gaps between three or more", () => {
    const spread = distributed(items, "x");
    const b = spread.find((item) => item.id === "b");
    expect(b?.frame.x).toBeCloseTo(0.475);
    expect(distributed(items.slice(0, 2), "x")).toEqual([]);
  });

  it.each(["x", "y"] as const)("is idempotent for overlapping mixed-size objects on %s", (axis) => {
    const overlapping = [
      { id: "large", frame: { x: 0.1, y: 0.12, width: 0.5, height: 0.5 } },
      { id: "small", frame: { x: 0.22, y: 0.2, width: 0.08, height: 0.08 } },
      { id: "medium", frame: { x: 0.3, y: 0.28, width: 0.24, height: 0.18 } }
    ];
    const first = distributed(overlapping, axis);
    const applied = overlapping.map((item) => first.find((move) => move.id === item.id) ?? item);

    expect(first.length).toBeGreaterThan(0);
    expect(distributed(applied, axis)).toEqual([]);
  });

  it("matches size to the first", () => {
    const same = matched(items, "size");
    expect(same.every((item) => item.frame.width === 0.2 && item.frame.height === 0.1)).toBe(true);
  });
});

describe("restacking several keeps their order", () => {
  const order = ["a", "b", "c", "d", "e"];

  it("to the front and back as a block", () => {
    expect(restacked(order, ["d", "b"], "front")).toEqual(["a", "c", "e", "b", "d"]);
    expect(restacked(order, ["d", "b"], "back")).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("one step at a time, without leapfrogging each other", () => {
    expect(restacked(order, ["b", "c"], "forward")).toEqual(["a", "d", "b", "c", "e"]);
    expect(restacked(order, ["d", "e"], "forward")).toEqual(order);
    expect(restacked(order, ["b", "c"], "behind")).toEqual(["b", "c", "a", "d", "e"]);
  });
});

describe("snapping", () => {
  it("snaps an edge to a sibling's edge within the threshold and names it", () => {
    const targets = targetsOf([{ x: 0.3, y: 0.5, width: 0.2, height: 0.2 }]);
    const result = snapped({ x: 0.292, y: 0.9, width: 0.1, height: 0.05 }, targets, 0.01);
    expect(result.frame.x).toBeCloseTo(0.3);
    expect(result.guides.find((guide) => guide.axis === "x")?.label).toBe("left edge");
  });

  it("leaves a frame alone outside the threshold", () => {
    const targets = targetsOf([]);
    const result = snapped({ x: 0.3, y: 0.3, width: 0.1, height: 0.1 }, targets, 0.005);
    expect(result.frame.x).toBe(0.3);
    expect(result.guides).toEqual([]);
  });
});

const body = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: {} },
  layouts: [],
  sections: [],
  slides: [
    {
      id: "s1",
      notes: [],
      elements: [
        {
          id: "e1",
          frame: { x: 0, y: 0, width: 1, height: 1 },
          content: {
            type: "text",
            block: {
              id: "b1",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "a1", kind: "literal", text: "Hello world" }],
              display: "Hello world",
              marks: [
                {
                  id: "m1",
                  from: { atom: "a1", offset: 0 },
                  to: { atom: "a1", offset: 5 },
                  style: ["bold"]
                }
              ]
            }
          }
        }
      ]
    }
  ]
});

const blockOf = (deck: SlideDeckBody) => {
  const content = deck.slides[0].elements[0].content;
  if (content.type !== "text") throw new Error("not text");
  return content.block;
};

describe("typing becomes ops", () => {
  it("inserts at a caret", () => {
    const ops = replaced(blockOf(body()), 5, 5, ",");
    expect(blockOf(applyOps(body(), ops)).display).toBe("Hello, world");
  });

  it("replaces a range", () => {
    const ops = replaced(blockOf(body()), 6, 11, "there");
    expect(blockOf(applyOps(body(), ops)).display).toBe("Hello there");
  });

  it("keeps a newline inside one block", () => {
    const ops = replaced(blockOf(body()), 5, 6, "\n");
    expect(blockOf(applyOps(body(), ops)).display).toBe("Hello\nworld");
  });

  it("turns a whole new text into the smallest edit", () => {
    const ops = diffed(blockOf(body()), "Hello there world");
    expect(ops).toHaveLength(1);
    expect(blockOf(applyOps(body(), ops)).display).toBe("Hello there world");
    expect(diffed(blockOf(body()), "Hello world")).toEqual([]);
  });

  it("reads the styles at a caret and over a range", () => {
    expect(stylesAt(blockOf(body()), 3, 3)).toEqual(["bold"]);
    expect(stylesAt(blockOf(body()), 0, 5)).toEqual(["bold"]);
    expect(stylesAt(blockOf(body()), 0, 7)).toEqual([]);
  });

  it("toggles a mark on and off", () => {
    const on = applyOps(body(), toggledMark(blockOf(body()), 6, 11, "italic"));
    expect(stylesAt(blockOf(on), 6, 11)).toEqual(["italic"]);
    const off = applyOps(on, toggledMark(blockOf(on), 6, 11, "italic"));
    expect(stylesAt(blockOf(off), 6, 11)).toEqual([]);
  });

  it("removing a style from part of a mark keeps the rest", () => {
    const next = applyOps(body(), toggledMark(blockOf(body()), 2, 5, "bold"));
    expect(stylesAt(blockOf(next), 0, 2)).toEqual(["bold"]);
    expect(stylesAt(blockOf(next), 2, 5)).toEqual([]);
  });
});
