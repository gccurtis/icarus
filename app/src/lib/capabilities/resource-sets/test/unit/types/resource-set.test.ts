import { describe, expect, it } from "vitest";
import { resourceSetsRefusal } from "$resource-sets/errors";
import { resourceSetName } from "$resource-sets/types/resource-set";

describe("resourceSetName", () => {
  it("trims, because a set is picked out of a list by name", () => {
    expect(resourceSetName("  Customer research  ")).toBe("Customer research");
  });

  it("refuses a name nothing can pick out", () => {
    // A set exists to be referenced — by another set, by a persona, by a prompt
    // block. An unnamed one is a row nobody can choose again.
    let refusal;
    try {
      resourceSetName("   ");
    } catch (error) {
      refusal = resourceSetsRefusal(error);
    }
    expect(refusal).toMatchObject({ code: "empty-name" });
  });
});
