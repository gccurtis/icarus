import { describe, expect, it } from "vitest";
import { resourceTypeValidator } from "$revisions/types/change";
import { resourceKindValidator } from "$shared/types/resource";

/**
 * The union decides what a scope can select and what the lattice can index, so
 * what is asserted here is that decision: a finding is project *content* and
 * belongs in it, while a question and a hypothesis are the project's open
 * threads and do not.
 */
const kinds = () => resourceKindValidator.members.map((member) => member.value);

describe("resourceKindValidator", () => {
  it("names every kind a project holds and works over", () => {
    expect(kinds().sort()).toEqual(
      ["document", "slides", "spreadsheet", "externalFile", "finding", "connector", "template"].sort()
    );
  });

  it("admits a finding, which is cited and indexed like any other material", () => {
    expect(kinds()).toContain("finding");
  });

  it("admits no question, hypothesis, or message", () => {
    // Retrieving over a question returns the asking rather than an answer, and a
    // conversation is working material. A message worth keeping is promoted to a
    // finding, which is the editorial act worth indexing.
    for (const absent of ["question", "hypothesis", "message"]) {
      expect(kinds()).not.toContain(absent);
    }
  });

  it("covers all three general resources, so nothing editable is unscopable", () => {
    for (const type of resourceTypeValidator.members.map((member) => member.value)) {
      expect(kinds()).toContain(type);
    }
  });
});
