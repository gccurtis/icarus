import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { styleSetValidator, textStyleValidator } from "$shared/types/style-set";

describe("textStyleValidator", () => {
  it("carries bold as a boolean beside fontWeight", () => {
    // The weight is the precise control; the boolean is what a toolbar toggles.
    // Without it, bold was the one common style a person could not set the way
    // they set italic and underline.
    expect(Object.keys(textStyleValidator.fields)).toContain("bold");
    expect(Object.keys(textStyleValidator.fields)).toContain("fontWeight");
    expect(validate(textStyleValidator, { name: "Body", bold: true, fontWeight: 700 })).toBe(true);
  });

  it("carries a background beside the colour", () => {
    expect(validate(textStyleValidator, { name: "Body", background: "highlight-subtle" })).toBe(
      true
    );
  });

  it("requires only a name, so a style can be almost entirely inherited", () => {
    expect(validate(textStyleValidator, { name: "Body" })).toBe(true);
    expect(validate(textStyleValidator, {})).toBe(false);
  });

  it("holds no vertical alignment", () => {
    // A style applies to text; vertical alignment is a property of the box the
    // text sits in, which is `BlockFormat`.
    expect(Object.keys(textStyleValidator.fields)).not.toContain("verticalAlignment");
    expect(validate(textStyleValidator, { name: "Body", verticalAlignment: "middle" })).toBe(false);
  });

  it("names its alignment the way BlockFormat does", () => {
    // One concept, one name. `align` here beside `horizontalAlignment` there
    // would read as two different things.
    expect(Object.keys(textStyleValidator.fields)).toContain("horizontalAlignment");
    expect(Object.keys(textStyleValidator.fields)).not.toContain("align");
  });

  it("refuses an alignment it does not name", () => {
    expect(validate(textStyleValidator, { name: "Body", horizontalAlignment: "middle" })).toBe(
      false
    );
    expect(validate(textStyleValidator, { name: "Body", horizontalAlignment: "justify" })).toBe(
      true
    );
  });
});

describe("styleSetValidator", () => {
  const oneStyle = { styles: { body: { name: "Body" } }, defaultKey: "body" };

  it("requires a default key", () => {
    // A resource with no default renders unstyled text differently depending on
    // which renderer is asked.
    expect(validate(styleSetValidator, oneStyle)).toBe(true);
    expect(validate(styleSetValidator, { styles: oneStyle.styles })).toBe(false);
  });

  it("keys styles separately from their display names", () => {
    // Renaming a style is then one field rather than a rewrite of every block
    // referencing it.
    expect(
      validate(styleSetValidator, {
        styles: { h1: { name: "Chapter Title" } },
        defaultKey: "h1"
      })
    ).toBe(true);
  });

  it("refuses a style entry that is not a style", () => {
    expect(validate(styleSetValidator, { styles: { body: "Body" }, defaultKey: "body" })).toBe(false);
  });
});
