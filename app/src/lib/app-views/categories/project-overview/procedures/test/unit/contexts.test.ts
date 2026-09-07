import { describe, expect, it } from "vitest";

import {
  isWholeProject,
  nextSetName,
  ruleOf,
  scopeNamesOf,
  withTerm,
  withWholeProject,
  withoutTerm
} from "$app-views/categories/project-overview/procedures/contexts";

const emptySet = () => ({ include: [], exclude: [] });

describe("resource set rules", () => {
  it("reads a rule as a sentence, naming sets and resources it reaches", () => {
    const names = scopeNamesOf(
      [
        {
          id: "resourceSets:2",
          name: "Field evidence",
          set: emptySet(),
          createdByName: "x",
          revision: 1,
          updatedAt: 1,
          resolves: 0
        }
      ],
      [{ id: "documents:1", name: "Winter readiness brief" }]
    );
    expect(ruleOf(emptySet())).toBe("Nothing");
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
    ).toBe("Documents, Findings, Field evidence and Winter readiness brief");
  });

  it("builds and unbuilds a rule one term at a time", () => {
    const findings = withTerm(emptySet(), "include", { select: "kinds", kinds: ["finding"] });
    expect(ruleOf(findings)).toBe("Findings");
    expect(isWholeProject(withWholeProject())).toBe(true);
    expect(withoutTerm(findings, "include", "kinds:finding")).toEqual(emptySet());
    const narrowed = withTerm(withWholeProject(), "exclude", { select: "kinds", kinds: ["slides"] });
    expect(ruleOf(narrowed)).toBe("Everything in the project, minus Slide decks");
    expect(withoutTerm(narrowed, "exclude", "kinds:slides")).toEqual(withWholeProject());
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
