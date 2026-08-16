import { describe, expect, it } from "vitest";
import { formulaValueValidator } from "$content/types/value";
import { KIND_OF, valueTypeValidator, variableValueValidator } from "$name-manager/types/variable";

const kindsOf = (validator: typeof variableValueValidator) =>
  validator.members.map((member) => member.fields.kind.value).sort();

describe("the variable value vocabulary", () => {
  it("declares the nine types the model names", () => {
    expect(valueTypeValidator.members.map((member) => member.value).sort()).toEqual(
      ["text", "number", "logic", "date", "null", "list", "record", "table", "function"].sort()
    );
  });

  it("holds every formula value, so a computed result is stored as it arrived", () => {
    for (const member of formulaValueValidator.members) {
      expect(kindsOf(variableValueValidator)).toContain(member.fields.kind.value);
    }
  });

  it("adds the three shapes a formula cannot return", () => {
    const kinds = kindsOf(variableValueValidator);

    expect(kinds).toContain("list");
    expect(kinds).toContain("record");
    expect(kinds).toContain("function");
  });

  it("answers every declared type with exactly one value kind", () => {
    const declared = valueTypeValidator.members.map((member) => member.value);

    expect(Object.keys(KIND_OF).sort()).toEqual(declared.sort());
    for (const kind of Object.values(KIND_OF)) {
      expect(kindsOf(variableValueValidator)).toContain(kind);
    }
  });

  it("names the two kinds an author calls something else", () => {
    // The value vocabulary is content's; the declared one is the author's.
    expect(KIND_OF.logic).toBe("boolean");
    expect(KIND_OF.null).toBe("empty");
  });
});
