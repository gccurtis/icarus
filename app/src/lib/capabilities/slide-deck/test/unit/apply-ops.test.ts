import { describe, expect, it } from "vitest";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { applyOps } from "$capabilities/slide-deck/api/submit-slide-deck-changes/apply-ops";

const frame = (x: number) => ({ x, y: 0.1, width: 0.4, height: 0.2 });

const body = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: {} },
  layouts: [],
  sections: [],
  slides: [
    { id: "s1", notes: [], elements: [{ id: "e1", frame: frame(0.1), overflow: "clip", blocks: [] }] },
    { id: "s2", notes: [], elements: [{ id: "e2", frame: frame(0.2), overflow: "clip", blocks: [] }] }
  ]
});

const set = (id: string, x: number): SlideDeckOp => ({
  op: "set",
  target: "element",
  path: `${id}/frame`,
  value: frame(x),
  was: frame(0)
});

describe("applyOps", () => {
  it("moves an element by its own id, whichever slide holds it", () => {
    const next = applyOps(body(), [set("e2", 0.9)]);

    expect(next.slides[1].elements[0].frame.x).toBe(0.9);
    expect(next.slides[0].elements[0].frame.x).toBe(0.1);
  });

  it("leaves the slide it did not touch alone", () => {
    const before = body();
    const next = applyOps(before, [set("e1", 0.5)]);

    expect(next.slides[1]).toBe(before.slides[1]);
  });

  it("applies a run of ops in order", () => {
    const next = applyOps(body(), [set("e1", 0.3), set("e1", 0.7)]);

    expect(next.slides[0].elements[0].frame.x).toBe(0.7);
  });

  it("refuses an element it cannot find", () => {
    expect(() => applyOps(body(), [set("nope", 0.5)])).toThrow(/No element nope/);
  });

  it("refuses a field it does not know", () => {
    const op = { ...set("e1", 0.5), path: "e1/rotation" } as SlideDeckOp;

    expect(() => applyOps(body(), [op])).toThrow(/cannot apply set on element/);
  });

  it("refuses an op kind it cannot apply", () => {
    const op = { op: "move", target: "slide", path: "slides", id: "s1", after: null, wasAfter: null } as SlideDeckOp;

    expect(() => applyOps(body(), [op])).toThrow(/cannot apply move on slide/);
  });
});
