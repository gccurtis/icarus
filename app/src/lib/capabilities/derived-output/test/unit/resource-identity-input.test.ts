import { describe, expect, it } from "vitest";

import { validateCreateDerivedOutput } from "$capabilities/derived-output/api/create-derived-output/validate-create-derived-output";
import { validateReadDerivedOutput } from "$capabilities/derived-output/api/read-derived-output/validate-read-derived-output";
import { validateRefreshDerivedOutput } from "$capabilities/derived-output/api/refresh-derived-output/validate-refresh-derived-output";
import { resourceSet } from "$capabilities/derived-output/api/shared/input";

const setWith = (term: unknown): unknown => ({ include: [term], exclude: [] });

describe("derived output resource identity input", () => {
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
    expect(() => resourceSet(setWith(term))).toThrow();
  });

  it("admits the broad external selector and an exact external reference", () => {
    expect(resourceSet({
      include: [
        { select: "kinds", kinds: ["externalFile"] },
        {
          select: "resources",
          refs: [{ kind: "externalFile::data", id: "externalFiles:one" }]
        }
      ],
      exclude: []
    })).toEqual({
      include: [
        { select: "kinds", kinds: ["externalFile"] },
        {
          select: "resources",
          refs: [{ kind: "externalFile::data", id: "externalFiles:one" }]
        }
      ],
      exclude: []
    });
  });

  it("rejects unknown command fields and non-nominal derived output ids", () => {
    expect(() => validateCreateDerivedOutput({ prompt: "Ask", retired: true })).toThrow(
      /unknown field/
    );
    expect(() => validateReadDerivedOutput({ derivedOutputId: "one" })).toThrow(
      /derivedOutputs row id/
    );
    expect(() => validateRefreshDerivedOutput({
      derivedOutputId: "derivedOutputs:one",
      selection: {
        ref: { kind: "document", id: "documents:one" },
        from: 0,
        to: 1,
        retired: true
      }
    })).toThrow(/unknown field/);
  });
});
