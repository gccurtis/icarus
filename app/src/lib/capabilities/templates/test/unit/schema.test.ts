import { describe, expect, it } from "vitest";
import { templatesTables } from "$templates/schema";

describe("templates schema", () => {
  it("leads every index with projectId", () => {
    const indexes = templatesTables.templates[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds what the model states and nothing else", () => {
    const fields = Object.keys(templatesTables.templates.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "name",
        "description",
        "target",
        "body",
        "slots",
        "createdBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  /**
   * The one table whose tenant column may be absent. Absent means every project,
   * and it is still the first column of the index — so the globals are their own
   * key range rather than rows a project read might stray into.
   */
  it("makes projectId optional, because a template can belong to every project", () => {
    expect(templatesTables.templates.validator.fields.projectId.isOptional).toBe("optional");
  });

  /**
   * `target` on the row is what lets a picker list the document templates without
   * reading a single body.
   */
  it("keeps target on the row as well as in the body", () => {
    expect(templatesTables.templates.validator.fields.target).toBeDefined();
  });
});
