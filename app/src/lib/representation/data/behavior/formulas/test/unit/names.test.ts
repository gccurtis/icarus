import { describe, expect, it } from "vitest";

import { isLegalName, isLegalWord, nameRefusal } from "$representation/data/behavior/formulas/names";

describe("what a name may be", () => {
  it("takes letters, digits and underscore, never leading with a digit", () => {
    for (const word of ["minutes", "perMinute", "cost_per_minute", "_held", "tier2", "A"]) {
      expect(isLegalWord(word)).toBe(true);
      expect(isLegalName(word)).toBe(true);
    }
  });

  it("refuses a space, a hyphen and a dot", () => {
    for (const word of ["cost per minute", "cost-tier", "rates.perMinute", "", "2fast", "a b"]) {
      expect(isLegalWord(word)).toBe(false);
      expect(isLegalName(word)).toBe(false);
    }
  });

  it("refuses a word shaped like a cell address, so it can still be said out loud", () => {
    for (const word of ["B4", "AA10", "a1"]) {
      expect(isLegalWord(word)).toBe(true);
      expect(isLegalName(word)).toBe(false);
    }
    expect(isLegalName("B4x")).toBe(true);
  });

  it("refuses a word the grammar spends, however it is cased", () => {
    for (const word of ["and", "or", "not", "TRUE", "False", "AND"]) {
      expect(isLegalName(word)).toBe(false);
    }
  });

  it("says why, so a surface can tell somebody", () => {
    expect(nameRefusal("minutes")).toBeUndefined();
    expect(nameRefusal("")).toMatch(/empty/);
    expect(nameRefusal("cost-tier")).toMatch(/letters, digits and underscore/);
    expect(nameRefusal("B4")).toMatch(/cell address/);
    expect(nameRefusal("and")).toMatch(/spends/);
  });
});
