import { describe, expect, it } from "vitest";

import {
  emptySet,
  excludedKindsOf,
  isWholeProject,
  kindsOf,
  nextSetName,
  ruleOf,
  withExcludedKind,
  withKind,
  withWholeProject
} from "$app-views/categories/project-overview/procedures/contexts";

describe("resource set rules", () => {
  it("reads a rule as a sentence, naming sets it reaches", () => {
    const names = new Map([["resourceSets:2", "Field evidence"]]);
    expect(ruleOf(emptySet())).toBe("Selects nothing");
    expect(ruleOf({ include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] })).toBe(
      "Everything in the project, minus Slide decks"
    );
    expect(
      ruleOf(
        {
          include: [
            { select: "kinds", kinds: ["document", "finding"] },
            { select: "set", setId: "resourceSets:2" as never },
            { select: "resources", refs: [{ kind: "document", id: "documents:1" }] }
          ],
          exclude: []
        },
        names
      )
    ).toBe("Documents, Findings and Field evidence and 1 named resource");
  });

  it("builds and unbuilds a rule from toggles", () => {
    const findings = withKind(emptySet(), "finding", true);
    expect(kindsOf(findings)).toEqual(["finding"]);
    const wide = withWholeProject(findings, true);
    expect(isWholeProject(wide)).toBe(true);
    expect(withWholeProject(wide, false)).toEqual(findings);
    expect(withKind(findings, "finding", false)).toEqual(emptySet());
    const narrowed = withExcludedKind(wide, "slides", true);
    expect(excludedKindsOf(narrowed)).toEqual(["slides"]);
    expect(withExcludedKind(narrowed, "slides", false)).toEqual(wide);
  });

  it("names a new set after the ones that exist", () => {
    expect(nextSetName([])).toBe("New set 1");
    expect(
      nextSetName([
        { id: "a", name: "New set 1", set: emptySet(), createdByName: "x", revision: 1, updatedAt: 1, resolves: 0 }
      ])
    ).toBe("New set 2");
  });
});
