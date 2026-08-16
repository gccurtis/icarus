import { describe, expect, it } from "vitest";
import { nameManagerTables } from "$name-manager/schema";

describe("name manager schema", () => {
  it("leads every index with projectId", () => {
    const indexes = nameManagerTables.nameVariables[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds both forms of the name, and the lookup form is what the index serves", () => {
    const fields = Object.keys(nameManagerTables.nameVariables.validator.fields).sort();
    const indexes = nameManagerTables.nameVariables[" indexes"]();

    expect(fields).toEqual(
      [
        "projectId",
        "nameKey",
        "name",
        "declaredType",
        "value",
        "definitionOrder",
        "createdBy",
        "updatedAt"
      ].sort()
    );
    expect(indexes.find((index) => index.indexDescriptor === "by_project_and_name_key")?.fields)
      .toEqual(["projectId", "nameKey"]);
  });

  it("indexes the definition order, because that is what a list is read in", () => {
    const indexes = nameManagerTables.nameVariables[" indexes"]();

    expect(indexes.find((index) => index.indexDescriptor === "by_project_and_order")?.fields).toEqual(
      ["projectId", "definitionOrder"]
    );
  });

  it("stores no expression and no dependencies — nothing here is computed", () => {
    const fields = nameManagerTables.nameVariables.validator.fields;

    expect(fields).not.toHaveProperty("expression");
    expect(fields).not.toHaveProperty("dependsOn");
    expect(fields).not.toHaveProperty("state");
  });
});
