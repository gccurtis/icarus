import { describe, expect, it } from "vitest";
import { blockValidator } from "$content/types/block";
import { findingsTables } from "$findings/schema";
import { findingSourceValidator } from "$findings/types/finding";
import { resourceTypeValidator } from "$revisions/types/change";

/**
 * A finding is the durable output of research, and the schema is where that is
 * either true or quietly abandoned: an attachment column would make it
 * subordinate to a question, and a `bearing` column would flatten evidence that
 * supports one explanation while undercutting another.
 */
describe("findings schema", () => {
  it("leads every index with projectId", () => {
    const indexes = findingsTables.findings[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the claim, the writeup, and what establishes it", () => {
    const fields = Object.keys(findingsTables.findings.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "title",
        "body",
        "sources",
        "createdBy",
        "updatedBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  it("carries no question, no hypothesis, and no bearing", () => {
    const fields = findingsTables.findings.validator.fields;

    // All three are research links. One finding relates differently to different
    // hypotheses, and a bearing here could only say one thing at a time.
    expect(fields).not.toHaveProperty("questionId");
    expect(fields).not.toHaveProperty("hypothesisId");
    expect(fields).not.toHaveProperty("bearing");
  });

  it("stores the body as content blocks rather than document rows", () => {
    const body = findingsTables.findings.validator.fields.body;

    // A finding has no page, no margins, and no side-by-side layout: it is read
    // inline wherever it is cited.
    expect(body.element).toBe(blockValidator);
  });

  it("stores sources on the row, because a citation is part of the finding", () => {
    expect(findingsTables.findings.validator.fields.sources.element).toBe(findingSourceValidator);
  });

  it("is no general resource, so nothing replays a body it never logged", () => {
    // No head-plus-change-sets. A citation records what it read, so the
    // obligation to keep a past version sits with the citer.
    expect(resourceTypeValidator.members.map((member) => member.value)).not.toContain("finding");
  });
});
