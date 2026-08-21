import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { dateValueValidator, formulaValueValidator } from "$content/types/value";

const kinds = () => formulaValueValidator.members.map((member) => member.fields.kind.value as string);

const date = { calendar: "gregorian", year: 2026, month: 8, day: 17, utc: 1_755_388_800_000 };

describe("formulaValueValidator", () => {
  it("names six kinds, looked up by literal rather than position", () => {
    expect(kinds().sort()).toEqual(["boolean", "date", "empty", "number", "table", "text"]);
  });

  it("has no list, record, or range kind", () => {
    // A one-column table is a list; a one-row table whose fields are its columns
    // is a record; and a range is a table because a value is a result, not a
    // query — liveness belongs to the formula that recomputes.
    for (const absent of ["list", "record", "range"]) {
      expect(kinds()).not.toContain(absent);
    }
  });

  it("has no error kind", () => {
    // A failure is a property of the computation, so it lives in the block's
    // `state`. An error value would make every consumer re-check whether a value
    // really is one.
    expect(kinds()).not.toContain("error");
    expect(validate(formulaValueValidator, { kind: "error", message: "#REF" })).toBe(false);
  });

  it("keeps empty distinct from zero, blank, and false", () => {
    // A reference to a blank cell is none of those, and collapsing them is how a
    // sum quietly counts a gap as a value.
    expect(validate(formulaValueValidator, { kind: "empty" })).toBe(true);
    expect(validate(formulaValueValidator, { kind: "empty", value: 0 })).toBe(false);

    const empty = formulaValueValidator.members.find(
      (member) => member.fields.kind.value === "empty"
    );
    expect(Object.keys(empty!.fields)).toEqual(["kind"]);
  });

  it("has no reference kind", () => {
    // A name that resolves to something else is a `VariableValue`, where the
    // target is a typed union rather than an opaque id. A value that is only an
    // id is one nothing can render without resolving it first.
    expect(kinds()).not.toContain("reference");
    expect(validate(formulaValueValidator, { kind: "reference", ref: "c4x1" })).toBe(false);
  });

  it("admits a table whose cells are themselves values", () => {
    expect(
      validate(formulaValueValidator, {
        kind: "table",
        columns: [{ name: "Region" }, { name: "Total", valueFormat: "#,##0" }],
        rows: [[{ kind: "text", value: "EMEA" }, { kind: "number", value: 42 }]]
      })
    ).toBe(true);
  });

  it("cannot reject a malformed nested cell, and that is the accepted cost", () => {
    // The cell is `v.any()` because the recursion is real and a validator is a
    // value, not a type. Everything outside a cell is still checked; a renderer
    // of a nested one has to be defensive.
    expect(
      validate(formulaValueValidator, {
        kind: "table",
        columns: [],
        rows: [[{ kind: "nonsense" }]]
      })
    ).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses a scalar with the wrong payload type", () => {
      expect(validate(formulaValueValidator, { kind: "number", value: "42" })).toBe(false);
      expect(validate(formulaValueValidator, { kind: "text", value: 42 })).toBe(false);
    });

    it("refuses a table with no columns list", () => {
      expect(validate(formulaValueValidator, { kind: "table", rows: [] })).toBe(false);
    });

    it("refuses a bare value with no kind", () => {
      expect(validate(formulaValueValidator, { value: 42 })).toBe(false);
    });
  });
});

describe("dateValueValidator", () => {
  it("stores the parts, because each is separately meaningful", () => {
    // A date with no time is genuinely different from one at midnight, which a
    // single number cannot say.
    expect(validate(dateValueValidator, date)).toBe(true);
    expect(validate(dateValueValidator, { ...date, hour: 9, minute: 30 })).toBe(true);
  });

  it("requires utc even though it is derived", () => {
    // It is the fast path for sorting and comparing, rewritten whenever a
    // component changes and never edited alone.
    const { utc, ...withoutUtc } = date;
    expect(utc).toBeTypeOf("number");
    expect(validate(dateValueValidator, withoutUtc)).toBe(false);
  });

  it("pins the calendar so a stored date never means whatever the code assumed", () => {
    expect(validate(dateValueValidator, { ...date, calendar: "julian" })).toBe(false);
  });

  it("refuses a date missing a required component", () => {
    const { day, ...withoutDay } = date;
    expect(day).toBe(17);
    expect(validate(dateValueValidator, withoutDay)).toBe(false);
  });
});
