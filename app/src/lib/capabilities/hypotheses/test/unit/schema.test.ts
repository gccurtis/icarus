import { describe, expect, it } from "vitest";
import { hypothesesTables } from "$hypotheses/schema";

/**
 * A hypothesis stands on its own, and the schema is where that is either true or
 * quietly abandoned: a `questionId` column would make it subordinate, and a
 * required `confidence` would fabricate a number for a claim nobody has tested.
 */
describe("hypotheses schema", () => {
  it("leads every index with projectId", () => {
    const indexes = hypothesesTables.hypotheses[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the claim, the argument for it, and the judgement on it", () => {
    const fields = Object.keys(hypothesesTables.hypotheses.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "statement",
        "rationale",
        "assessment",
        "confidence",
        "createdBy",
        "updatedBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  it("carries no question, because questions attach through links", () => {
    const fields = hypothesesTables.hypotheses.validator.fields;

    // Many-to-many: a claim about pricing power bears on "why did margin fall"
    // and "should we raise prices" at once, and duplicating it to attach it twice
    // would make two things that must be assessed together and cannot be.
    expect(fields).not.toHaveProperty("questionId");
    expect(fields).not.toHaveProperty("questionIds");
    expect(fields).not.toHaveProperty("findings");
  });

  it("stores projectId directly rather than reaching it through a question", () => {
    // An unattached hypothesis is not stranded outside every query.
    expect(hypothesesTables.hypotheses.validator.fields.projectId).toBeDefined();
  });

  it("leaves confidence optional, since an untested claim has none to report", () => {
    const confidence = hypothesesTables.hypotheses.validator.fields.confidence;

    expect(confidence.isOptional).toBe("optional");
  });
});
