import { describe, expect, it } from "vitest";
import {
  LATTICE_SOURCE_KINDS,
  latticeSourceValidator,
  sourceKey
} from "$knowledge/types/lattice-source";
import { resourceKindValidator } from "$shared/types/resource";

/**
 * Read out of the validators rather than written down twice. A list copied into
 * the test agrees with itself forever, which is the one thing this must not do.
 */
const sourceKinds: string[] = latticeSourceValidator.members.map(
  (member) => member.fields.kind.value
);
const resourceKinds: string[] = resourceKindValidator.members.map((member) => member.value);

describe("LatticeSource", () => {
  it("uses the same kind strings a resource set selects by", () => {
    // Total scoping rests on this: anything the lattice indexes, a set can
    // select, with no translation between two vocabularies to get wrong.
    expect(sourceKinds.filter((kind) => !resourceKinds.includes(kind))).toEqual([]);
  });

  it("is a strict subset — a template and a connector are not sources", () => {
    expect(resourceKinds.filter((kind) => !sourceKinds.includes(kind)).sort()).toEqual([
      "connector",
      "template"
    ]);
  });

  it("agrees with the kind list the compiler checks", () => {
    expect([...LATTICE_SOURCE_KINDS].sort()).toEqual([...sourceKinds].sort());
  });

  it("indexes no conversation and no open thread", () => {
    // A message is working material and a question is what the project does not
    // know; retrieving over either returns half-formed reasoning or the asking.
    expect(sourceKinds).not.toContain("message");
    expect(sourceKinds).not.toContain("question");
    expect(sourceKinds).not.toContain("hypothesis");
  });

  it("names a source by kind and id together, never the id alone", () => {
    expect(sourceKey({ kind: "document", id: "documents:1" as never })).toBe(
      "document:documents:1"
    );
  });
});
