import { describe, expect, it } from "vitest";
import { spreadsheetsTables } from "$spreadsheets/schema";

/**
 * The absences are the assertions, as they are for documents. A workbook's rows
 * are the largest body of the three to rewrite by accident.
 */
describe("spreadsheets schema", () => {
  it("leads every index with projectId", () => {
    const indexes = spreadsheetsTables.spreadsheets[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the metadata a list renders and nothing a patch would rewrite", () => {
    const fields = Object.keys(spreadsheetsTables.spreadsheets.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "title", "templateId", "createdBy", "updatedBy", "updatedAt"].sort()
    );
  });

  it("keeps the body and the revision off the row", () => {
    const fields = spreadsheetsTables.spreadsheets.validator.fields;

    expect(fields).not.toHaveProperty("sheets");
    expect(fields).not.toHaveProperty("cells");
    expect(fields).not.toHaveProperty("revision");
  });
});
