import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import {
  GENERAL_RESOURCE_TYPES,
  generalResourceTypeValidator,
  resourceKeyValidator
} from "$revisions/types/resource";

const members = () => generalResourceTypeValidator.members.map((member) => member.value as string);

describe("generalResourceTypeValidator", () => {
  it("names the three resources that are edited", () => {
    expect(members().sort()).toEqual(["document", "slides", "spreadsheet"]);
  });

  it("keeps the exported list and the validator in step", () => {
    // The list is the truth here rather than a snapshot of it, because the space
    // is closed — unlike ResourceKind, which exports no list on purpose.
    expect([...GENERAL_RESOURCE_TYPES].sort()).toEqual(members().sort());
  });

  it("excludes resource kinds that are not edited through ops", () => {
    // Every general resource type is also a ResourceKind; most resource kinds
    // are not general resources.
    for (const kind of ["finding", "connector", "external", "template", "resourceSet"]) {
      expect(validate(generalResourceTypeValidator, kind)).toBe(false);
    }
  });
});

describe("resourceKeyValidator", () => {
  it("carries the type beside the id", () => {
    // A change set has to be routed without probing three tables to find out
    // what its id belongs to.
    expect(validate(resourceKeyValidator, { resourceType: "document", resourceId: "k57ab" })).toBe(
      true
    );
  });

  it("takes a plain string id, not a table id", () => {
    // The three tables do not exist yet, and a union of table ids would have to
    // be loosened to add the fourth.
    expect(resourceKeyValidator.fields.resourceId.kind).toBe("string");
  });

  describe("what it refuses", () => {
    it("refuses a key with no type", () => {
      expect(validate(resourceKeyValidator, { resourceId: "k57ab" })).toBe(false);
    });

    it("refuses a type outside the three", () => {
      expect(validate(resourceKeyValidator, { resourceType: "finding", resourceId: "k57ab" })).toBe(
        false
      );
    });
  });
});
