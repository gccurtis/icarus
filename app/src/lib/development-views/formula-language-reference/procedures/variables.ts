import type { Card, Example, Grid, Stage } from "$development-views/formula-language-reference/types";

export const SHAPE: Grid = {
  columns: ["Field", "Holds", "Today", "Note"],
  mono: [0],
  rows: [
    ["_id", "The row's identity", "in the table", "What a back reference points at, never the name"],
    ["projectId", "Which project owns it", "in the table", "A variable is project scoped; there is no sheet-local variable"],
    ["name", "What a formula says", "in the table", "The only part a person types, and the part that has to be unique"],
    ["value", "A VariableValue: any formula value, or a reference", "in the table", "A reference is an alias, resolved when asked rather than copied"],
    ["createdBy · updatedAt", "Who and when", "in the table", "The ordinary provenance every row carries"],
    ["type", "What the value is allowed to be", "in the table", "The capability checks it against the value's kind before a row is written; any promises nothing"],
    ["description", "What it means", "in the table", "Stored and read back with the row; three of the six seeded variables carry one and no surface writes one yet"]
  ]
};

export const HOLDS: Grid = {
  columns: ["A variable can hold", "Example", "What a formula gets"],
  mono: [1],
  rows: [
    ["A number", "rates.perMinute = 3.10", "A number, usable in arithmetic"],
    ["Text", "region = \"North\"", "Text, joinable and comparable"],
    ["Logic", "hardeningApproved = TRUE", "TRUE or FALSE"],
    ["A date", "seasonStart = DATE(2026, 11, 1)", "A date, with parts a formula can ask for"],
    ["A list", "tiers = [\"Tier 1\", \"Tier 2\", \"Tier 3\"]", "A list, sliceable and countable"],
    ["A record", "target = { minutes: 15000, cost: 50000 }", "A record, dottable"],
    ["A table", "outages = a table of 14 rows", "A table, sliceable both ways"],
    ["A range", "feederMinutes = 'Outage minutes'!E4:E17", "An address in a sheet, resolved when read. Not a reference"],
    ["A reference to another variable", "rate = → rates.perMinute", "A pointer. Resolve it with ! to reach what it aliases"],
    ["A reference to a resource", "outageEvents = → spreadsheets:1", "A pointer at a table, resolved with !"],
    ["A formula", "saidi = a formula row with parameters", "Nothing yet: a call on a name that holds one answers #NAME?"]
  ]
};

export const RESOLUTION: readonly Stage[] = [
  {
    index: "00",
    title: "Before any of this, the caller translates",
    detail:
      "A spreadsheet turns the addresses somebody typed into ids, because an address means something only in one sheet. By the time the formula system is asked anything, there are no addresses left to resolve.",
    source: "the spreadsheet, not the formula"
  },
  {
    index: "01",
    title: "A call goes to the built-ins",
    detail:
      "A name followed by a bracket is a function. Built-ins are code. A variable holding a formula value is a function too, which is how a project defines its own.",
    source: "built-in resolution"
  },
  {
    index: "02",
    title: "A bare name goes to the project",
    detail:
      "Anything that is not a call is looked up in variables by name. A hit answers with the value, and a value that is a reference is handed back as a reference rather than followed.",
    source: "variable resolution"
  },
  {
    index: "03",
    title: "An id goes to the thing it names",
    detail:
      "A cell id answers with that cell's value. A sheet or a document id answers with a table, because every resource is representable as one. This is the step a translated formula lands in.",
    source: "id resolution"
  },
  {
    index: "04",
    title: "Nothing else is a name",
    detail: "The formula answers #NAME? and says the word it could not place, because a silent zero is how a spreadsheet lies.",
    source: "refusal"
  }
];

export const EXAMPLES: readonly Example[] = [
  { expression: "=E4 * rates.perMinute", answers: "4991.00", kind: "number", note: "A cell and a project name in one line. The cell half is an id by the time the formula sees it." },
  { expression: "=SUM(outageEvents!.minutes)", answers: "18088", kind: "number", note: "A variable that points at a sheet, resolved, sliced by field, summed." },
  { expression: "=COUNT(tiers)", answers: "3", kind: "number", note: "A list variable counted." },
  { expression: "=target.minutes - SUM(outages.minutes)", answers: "-3088", kind: "number", note: "A record variable dotted, against a table variable sliced." },
  { expression: "=rate!", answers: "3.10", kind: "number", note: "An alias resolved to the value it aliases. The cell shows the number, the lens shows the hop." }
];

