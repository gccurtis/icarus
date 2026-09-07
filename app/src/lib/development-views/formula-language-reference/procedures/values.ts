import type { Card, Example, Grid } from "$development-views/formula-language-reference/types";

export const KINDS: Grid = {
  columns: ["Kind", "Shape", "Where one comes from", "In a cell", "State"],
  mono: [0, 2],
  rows: [
    ["empty", "nothing", "—", "A blank cell, which is not a zero and not an empty string", "built"],
    ["number", "one number", "1842 · 3.10 · 12.5%", "Drawn through the cell's number format", "built"],
    ["text", "one string", "\"Ashgrove\"", "Drawn as written, marks and all", "built"],
    ["logic", "true or false", "TRUE · FALSE", "TRUE or FALSE, centred", "built"],
    ["date", "calendar parts and a utc instant", "typed, or DATE(2026, 8, 30)", "Typed, stored as parts and drawn; YEAR, MONTH and DAY read one", "built"],
    ["list", "values in order", "t.minutes · UNIQUE(…) · a range", "The cell draws its values in order, comma separated. It does not spill yet", "built"],
    ["record", "named fields, one row", "t[0] · a variable", "The cell draws each field as a name and a value. It does not spill yet", "built"],
    ["table", "named columns, many rows", "t.{…} · a sheet resolved · a variable", "The cell draws how many rows it has. It does not spill yet", "built"],
    ["reference", "a pointer at something that resolves", "a variable holding one", "The cell draws an arrow and the name, until ! resolves it", "built"],
    ["range", "a resource id and two corners", "B2:C9 · 'Hardening cost model'!E10", "An address, resolved as soon as it is read as data", "built"],
    ["function", "parameters and a formula id", "nothing writes one yet", "A value a variable can hold; calling that name answers #NAME?", "proposed"]
  ]
};

export const SHAPES: readonly { readonly title: string; readonly detail: string; readonly columns: number; readonly cells: readonly string[]; readonly heads: number }[] = [
  {
    title: "Record · one row",
    detail: "Named fields. Dot a field to pull its value. There is nothing to index, so brackets do not apply.",
    columns: 3,
    heads: 3,
    cells: ["name", "minutes", "tier", "Ashgrove", "1610", "Tier 1"]
  },
  {
    title: "List · one column",
    detail: "Values in order, no names. Index it to pull a value, slice it to take a run of them.",
    columns: 1,
    heads: 0,
    cells: ["1610", "412", "2985", "190"]
  },
  {
    title: "Table · rows of records",
    detail: "Index it and you take a row, which is a record. Dot a field and you take a column, which is a list.",
    columns: 3,
    heads: 3,
    cells: ["name", "minutes", "tier", "Ashgrove", "1610", "Tier 1", "Barrow Hill", "412", "Tier 3", "Coldwater", "2985", "Tier 1"]
  }
];

export const EXAMPLES: readonly Example[] = [
  { expression: "outages[0]", answers: "{ name: \"Ashgrove\", minutes: 1610, … }", kind: "record", note: "A row taken by position is a record, whatever the table's width." },
  { expression: "outages.minutes", answers: "[1610, 412, 2985, …]", kind: "list", note: "A column taken by name is a list, whatever the table's height." },
  { expression: "outages[0].minutes", answers: "1610", kind: "number", note: "Row first, then field. The same value as outages.minutes[0]." },
  { expression: "outageEvents", answers: "→ spreadsheets:1", kind: "reference", note: "A reference is its own kind. Reading it gives the pointer, and that is a complete answer." },
  { expression: "outageEvents!", answers: "a table, 14 rows", kind: "table", note: "The suffix resolves the pointer into the thing it names." },
  { expression: "SUM(outages.minutes)", answers: "18088", kind: "number", note: "Functions that take a range also take a list, because a range resolves to one." },
  { expression: "COUNT(outages)", answers: "4", kind: "number", note: "Counting a table counts its rows, not its cells." }
];

export const EMPTINESS: readonly Card[] = [
  {
    title: "empty is not zero",
    detail:
      "A blank cell in SUM adds nothing rather than adding zero, and MEAN does not count it. Arithmetic on a blank reads it as zero, which is the one place the two agree.",
    tag: "built",
    tone: "works"
  },
  {
    title: "empty is not \"\"",
    detail:
      "Text joining reads a blank as the empty string, so \"a\" & blank is \"a\". COUNTA counts a written empty string and skips a blank.",
    tag: "built",
    tone: "works"
  },
  {
    title: "An error is not a kind",
    detail:
      "The representation has no error member. A refused formula stores empty and the cell carries the refusal beside it in failure, so a cell that failed is never confused with a cell that says #REF! on purpose.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A formula answers with a reference",
    detail:
      "FormulaValue gained the reference member, so a pointer is a value kind rather than something only a name could hold. VariableValue became an alias of FormulaValue, because the two lists are one list now. That was the cost: a change to the representation, agreed in review before anything was written.",
    tag: "built",
    tone: "works"
  }
];

export const RULED: readonly Card[] = [
  {
    title: "A reference is its own kind",
    detail:
      "Not a table whose values happen to be tables. A pointer and the thing it points at are different enough that a reader should be able to see which one they are holding, and a table of tables is the hardest possible way to show that.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A range is not a reference",
    detail:
      "A range is an address: a resource and two corners, written by a sheet and resolved by whoever holds the cells. A reference points at something that itself resolves. They sit next to each other in the table above and they are not the same idea.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Dates are a kind, and already are one",
    detail:
      "DateValue is in the representation as calendar parts plus a utc instant, and the editor types, stores and draws one today. A formula deals with a date directly rather than through a serial number and a convention. DATE builds one from civil parts and YEAR, MONTH and DAY read one back.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A list or a table spills, and the origin owns the rectangle",
    detail:
      "The origin cell carries spillTo, the covered cells are read-only, and a write inside the rectangle is refused. The body already models this, so a table landing in a sheet needs no new shape. Filling only the cell it was written in would make a table unreadable the moment it is more than one value.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A big answer travels as a reference",
    detail:
      "Above a size threshold a formula answers with a pointer rather than with rows, and the reader resolves it. That keeps a cell small and a change set small. It is also why FormulaValue gained its reference member rather than leaving a pointer as something only a name could hold. The threshold itself is not written yet.",
    tag: "ruled",
    tone: "ruled"
  }
];
