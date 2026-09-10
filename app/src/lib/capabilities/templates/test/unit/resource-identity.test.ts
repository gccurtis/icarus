import { describe, expect, it } from "vitest";

import { resourceSetOf } from "$capabilities/templates/api/shared/hole-validation";

const setWith = (term: unknown): unknown => ({ include: [term], exclude: [] });

describe("template resource identity admission", () => {
  it.each([
    { select: "kinds", kinds: ["analysis"] },
    { select: "kinds", kinds: ["externalFile::pdf"] },
    { select: "resources", refs: [{ kind: "externalFile", id: "externalFiles:one" }] },
    { select: "resources", refs: [{ kind: "externalFile::pdf", id: "externalFiles:one" }] },
    { select: "resources", refs: [{ kind: "document", id: "slideDecks:one" }] },
    {
      select: "resources",
      refs: [{ kind: "document", id: "documents:one", retired: true }]
    }
  ])("rejects a non-current scope term %#", (term) => {
    expect(() => resourceSetOf(setWith(term), "scope")).toThrow(/resource set/);
  });

  it("keeps the broad external family selector separate from exact external refs", () => {
    expect(resourceSetOf(setWith({ select: "kinds", kinds: ["externalFile"] }), "scope"))
      .toEqual(setWith({ select: "kinds", kinds: ["externalFile"] }));
    expect(resourceSetOf(setWith({
      select: "resources",
      refs: [{ kind: "externalFile::image", id: "externalFiles:one" }]
    }), "scope")).toEqual(setWith({
      select: "resources",
      refs: [{ kind: "externalFile::image", id: "externalFiles:one" }]
    }));
  });
});
