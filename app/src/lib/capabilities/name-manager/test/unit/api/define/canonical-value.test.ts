import { describe, expect, it } from "vitest";
import { canonicalValue } from "$name-manager/api/define/canonical-value";
import { nameManagerRefusal } from "$name-manager/errors";
import type { VariableValue } from "$name-manager/types/variable";

const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return nameManagerRefusal(error);
  }
};

/**
 * Structural only. Nothing here parses an expression, resolves a reference, or
 * computes anything — which is what keeps this capability off formula's back.
 */
describe("canonicalValue", () => {
  it("admits a value whose kind is what was declared", () => {
    const value: VariableValue = { kind: "number", value: 42 };

    expect(canonicalValue("number", value)).toBe(value);
  });

  it("rejects a function call declared as a number — because it is not a number", () => {
    const refusal = refusalOf(() =>
      canonicalValue("number", { kind: "function", parameters: [], expression: "SUM(A1:A10)" })
    );

    expect(refusal).toMatchObject({ code: "type-mismatch" });
    // The complaint is the shape, never the call: nothing here has an opinion
    // about whether `SUM(A1:A10)` would have worked.
    expect(refusal?.message).toMatch(/number/);
  });

  it("reads 'logic' and 'null' in the author's vocabulary", () => {
    expect(canonicalValue("logic", { kind: "boolean", value: true })).toMatchObject({
      kind: "boolean"
    });
    expect(canonicalValue("null", { kind: "empty" })).toMatchObject({ kind: "empty" });
    expect(refusalOf(() => canonicalValue("null", { kind: "number", value: 0 }))).toMatchObject({
      code: "type-mismatch"
    });
  });

  it("keeps a declared list from holding a record and vice versa", () => {
    expect(
      refusalOf(() => canonicalValue("list", { kind: "record", fields: {} }))
    ).toMatchObject({ code: "type-mismatch" });
    expect(
      refusalOf(() => canonicalValue("record", { kind: "list", values: [] }))
    ).toMatchObject({ code: "type-mismatch" });
  });
});
