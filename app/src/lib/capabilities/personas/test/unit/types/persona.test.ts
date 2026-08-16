import { describe, expect, it } from "vitest";
import { personasRefusal } from "$personas/errors";
import { personaName, personaTools } from "$personas/types/persona";

describe("personaName", () => {
  it("trims, because a name is what every mention and picker renders", () => {
    expect(personaName("  Researcher  ")).toBe("Researcher");
  });

  it("refuses a persona nobody can address", () => {
    try {
      personaName("   ");
      expect.unreachable();
    } catch (error: unknown) {
      expect(personasRefusal(error)).toMatchObject({ code: "empty-name" });
    }
  });
});

describe("personaTools", () => {
  it("keeps the names as given, in order", () => {
    expect(personaTools(["search", "read"])).toEqual(["search", "read"]);
  });

  it("is empty for a persona that can only read and write", () => {
    // An empty list is a statement rather than an omission: absence from the
    // list is the whole restriction.
    expect(personaTools([])).toEqual([]);
  });

  it("drops blanks and repeats, which name no tool and no second grant", () => {
    expect(personaTools([" search ", "", "search", "  "])).toEqual(["search"]);
  });
});
