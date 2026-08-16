import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { styleSetValidator } from "$shared/types/style-set";

const styles = {
  styles: { heading1: { name: "Heading 1", fontSize: 18 }, body: { name: "Body" } },
  defaultKey: "body"
};

describe("styleSetValidator", () => {
  it("requires a default, so unstyled text always has an answer", () => {
    expect(validate(styleSetValidator, styles)).toBe(true);
    const { defaultKey: _defaultKey, ...withoutDefault } = styles;
    expect(validate(styleSetValidator, withoutDefault)).toBe(false);
  });

  it("keys styles separately from their display names, so renaming one is one edit", () => {
    expect(styleSetValidator.fields.styles.kind).toBe("record");
    expect(validate(styleSetValidator, { ...styles, styles: { body: { fontSize: 11 } } })).toBe(
      false
    );
  });

  it("measures type in points and line height as a multiplier", () => {
    expect(
      validate(styleSetValidator, {
        styles: { body: { name: "Body", fontSize: 11, lineHeight: 1.4, spaceAfter: 6, indent: 0 } },
        defaultKey: "body"
      })
    ).toBe(true);
    expect(
      validate(styleSetValidator, { styles: { body: { name: "Body", fontSize: "11pt" } }, defaultKey: "body" })
    ).toBe(false);
  });
});
