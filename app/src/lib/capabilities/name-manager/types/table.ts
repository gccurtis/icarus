import type { FormulaValue } from "$content/types/value";
import { NameManagerError } from "$name-manager/errors";
import type { VariableValue } from "$name-manager/types/variable";

/**
 * Every variable as a table, degenerately.
 *
 * An analysis takes tables, and this is what lets it take anything: a table is
 * itself, a record is one row with its fields as columns, a list is one column,
 * and a scalar is one cell. So an author putting `TargetMargin` on a shelf never
 * has to know how it was declared.
 *
 * `name` becomes the column name wherever the value does not carry one of its
 * own, which is why it is a parameter rather than read off the row: the
 * projection is over the value, and the caller holds the name.
 */
export const asTable = (name: string, value: VariableValue): FormulaValue => {
  if (value.kind === "table") return value;

  if (value.kind === "record") {
    const fields = Object.keys(value.fields);
    return {
      kind: "table",
      columns: fields.map((field) => ({ name: field })),
      rows: [fields.map((field) => value.fields[field] as FormulaValue)]
    };
  }

  if (value.kind === "list") {
    return {
      kind: "table",
      columns: [{ name }],
      rows: value.values.map((element) => [element as FormulaValue])
    };
  }

  // Not "a function has no rows": it is not an input at all, and a caller that
  // asked for one as a table has a mistake rather than an empty result.
  if (value.kind === "function") {
    throw new NameManagerError("not-tabular", `'${name}' is a function, not a value`);
  }

  return { kind: "table", columns: [{ name }], rows: [[value]] };
};
