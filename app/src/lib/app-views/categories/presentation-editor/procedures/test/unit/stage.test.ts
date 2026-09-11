import { describe, expect, it } from "vitest";
import {
  asAspectRatio,
  clampZoom,
  cssRatio,
  drawn,
  fitted,
  ratioOf,
  ratioParts,
  scaleOf,
  slideUnits,
  toFrame,
  toPixels
} from "$app-views/categories/presentation-editor/procedures/stage";

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

describe("a slide is a ratio, not a size", () => {
  it("is the same height in its own units whichever shape it is", () => {
    expect(slideUnits("16:9", STAGE).height).toBe(STAGE.unitsHigh);
    expect(slideUnits("4:3", STAGE).height).toBe(STAGE.unitsHigh);
  });

  it("is wider for a wider ratio", () => {
    expect(slideUnits("16:9", STAGE).width).toBe(1280);
    expect(slideUnits("4:3", STAGE).width).toBe(960);
    expect(ratioOf("16:9")).toBeCloseTo(16 / 9);
    expect(cssRatio("4:3")).toBe("4 / 3");
  });

  it("is any two whole numbers, and falls back when it is not", () => {
    expect(ratioParts("21:9")).toEqual({ width: 21, height: 9 });
    expect(asAspectRatio(3.6, 0)).toBe("4:1");
    expect(ratioParts("wide:0" as never)).toEqual({ width: 16, height: 9 });
    expect(slideUnits("1:1", STAGE).width).toBe(720);
  });
});

describe("100% is fit", () => {
  it("fits the width when the surface is wide and short", () => {
    const fit = fitted({ width: 1000, height: 1000 }, "16:9", 20);
    expect(fit.width).toBe(960);
    expect(fit.height).toBeCloseTo(540);
  });

  it("fits the height when the surface is tall and narrow", () => {
    const fit = fitted({ width: 1000, height: 400 }, "16:9", 20);
    expect(fit.height).toBe(360);
    expect(fit.width).toBeCloseTo(640);
  });

  it("draws at a multiple of the fit", () => {
    const fit = { width: 960, height: 540 };
    expect(drawn(fit, null)).toEqual(fit);
    expect(drawn(fit, 150)).toEqual({ width: 1440, height: 810 });
  });

  it("clamps a zoom to the configured bounds", () => {
    expect(clampZoom(10, STAGE)).toBe(50);
    expect(clampZoom(900, STAGE)).toBe(200);
    expect(clampZoom(120.4, STAGE)).toBe(120);
  });

  it("scales units to pixels by the drawn width", () => {
    expect(scaleOf(640, 1280)).toBe(0.5);
  });
});

describe("frames and pixels are one conversion, both ways", () => {
  const units = { width: 1280, height: 720 };

  it("round-trips", () => {
    const frame = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 };
    expect(toFrame(toPixels(frame, units), units)).toEqual(frame);
  });

  it("places a frame in units", () => {
    expect(toPixels({ x: 0.5, y: 0.5, width: 0.25, height: 0.5 }, units)).toEqual({
      x: 640,
      y: 360,
      width: 320,
      height: 360
    });
  });
});
