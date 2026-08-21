import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { blockFormatValidator } from "$content/types/format";

describe("blockFormatValidator", () => {
  it("is entirely optional, so an unformatted block carries nothing", () => {
    expect(validate(blockFormatValidator, {})).toBe(true);
  });

  it("carries both axes", () => {
    // Vertical alignment means something only when a block sits in a box taller
    // than itself — the spreadsheet cell and the slide element, which are the
    // cases that made blocks worth sharing in the first place.
    expect(
      validate(blockFormatValidator, {
        horizontalAlignment: "center",
        verticalAlignment: "middle"
      })
    ).toBe(true);
  });

  it("holds valueFormat on the format rather than on the value", () => {
    // The same date then renders two ways in two places without being stored
    // twice.
    expect(Object.keys(blockFormatValidator.fields)).toContain("valueFormat");
    expect(validate(blockFormatValidator, { valueFormat: "#,##0.00" })).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses an alignment it does not name", () => {
      expect(validate(blockFormatValidator, { horizontalAlignment: "middle" })).toBe(false);
      expect(validate(blockFormatValidator, { verticalAlignment: "center" })).toBe(false);
    });

    it("names both axes symmetrically, so one concept reads one way", () => {
      // `align`/`verticalAlign` made the horizontal one the unmarked case, which
      // it is not — a cell and a slide element care about both equally.
      const fields = Object.keys(blockFormatValidator.fields);
      expect(fields).toContain("horizontalAlignment");
      expect(fields).toContain("verticalAlignment");
      expect(fields).not.toContain("align");
      expect(fields).not.toContain("verticalAlign");
    });

    it("refuses a half-stated border", () => {
      expect(validate(blockFormatValidator, { border: { color: "border-strong" } })).toBe(false);
      expect(
        validate(blockFormatValidator, { border: { color: "border-strong", width: 1, style: "solid" } })
      ).toBe(true);
    });

    it("refuses a border style it does not name", () => {
      expect(
        validate(blockFormatValidator, { border: { color: "border-strong", width: 1, style: "double" } })
      ).toBe(false);
    });

    it("refuses a field it does not have", () => {
      expect(validate(blockFormatValidator, { fontSize: 12 })).toBe(false);
    });
  });
});