export const COLLISION: readonly Card[] = [
  {
    title: "A dot cannot mean two things",
    detail:
      "The seeded note calls a variable Rates.perMinute, and the language wants the dot for fields. If both are allowed, rates.perMinute is ambiguous: a variable with a dot in its name, or the perMinute field of the record variable rates.",
    tag: "decide",
    tone: "gap"
  },
  {
    title: "Namespacing by record reads the same",
    detail:
      "Make rates a record variable with a perMinute field and every line that people want to write still reads the same, with one meaning for the dot and one place to change the year's numbers.",
    tag: "proposed",
    tone: "proposed"
  },
  {
    title: "Names have to be legal words",
    detail:
      "The same rule as a field name: letters, digits and underscore, not starting with a digit, and never shaped like an address. A variable called B4 could not be said out loud in a formula, so the table should refuse it at creation rather than at use.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Case is not identity",
    detail:
      "Rates and rates are the same variable, because a person typing a formula does not remember which one they created. Matching is case-insensitive in the capability and in the editor, and display keeps what was typed.",
    tag: "built",
    tone: "works"
  }
];

export const RULED: readonly Card[] = [
  {
    title: "A variable holds every kind a formula answers with",
    detail:
      "One list, dates included. There is no value a formula can produce that a variable cannot keep, which is what makes a variable the formula system's memory rather than a second, smaller language.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A reference to a resource is a reference to a table",
    detail:
      "Every resource has a table reading. Nothing implements it yet, and writing it down now stops a second shape being invented for documents when they arrive.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "The sheet is not a step in resolution",
    detail:
      "The order is built-in, then variable, then id. A spreadsheet participates by translating what was typed before it asks, and by drawing the answer afterwards.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A dot is not legal in a name",
    detail:
      "Names are single words and records namespace. rates.perMinute becomes a record with a field, one meaning for the dot, and every line people want to write still reads the same. Trying the longest dotted name first would put a lookup on every field access and let a variable shadow a record.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A variable's type is declared",
    detail:
      "And the value must satisfy it, so a formula can be checked before it runs, a table can promise its columns, and a wrong write is refused at the edge. Deriving the type from whatever a name currently holds means nothing can be told it is wrong until it runs. The field is in the table, and the capability refuses a value the declared type does not allow.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A variable is project scoped",
    detail:
      "One namespace and one place to look. A sheet cannot have a private helper, which is the price of never having two places to search for a name a formula did not recognise.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A cell shows what it points at",
    detail:
      "One line naming the thing, until the reader resolves it. Spilling the table instead means a hundred thousand rows arrive because somebody typed a name.",
    tag: "ruled",
    tone: "ruled"
  }
];

export const STATE: readonly Card[] = [
  {
    title: "The table is written and read",
    detail:
      "variables carries projectId, name, value, type, description, createdBy and updatedAt. capabilities/variables reads a project's names, saves one as an upsert on the name, and removes one. Six are seeded: a number, text, logic, a date, a list and an alias.",
    tag: "built",
    tone: "works"
  },
  {
    title: "The value type is complete",
    detail:
      "VariableValue is an alias of FormulaValue now. Every value a formula answers with is a value a name can hold, and nothing on this page needed a new kind, which is the strongest signal that the shape was right.",
    tag: "built",
    tone: "works"
  },
  {
    title: "The Variables panel is the surface",
    detail:
      "It lists the project's names with what each holds and what it is allowed to hold, filters them, and creates, edits and removes one. The rail entry had been drawing the shell's placeholder. It does not offer a field for a description.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A variable holding a formula is modelled and not callable",
    detail:
      "FormulaUse says a formula row is held either in a resource at a path or in a variable by name, and function is in the value list. Nothing writes that row, so calling a name that holds one answers #NAME?.",
    tag: "gap",
    tone: "gap"
  }
];

