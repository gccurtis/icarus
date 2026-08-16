import { describe, expect, it } from "vitest";
import { canonicalName } from "$name-manager/api/shared/canonical-name";
import { nameManagerRefusal } from "$name-manager/errors";

const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return nameManagerRefusal(error);
  }
};

describe("canonicalName", () => {
  it("resolves the three spellings the model names to one key", () => {
    const keys = ["TargetMargin", "targetmargin", "Target Margin"].map(
      (spelling) => canonicalName(spelling).nameKey
    );

    expect(keys).toEqual(["targetmargin", "targetmargin", "targetmargin"]);
  });

  it("takes whitespace out of the key rather than tidying it", () => {
    // Spacing is a spelling choice, not part of the name — which is what makes
    // `Target Margin` and `TargetMargin` the same variable.
    expect(canonicalName("  Target   Margin ").nameKey).toBe("targetmargin");
  });

  it("keeps the casing the author chose, because that is what gets displayed", () => {
    expect(canonicalName("  Target Margin ").name).toBe("Target Margin");
  });

  it("refuses a name that is only whitespace", () => {
    expect(refusalOf(() => canonicalName("   "))).toMatchObject({ code: "empty-name" });
  });
});
