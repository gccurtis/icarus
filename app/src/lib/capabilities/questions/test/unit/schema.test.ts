import { describe, expect, it } from "vitest";
import { questionsTables } from "$questions/schema";

/**
 * The absences carry as much as the fields. A question holding arrays of its
 * hypotheses or findings would make the link table a second truth, and a
 * `parked` status would fill the list with work nobody is doing.
 */
describe("questions schema", () => {
  it("leads every index with projectId", () => {
    const indexes = questionsTables.questions[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("indexes the tree by parent, within the project", () => {
    const indexes = questionsTables.questions[" indexes"]();
    const byParent = indexes.find((index) => index.indexDescriptor === "by_parent");

    expect(byParent?.fields.slice(0, 2)).toEqual(["projectId", "parentId"]);
  });

  it("holds the question, its context, where it stands, and its one parent", () => {
    const fields = Object.keys(questionsTables.questions.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "text", "notes", "status", "parentId", "createdBy", "revision", "updatedAt"].sort()
    );
  });

  it("holds no arrays of what points at it", () => {
    const fields = questionsTables.questions.validator.fields;

    // Hypotheses and findings attach through research links, both many-to-many.
    // A foreign key here would force someone to pick the one it "really" belongs
    // to and lose the rest.
    expect(fields).not.toHaveProperty("hypotheses");
    expect(fields).not.toHaveProperty("hypothesisIds");
    expect(fields).not.toHaveProperty("findings");
    expect(fields).not.toHaveProperty("findingIds");
  });
});
