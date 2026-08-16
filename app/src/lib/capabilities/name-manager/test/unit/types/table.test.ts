import { describe, expect, it } from "vitest";
import { nameManagerRefusal } from "$name-manager/errors";
import { asTable } from "$name-manager/types/table";
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
 * The projection analyses read every variable through. A person putting a
 * variable on a shelf never had to know whether it was declared a list, a
 * record, or a table.
 */
describe("asTable", () => {
  it("returns a table as itself", () => {
    const table: VariableValue = {
      kind: "table",
      columns: [{ name: "region" }, { name: "revenue" }],
      rows: [[{ kind: "text", value: "EMEA" }, { kind: "number", value: 12 }]]
    };

    expect(asTable("Sales", table)).toBe(table);
  });

  it("spreads a record across one row, its fields as columns", () => {
    expect(
      asTable("Target", {
        kind: "record",
        fields: { margin: { kind: "number", value: 42 }, unit: { kind: "text", value: "%" } }
      })
    ).toEqual({
      columns: [{ name: "margin" }, { name: "unit" }],
      kind: "table",
      rows: [[{ kind: "number", value: 42 }, { kind: "text", value: "%" }]]
    });
  });

  it("stands a list up as one column named for the variable", () => {
    expect(
      asTable("Regions", {
        kind: "list",
        values: [{ kind: "text", value: "EMEA" }, { kind: "text", value: "APAC" }]
      })
    ).toEqual({
      columns: [{ name: "Regions" }],
      kind: "table",
      rows: [[{ kind: "text", value: "EMEA" }], [{ kind: "text", value: "APAC" }]]
    });
  });

  it("makes a scalar a one-by-one", () => {
    expect(asTable("TargetMargin", { kind: "number", value: 42 })).toEqual({
      columns: [{ name: "TargetMargin" }],
      kind: "table",
      rows: [[{ kind: "number", value: 42 }]]
    });
  });

  it("keeps an empty a cell rather than no rows", () => {
    // A blank is a value here: one row holding nothing, not an absence of rows,
    // which is what a table of zero rows would claim.
    expect(asTable("Unset", { kind: "empty" })).toEqual({
      columns: [{ name: "Unset" }],
      kind: "table",
      rows: [[{ kind: "empty" }]]
    });
  });

  it("refuses a function, which is not usable as an input", () => {
    expect(
      refusalOf(() =>
        asTable("Double", { kind: "function", parameters: ["x"], expression: "x*2" })
      )
    ).toMatchObject({ code: "not-tabular" });
  });
});
