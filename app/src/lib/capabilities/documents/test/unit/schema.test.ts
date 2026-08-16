import { describe, expect, it } from "vitest";
import { documentsTables } from "$documents/schema";

/**
 * The absences are the assertions. A body or a revision on this row would be
 * rewritten in full by every keystroke batch, so the field set is asserted
 * exactly — a field that drifts in fails here rather than in a write bill.
 */
describe("documents schema", () => {
  it("leads every index with projectId", () => {
    const indexes = documentsTables.documents[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the metadata a list renders and nothing a patch would rewrite", () => {
    const fields = Object.keys(documentsTables.documents.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "title", "templateId", "createdBy", "updatedBy", "updatedAt"].sort()
    );
  });

  it("keeps the body and the revision off the row", () => {
    const fields = documentsTables.documents.validator.fields;

    expect(fields).not.toHaveProperty("blocks");
    expect(fields).not.toHaveProperty("rows");
    expect(fields).not.toHaveProperty("revision");
  });
});
