import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { pageSetupValidator, paperSizeValidator } from "$shared/types/page-setup";

const a4 = {
  paper: "a4",
  orientation: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 }
};

describe("paperSizeValidator", () => {
  it("keeps a named size as its name", () => {
    // A4 resolved to 595.28 × 841.89 is indistinguishable from a custom size that
    // happens to match, and no paper picker could then show the right entry.
    expect(validate(paperSizeValidator, "a4")).toBe(true);
    expect(validate(paperSizeValidator, "letter")).toBe(true);
  });

  it("admits an explicit size alongside the names", () => {
    expect(validate(paperSizeValidator, { width: 400, height: 600 })).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses a name it does not know", () => {
      expect(validate(paperSizeValidator, "a6")).toBe(false);
      expect(validate(paperSizeValidator, "A4")).toBe(false);
    });

    it("refuses a half-stated custom size", () => {
      expect(validate(paperSizeValidator, { width: 400 })).toBe(false);
    });

    it("refuses an orientation smuggled into the size", () => {
      expect(validate(paperSizeValidator, { width: 400, height: 600, orientation: "portrait" })).toBe(
        false
      );
    });
  });
});

describe("pageSetupValidator", () => {
  it("keeps orientation separate from the sheet", () => {
    // Landscape A4 is still A4 — same sheet, same tray — so it is a field rather
    // than a swapped width and height.
    expect(validate(pageSetupValidator, { ...a4, orientation: "landscape" })).toBe(true);
    expect(Object.keys(pageSetupValidator.fields).sort()).toEqual([
      "margins",
      "orientation",
      "paper"
    ]);
  });

  it("requires all four margins", () => {
    expect(validate(pageSetupValidator, { ...a4, margins: { top: 72, right: 72, bottom: 72 } })).toBe(
      false
    );
  });

  it("holds no header, footer, or page number", () => {
    // Those are `PageFurniture` and belong to documents: a deck's handout and a
    // sheet's print setup need a paper size and margins and have no headers.
    for (const absent of ["header", "footer", "pageNumber", "furniture"]) {
      expect(Object.keys(pageSetupValidator.fields)).not.toContain(absent);
    }
    expect(validate(pageSetupValidator, { ...a4, header: [] })).toBe(false);
  });

  it("refuses a setup with no orientation", () => {
    expect(validate(pageSetupValidator, { paper: "a4", margins: a4.margins })).toBe(false);
  });
});
