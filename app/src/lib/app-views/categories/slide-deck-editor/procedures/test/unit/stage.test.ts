import { describe, expect, it } from "vitest";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import {
  charactersPerLine,
  clampZoom,
  cssRatio,
  fitZoom,
  gutterOf,
  ratioOf,
  slideUnits,
  stageMetrics,
  toFrame,
  toPixels
} from "$app-views/categories/slide-deck-editor/procedures/stage";

const STAGE = {
  unitsHigh: 720,
  widthRem: 52,
  averageGlyphWidthEm: 0.52,
  minimumZoom: 50,
  maximumZoom: 200,
  zoomStep: 5,
  minimumGutterRem: 0.75,
  maximumGutterRem: 2.5
};

const deck = (over: Partial<SlideDeckBody> = {}): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 } } },
  layouts: [],
  sections: [],
  slides: [],
  ...over
});

describe("a slide is a ratio, not a size", () => {
  it("is the same height in its own units whichever shape it is", () => {
    expect(slideUnits("16:9", STAGE).height).toBe(STAGE.unitsHigh);
    expect(slideUnits("4:3", STAGE).height).toBe(STAGE.unitsHigh);
  });

  it("takes its width from the ratio alone", () => {
    expect(slideUnits("16:9", STAGE).width).toBe(STAGE.unitsHigh * (16 / 9));
    expect(slideUnits("4:3", STAGE).width).toBe(STAGE.unitsHigh * (4 / 3));
    expect(ratioOf("16:9")).toBeGreaterThan(ratioOf("4:3"));
  });

  it("renders the ratio as CSS", () => {
    expect(cssRatio("16:9")).toBe("16 / 9");
  });
});

describe("stageMetrics", () => {
  it("keeps one drawn width and takes height from the ratio", () => {
    const wide = stageMetrics(deck(), 100, STAGE);
    const narrow = stageMetrics(deck({ aspectRatio: "4:3" }), 100, STAGE);

    expect(wide.slideWidth).toBe(narrow.slideWidth);
    expect(narrow.slideHeight).toBeGreaterThan(wide.slideHeight);
    expect(wide.slideHeight).toBeCloseTo(52 / (16 / 9), 10);
  });

  it("says nothing about the slide in inches", () => {
    expect(Object.keys(stageMetrics(deck(), 100, STAGE))).not.toContain("slide");
  });

  it("draws at the zoom it is given", () => {
    const at100 = stageMetrics(deck(), 100, STAGE);
    const at150 = stageMetrics(deck(), 150, STAGE);

    expect(at150.drawn.width).toBeCloseTo(at100.drawn.width * 1.5, 5);
    expect(at150.drawn.height).toBeCloseTo(at100.drawn.height * 1.5, 5);
  });

  it("takes the character estimate from the default style", () => {
    const small = stageMetrics(deck(), 100, STAGE);
    const large = stageMetrics(
      deck({ styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 40 } } } }),
      100,
      STAGE
    );

    expect(large.charactersPerLine).toBeLessThan(small.charactersPerLine);
  });

  it("reads a deck it has not been given as the default shape", () => {
    expect(stageMetrics(undefined, 100, STAGE).ratio).toBe("16:9");
  });
});

describe("charactersPerLine", () => {
  it("narrows as the element does", () => {
    expect(charactersPerLine(640, 20, STAGE)).toBeLessThan(charactersPerLine(1280, 20, STAGE));
  });

  it("never answers less than one character", () => {
    expect(charactersPerLine(1, 200, STAGE)).toBe(1);
  });
});

describe("fitting the surface", () => {
  it("fills the surface it is given, less the gutters", () => {
    const wide = fitZoom(60, STAGE);
    const narrow = fitZoom(40, STAGE);

    expect(wide).toBeGreaterThan(narrow);
    expect(fitZoom(52 + STAGE.minimumGutterRem * 2, STAGE)).toBe(100);
  });

  it("never proposes a zoom outside the range", () => {
    expect(fitZoom(4, STAGE)).toBe(50);
    expect(fitZoom(4000, STAGE)).toBe(200);
  });

  it("gives the gutter away before the slide", () => {
    expect(gutterOf(55, 52, STAGE)).toBe(1.5);
    expect(gutterOf(53, 52, STAGE)).toBe(STAGE.minimumGutterRem);
    expect(gutterOf(200, 52, STAGE)).toBe(STAGE.maximumGutterRem);
  });
});

describe("clampZoom", () => {
  it("holds the range and rounds", () => {
    expect(clampZoom(10, STAGE)).toBe(50);
    expect(clampZoom(1000, STAGE)).toBe(200);
    expect(clampZoom(99.4, STAGE)).toBe(99);
  });
});

describe("frames are fractions", () => {
  it("survives a round trip through pixels", () => {
    const stage = { width: 1280, height: 720 };
    const frame = { x: 0.08, y: 0.1, width: 0.84, height: 0.18 };
    const back = toFrame(toPixels(frame, stage), stage);

    expect(back.x).toBeCloseTo(frame.x, 10);
    expect(back.y).toBeCloseTo(frame.y, 10);
    expect(back.width).toBeCloseTo(frame.width, 10);
    expect(back.height).toBeCloseTo(frame.height, 10);
  });

  it("places the same fraction differently on differently sized stages", () => {
    const frame = { x: 0.5, y: 0, width: 0.25, height: 1 };

    expect(toPixels(frame, { width: 1280, height: 720 }).x).toBe(640);
    expect(toPixels(frame, { width: 960, height: 720 }).x).toBe(480);
  });
});
