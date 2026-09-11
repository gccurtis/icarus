import { describe, expect, it } from "vitest";
import { anchored, anchorLabel, lockedAt, referenceAt } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";

describe("reference locks", () => {
  it.each([5, 7, 9, 11])("locks both endpoints from caret %i within a range", (caret) => {
    const text = "=SUM(B2:D12)+E4";
    const ref = referenceAt(text, caret)!;
    expect(anchorLabel(ref, false, false)).toBe("B2:D12");
    expect(anchorLabel(ref, true, true)).toBe("$B$2:$D$12");
    expect(anchorLabel(ref, false, true)).toBe("B$2:D$12");
    expect(anchorLabel(ref, true, false)).toBe("$B2:$D12");
    expect(lockedAt(text, caret, true, true)?.text).toBe("=SUM($B$2:$D$12)+E4");
  });

  it("cycles all four modes over the whole range with F4", () => {
    let value = { text: "=B2:D4", caret: 6 };
    for (const expected of ["=$B$2:$D$4", "=B$2:D$4", "=$B2:$D4", "=B2:D4"]) {
      value = anchored(value.text, value.caret)!;
      expect(value.text).toBe(expected);
      expect(value.caret).toBe(expected.length);
    }
  });

  it("preserves qualifiers, spacing and unrelated references", () => {
    const text = "=SUM('Other Sheet'!B2 : D4)+C9";
    expect(lockedAt(text, text.indexOf("D4") + 2, false, true)?.text)
      .toBe("=SUM('Other Sheet'!B$2 : D$4)+C9");
    expect(lockedAt(text, text.length, true, false)?.text)
      .toBe("=SUM('Other Sheet'!B2 : D4)+$C9");
  });

  it("does not pretend a mixed range has a uniform lock", () => {
    const held = referenceAt("=$B2:D$4", 7)!;
    expect(held.column).toBeUndefined();
    expect(held.row).toBeUndefined();
  });

  it("does not lock words inside literals or a function name", () => {
    expect(referenceAt('="B2:D4"', 5)).toBeUndefined();
    expect(referenceAt("=LOG10(B2)", 5)).toBeUndefined();
    expect(referenceAt("='B2'!C4", 3)).toBeUndefined();
  });
});
