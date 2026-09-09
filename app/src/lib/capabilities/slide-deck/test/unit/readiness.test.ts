import { describe, expect, it } from "vitest";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/readiness";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const body = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  slides: [],
  sections: []
});

describe("ensureSlideDeckReady", () => {
  it("gives an empty current deck one editable canvas", () => {
    const ready = ensureSlideDeckReady(body());

    expect(ready.slides).toHaveLength(1);
    expect(ready.slides[0]).toMatchObject({ elements: [], notes: [] });
    expect(ready.slides[0].id).toBe("slide-1");
  });

  it("gives current shapes editable text blocks, including nested and layout shapes", () => {
    const shape = (id: string) => ({
      id,
      frame: { x: 0, y: 0, width: 1, height: 1 },
      content: { type: "shape" as const, shape: "rectangle" as const }
    });
    const source: SlideDeckBody = {
      ...body(),
      layouts: [{ id: "layout", key: "blank", name: "Blank", locked: [shape("locked")], placeholders: [] }],
      slides: [{
        id: "slide",
        notes: [],
        elements: [{
          id: "group",
          frame: { x: 0, y: 0, width: 1, height: 1 },
          content: { type: "group", children: [shape("nested")] }
        }]
      }]
    };

    const ready = ensureSlideDeckReady(source);
    const locked = ready.layouts[0].locked[0].content;
    const group = ready.slides[0].elements[0].content;
    if (locked.type !== "shape" || group.type !== "group") throw new Error("expected current shapes");
    const nested = group.children[0].content;
    if (nested.type !== "shape") throw new Error("expected a nested shape");

    expect(locked.block?.id).toBe("locked-text");
    expect(nested.block?.id).toBe("nested-text");
    expect(ensureSlideDeckReady(ready)).toEqual(ready);
  });
});
