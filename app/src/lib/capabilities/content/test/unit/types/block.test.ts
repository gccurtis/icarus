import { describe, expect, it } from "vitest";
import { v } from "convex/values";
import { validate } from "convex-helpers/validators";
import { blockValidator, markValidator, textAtomValidator } from "$content/types/block";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";

/**
 * The union is the model: what a block can be, and what every block owes
 * whatever holds it. A variant that stops carrying an id, or a text block that
 * stops carrying its resolved display string, fails here rather than in review.
 */

/** Members are looked up by their `type` literal — never by position, so a sixth variant disturbs nothing. */
const fieldsOf = (type: string) => {
  const member = blockValidator.members.find((m) => m.fields.type.value === type);
  return member!.fields as Record<string, { kind: string; isOptional: string }>;
};

const textBlock = {
  id: "b1",
  type: "text",
  variant: "paragraph",
  atoms: [
    { id: "a1", kind: "literal", text: "Revenue was " },
    { id: "a2", kind: "formula", expression: "SUM(Sales!B:B)", resolved: "$4.2M", state: "fresh" }
  ],
  display: "Revenue was $4.2M",
  marks: [{ id: "m1", from: 12, to: 17, style: ["bold"] }]
};

const formulaBlock = {
  id: "b2",
  type: "formula",
  expression: "=SUM(A1:A10)",
  display: "42",
  value: { kind: "number", value: 42 },
  state: "fresh"
};

describe("blockValidator", () => {
  it("carries an id on every variant, which is what a change set addresses", () => {
    for (const member of blockValidator.members) {
      expect(member.fields.id.kind).toBe("string");
    }
  });

  it("discriminates on type, so one field decides which variant a value is", () => {
    expect(blockValidator.members.every((m) => m.fields.type.kind === "literal")).toBe(true);
  });

  it("holds the two variants pass 2 needs and no placeholders", () => {
    expect(blockValidator.members.map((m) => m.fields.type.value).sort()).toEqual(["formula", "text"]);
  });

  it("admits both variants and refuses one that has not been built", () => {
    expect(validate(blockValidator, textBlock)).toBe(true);
    expect(validate(blockValidator, formulaBlock)).toBe(true);
    expect(validate(blockValidator, { id: "b3", type: "image", alt: "" })).toBe(false);
  });

  it("grows a variant without changing an existing one", () => {
    // Each variant owns its whole field set, so growth appends rather than
    // widening — the failure mode this guards is one object with optionals.
    expect(fieldsOf("text").expression).toBeUndefined();
    expect(fieldsOf("formula").atoms).toBeUndefined();

    const grown = v.union(
      ...blockValidator.members,
      v.object({ id: v.string(), type: v.literal("image"), alt: v.string() })
    );
    const textMember = grown.members.find((m) => m.fields.type.value === "text");
    expect(textMember!.fields).toEqual(fieldsOf("text"));
    expect(validate(grown, textBlock)).toBe(true);
  });
});

describe("the text variant", () => {
  it("carries what was authored, what is shown, and the marks over it", () => {
    const fields = fieldsOf("text");
    expect(fields.atoms.kind).toBe("array");
    expect(fields.display.kind).toBe("string");
    expect(fields.marks.kind).toBe("array");
  });

  it("requires display rather than deriving it on read", () => {
    const { display: _display, ...withoutDisplay } = textBlock;
    expect(validate(blockValidator, withoutDisplay)).toBe(false);
  });

  it("names a style by key, leaving the formatting in the resource's style set", () => {
    expect(fieldsOf("text").style).toMatchObject({ kind: "string", isOptional: "optional" });
  });
});

describe("textAtomValidator", () => {
  it("gives every atom an id, which is the finest merge granularity there is", () => {
    for (const member of textAtomValidator.members) {
      expect(member.fields.id.kind).toBe("string");
    }
  });

  it("makes a formula atom carry its own resolved text and state", () => {
    const atom = { id: "a2", kind: "formula", expression: "SUM(B:B)", resolved: "$4.2M", state: "fresh" };
    expect(validate(textAtomValidator, atom)).toBe(true);
    const { resolved: _resolved, ...unresolved } = atom;
    expect(validate(textAtomValidator, unresolved)).toBe(false);
    expect(validate(textAtomValidator, { ...atom, state: "done" })).toBe(false);
  });
});

describe("markValidator", () => {
  it("gives every mark an id, so two people bolding different words merge", () => {
    expect(markValidator.fields.id.kind).toBe("string");
    const { id: _id, ...anonymous } = { id: "m1", from: 0, to: 4 };
    expect(validate(markValidator, anonymous)).toBe(false);
  });

  it("takes a list of styles, so one range can be bold and italic at once", () => {
    expect(validate(markValidator, { id: "m1", from: 0, to: 4, style: ["bold", "italic"] })).toBe(true);
    expect(validate(markValidator, { id: "m1", from: 0, to: 4, style: ["huge"] })).toBe(false);
  });
});

describe("formulaValueValidator", () => {
  it("distinguishes empty from a zero, a blank string, and a false", () => {
    expect(formulaValueValidator.members.map((m) => m.fields.kind.value).sort()).toEqual([
      "boolean",
      "date",
      "empty",
      "number",
      "table",
      "text"
    ]);
  });

  it("admits a table whose cell is itself a table", () => {
    const nested: FormulaValue = {
      kind: "table",
      columns: [{ name: "Region" }],
      rows: [[{ kind: "table", columns: [], rows: [[{ kind: "number", value: 42 }]] }]]
    };
    expect(validate(formulaValueValidator, nested)).toBe(true);
  });

  it("checks the table's own shape, which is the part a validator can reach", () => {
    expect(validate(formulaValueValidator, { kind: "table", rows: [] })).toBe(false);
    expect(validate(formulaValueValidator, { kind: "table", columns: "one", rows: [] })).toBe(false);
    // Rows are rows even though a cell is open.
    expect(validate(formulaValueValidator, { kind: "table", columns: [], rows: "nope" })).toBe(false);
  });

  it("keeps a date's components, because a formula can ask for the month", () => {
    const date = { kind: "date", value: { calendar: "gregorian", year: 2026, month: 8, day: 16, utc: 0 } };
    expect(validate(formulaValueValidator, date)).toBe(true);
    const { utc: _utc, ...componentsOnly } = date.value;
    expect(validate(formulaValueValidator, { kind: "date", value: componentsOnly })).toBe(false);
  });
});

describe("the formula variant", () => {
  it("carries the expression, the resolved display, and the typed value", () => {
    const fields = fieldsOf("formula");
    expect(fields.expression.kind).toBe("string");
    expect(fields.display.kind).toBe("string");
    expect(fields.value.kind).toBe("union");
  });

  it("says a failure in state, never as a value kind", () => {
    expect(validate(blockValidator, { ...formulaBlock, state: "error", error: "#REF!" })).toBe(true);
    expect(validate(formulaValueValidator, { kind: "error", value: "#REF!" })).toBe(false);
  });
});
