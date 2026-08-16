import { describe, expect, it } from "vitest";
import { resourceRefValidator, setExpressionValidator } from "$shared/types/set-expression";

type Union = {
  members: { fields: Record<string, { kind: string; value?: string; tableName?: string }> }[];
};

/** The fields differ per operator, so they are read as a bag rather than narrowed. */
const ops = (union: Union) => union.members.map((member) => member.fields.op.value).sort();

const fieldsOf = (op: string) =>
  (setExpressionValidator as unknown as Union).members.find((m) => m.fields.op.value === op)!
    .fields;

describe("setExpressionValidator", () => {
  it("names every operator the model defines, and no intersection", () => {
    // `A ∩ B` is `difference(A, difference(A, B))`, so an operator for it would
    // be a second way to write what these already say.
    expect(ops(setExpressionValidator as unknown as Union)).toEqual([
      "difference",
      "kind",
      "project",
      "resources",
      "set",
      "union"
    ]);
  });

  it("takes a list on union, so five kinds are one node rather than four", () => {
    expect(fieldsOf("union").of.kind).toBe("array");
  });

  it("nests, so difference over a union is one expression", () => {
    for (const side of ["from", "remove"] as const) {
      expect(ops(fieldsOf("difference")[side] as unknown as Union)).toContain("union");
    }
  });

  it("names a saved set by id, so a reference cannot point outside the table", () => {
    expect(fieldsOf("set").setId.kind).toBe("id");
    expect(fieldsOf("set").setId.tableName).toBe("resourceSets");
  });

  it("stores a ref's kind beside its id, so resolving probes no table", () => {
    expect(Object.keys(resourceRefValidator.fields).sort()).toEqual(["id", "kind"]);
  });
});
