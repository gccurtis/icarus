import { describe, expect, it } from "vitest";
import { resourceSetsTables } from "$resource-sets/schema";

/**
 * The absence is the assertion. A resolved list on this row would make a saved
 * set mean "the project as it was" the moment it was written, which is the one
 * thing this model exists to prevent.
 */
describe("resourceSets schema", () => {
  it("leads every index with projectId", () => {
    const indexes = resourceSetsTables.resourceSets[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the expression and nothing resolved from it", () => {
    const fields = Object.keys(resourceSetsTables.resourceSets.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "name",
        "description",
        "expression",
        "createdBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  it("stores no member list, so what it selects is never a snapshot", () => {
    const fields = resourceSetsTables.resourceSets.validator.fields;

    expect(fields).not.toHaveProperty("refs");
    expect(fields).not.toHaveProperty("members");
    expect(fields).not.toHaveProperty("resolvedAt");
  });
});
