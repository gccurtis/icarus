import { describe, expect, it } from "vitest";

import {
  documentLineHeightPx,
  normalizeDocumentStyleSet,
  normalizeDocumentTextStyle
} from "$representation/data/behavior/documents/typography";

describe("document typography units", () => {
  it("converts legacy unitless leading using that style's font size", () => {
    expect(documentLineHeightPx(11, 1.5)).toBe(16.5);
    expect(normalizeDocumentTextStyle({ name: "Body", fontSize: 10.5, lineHeight: 1.45 }))
      .toEqual({ name: "Body", fontSize: 10.5, lineHeight: 15.23 });
  });

  it("leaves pixel leading and absent leading untouched", () => {
    const pixels = { name: "Body", fontSize: 16, lineHeight: 26 };
    expect(normalizeDocumentTextStyle(pixels)).toBe(pixels);
    expect(documentLineHeightPx(16, undefined)).toBeUndefined();
  });

  it("normalizes only affected styles while preserving the style-set contract", () => {
    const set = normalizeDocumentStyleSet({
      defaultKey: "body",
      styles: {
        body: { name: "Body", fontSize: 11, lineHeight: 1.5 },
        heading: { name: "Heading", fontSize: 22, lineHeight: 28 }
      }
    });

    expect(set.styles.body.lineHeight).toBe(16.5);
    expect(set.styles.heading.lineHeight).toBe(28);
    expect(set.defaultKey).toBe("body");
  });
});
