import { describe, expect, it } from "vitest";

import { validateQuerySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/validate-query-semantic-materials";
import { validateQuerySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/validate-query-semantic-overlay";

const semanticQueryWith = (term: unknown): unknown => ({
  text: "evidence",
  topK: 3,
  scope: { include: [term], exclude: [] }
});

describe("semantic query resource identity input", () => {
  it.each([
    { select: "kinds", kinds: ["analysis"] },
    { select: "kinds", kinds: ["externalFile::pdf"] },
    { select: "resources", refs: [{ kind: "externalFile", id: "externalFiles:one" }] },
    { select: "resources", refs: [{ kind: "document", id: "slideDecks:one" }] },
    {
      select: "resources",
      refs: [{ kind: "document", id: "documents:one", retired: true }]
    },
    { select: "set", setId: "sets:one" },
    { select: "project", retired: true }
  ])("rejects a non-current scope term %#", (term) => {
    expect(() => validateQuerySemanticOverlay(semanticQueryWith(term))).toThrow();
    expect(() => validateQuerySemanticMaterials(semanticQueryWith(term))).toThrow();
  });

  it("keeps the external family selector separate from an exact external ref", () => {
    const input = {
      text: "evidence",
      topK: 3,
      scope: {
        include: [
          { select: "kinds", kinds: ["externalFile"] },
          {
            select: "resources",
            refs: [{ kind: "externalFile::text", id: "externalFiles:one" }]
          }
        ],
        exclude: []
      }
    };
    expect(validateQuerySemanticOverlay(input)).toEqual(input);
    expect(validateQuerySemanticMaterials(input)).toEqual(input);
  });

  it("rejects unknown input fields and duplicate material kinds", () => {
    expect(() => validateQuerySemanticOverlay({ text: "evidence", topK: 3, retired: true }))
      .toThrow(/unknown field/);
    expect(() => validateQuerySemanticMaterials({
      text: "evidence",
      topK: 3,
      kinds: ["table", "table"]
    })).toThrow(/supported kinds/);
  });
});
