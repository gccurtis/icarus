import { describe, expect, it } from "vitest";
import { messageSourceValidator } from "$messages/types/source";
import { resourceKindValidator } from "$shared/types/resource";

/** The members differ in shape, so a variant's fields are read as a bag. */
const fieldsOf = (kind: string): Record<string, unknown> =>
  (messageSourceValidator.members.find((member) => member.fields.kind.value === kind)?.fields ??
    {}) as Record<string, unknown>;

describe("messageSourceValidator", () => {
  it("admits a resource, a page, and a lattice node", () => {
    const kinds = messageSourceValidator.members.map((member) => member.fields.kind.value).sort();

    // `file` and `finding` folded into `resource` once findings became a
    // resource kind: two variants differing only in which table they meant.
    expect(kinds).toEqual(["lattice", "resource", "url"]);
    expect(kinds).not.toContain("file");
    expect(kinds).not.toContain("finding");
  });

  it("names a lattice node by a real latticeNodes id", () => {
    // Unlike `resourceId`, one table answers to it, so nothing is lost by typing it.
    expect(fieldsOf("lattice").nodeId).toMatchObject({ kind: "id", tableName: "latticeNodes" });
  });

  it("names a resource by both its type and its id", () => {
    const resource = fieldsOf("resource");

    // The pair is the key: two resources of different kinds may carry the same id.
    expect(resource.resourceType).toBe(resourceKindValidator);
    expect(resource).toHaveProperty("resourceId");
  });
});
