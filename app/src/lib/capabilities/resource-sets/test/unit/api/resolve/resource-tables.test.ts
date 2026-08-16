import { describe, expect, it } from "vitest";
import { RESOURCE_TABLES, storedKinds } from "$resource-sets/api/resolve/resource-tables";
import { resourceKindValidator } from "$shared/types/resource";

const kinds = resourceKindValidator.members.map((member) => member.value);

describe("RESOURCE_TABLES", () => {
  it("gives every kind a project stores a table to read it from", () => {
    // Anything a scope can select, a resolution must be able to find. A kind
    // with no table here silently resolves to nothing.
    for (const kind of kinds.filter((k) => k !== "connector")) {
      expect(RESOURCE_TABLES).toHaveProperty(kind);
    }
  });

  it("gives a connector none, because a connector ref means its files", () => {
    // Not a gap waiting on pass 8: scoping to a source means the material it
    // brought in, so the connector row is never a member even once it exists.
    expect(RESOURCE_TABLES).not.toHaveProperty("connector");
  });

  it("orders the stored kinds, so one project resolves the same way twice", () => {
    expect(storedKinds).toEqual([
      "document",
      "slides",
      "spreadsheet",
      "externalFile",
      "finding",
      "template"
    ]);
  });
});
