import { describe, expect, it } from "vitest";
import { researchLinksTables } from "$research-links/schema";
import {
  linkBearerKindValidator,
  linkSubjectKindValidator
} from "$research-links/types/research-link";

/**
 * The table exists so a relationship can carry its own attributes and run both
 * ways in one read. The schema is where that is either true or quietly lost: a
 * `bearing` anywhere but here flattens evidence that supports one explanation
 * while undercutting another, and an index missing a direction turns a read into
 * a scan.
 */
describe("researchLinks schema", () => {
  const links = researchLinksTables.researchLinks;
  const indexes = links[" indexes"]();
  const indexNamed = (name: string) => indexes.find((index) => index.indexDescriptor === name);

  it("leads every index with projectId", () => {
    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the two ends, what the bearer says, and who said it", () => {
    const fields = Object.keys(links.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "bearerKind",
        "bearerId",
        "subjectKind",
        "subjectId",
        "bearing",
        "note",
        "createdBy"
      ].sort()
    );
  });

  it("resolves a bearer's subjects and a subject's bearers each in one index", () => {
    // Both directions in one indexed read is what a join table buys over an
    // array on either side.
    expect(indexNamed("by_bearer")?.fields).toEqual(["projectId", "bearerKind", "bearerId"]);
    expect(indexNamed("by_subject")?.fields).toEqual(["projectId", "subjectKind", "subjectId"]);
  });

  it("indexes the whole pair, which is what the duplicate check reads", () => {
    expect(indexNamed("by_bearer_subject")?.fields).toEqual([
      "projectId",
      "bearerKind",
      "bearerId",
      "subjectKind",
      "subjectId"
    ]);
  });

  it("makes a question no bearer and a finding no subject", () => {
    // Direction is canonical — finding → hypothesis → question — so the same
    // relationship cannot be stored two ways, and the duplicate check means
    // something.
    expect(linkBearerKindValidator.members.map((member) => member.value)).toEqual([
      "finding",
      "hypothesis"
    ]);
    expect(linkSubjectKindValidator.members.map((member) => member.value)).toEqual([
      "hypothesis",
      "question"
    ]);
  });

  it("carries the bearing on the edge, and nothing to order edges by", () => {
    const fields = links.validator.fields;

    // On the edge, one finding supports one hypothesis and contradicts another.
    expect(fields.bearing.isOptional).toBe("optional");
    expect(fields.note.isOptional).toBe("optional");
    // Ordering evidence is a view concern: relevance, recency, and bearing are
    // all there to sort by without anybody maintaining a position.
    expect(fields).not.toHaveProperty("rank");
  });

  it("stores an endpoint id as a string, because the kind beside it names the table", () => {
    // A `v.id` union would make every reader choose a branch to render one list,
    // and the pair `(kind, id)` is the key either way.
    expect(links.validator.fields.bearerId.kind).toBe("string");
    expect(links.validator.fields.subjectId.kind).toBe("string");
  });
});
