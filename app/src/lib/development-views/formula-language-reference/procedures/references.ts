import type { Card, Example, Grid } from "$development-views/formula-language-reference/types";

export const KINDS: Grid = {
  columns: ["A reference points at", "Which resolves to", "Written in the representation", "Today"],
  mono: [2],
  rows: [
    ["Another variable, by name", "whatever that variable holds, however many hops away", "{ kind: \"reference\", target: { to: \"variable\", name } }", "Resolved; the walk follows it"],
    ["A resource: a sheet, a document, a deck, a file", "a table, because every resource is representable as one", "{ kind: \"reference\", target: { to: \"resource\", ref } }", "A sheet resolves; a document, a deck and a file do not yet"],
    ["A cell, a row or a column, by id", "the value, the record or the list that id names", "the ids a stored formula carries", "Proposed; a reference target is a variable or a resource"],
    ["Another reference", "the walk continues until something is not a reference", "a reference whose target is a reference", "Resolved; a ring answers #CYCLE!"]
  ]
};

export const WHY: readonly Card[] = [
  {
    title: "A cell should not carry a hundred thousand rows",
    detail:
      "A value that is a pointer keeps the sheet's stored body small, keeps a change set small, and keeps the grid drawing what it can see rather than what exists.",
    tag: "built",
    tone: "works"
  },
  {
    title: "An alias is not a copy",
    detail:
      "The evaluator does this: a reference resolves when it is asked, walking to another variable until it reaches a value. Storing what it currently resolves to would make an alias a snapshot.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A range is not a reference",
    detail:
      "B2:C9 is an address: a resource and two corners. It is written by the sheet that owns those cells and resolved by whoever holds them. A reference points at a thing that itself resolves, which is a different job, and mixing the two makes both harder to explain.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Every resource is a table",
    detail:
      "A sheet, a document, a deck and a file all have a table shape they can be read as. That is why one reference kind covers all of them and why resolving a resource reference answers with a table rather than with something new.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Resolution is written down",
    detail:
      "The suffix ! turns a pointer into the thing it names. Without a mark, every dot on a reference would silently drag a table across the wire and nobody could tell which lines were expensive.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A cell holds one and a formula answers with one",
    detail:
      "FormulaValue gained the reference member, so a formula naming a variable that holds a pointer answers with the pointer rather than with what it names. VariableValue is an alias of FormulaValue now, because a cell's list and a formula's list are the same list.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A reference can point at a reference",
    detail:
      "Nesting is how a big table gets split. The resolver walks until it reaches something that is not a reference, and refuses when the walk returns to where it started.",
    tag: "built",
    tone: "works"
  }
];

export const EXAMPLES: readonly Example[] = [
  { expression: "outageEvents", answers: "→ spreadsheets:1", kind: "reference", note: "Reading a reference gives the pointer, not the rows. A cell drawing this shows what it points at." },
  { expression: "outageEvents!", answers: "a table, 14 rows", kind: "table", note: "Resolution asks for the thing itself. This is the line that costs something." },
  { expression: "outageEvents!.{(tier = \"Tier 1\")}", answers: "a table, 5 rows", kind: "table", note: "Resolve, then slice. The slice runs where the rows are, not in the cell." },
  { expression: "outageEvents!.minutes[0]", answers: "1610", kind: "number", note: "Resolve, take a column, take the first value." },
  { expression: "rate!", answers: "3.10", kind: "number", note: "An alias to a variable holding a number. The walk ends at the first thing that is not a reference." },
  { expression: "SUM(outageEvents!.minutes)", answers: "18088", kind: "number", note: "A function takes the resolved value like any other list." }
];

export const WALK: readonly { readonly index: string; readonly title: string; readonly detail: string }[] = [
  { index: "01", title: "The name arrives", detail: "The formula has a name and no idea what owns it. It asks the resolver, in one fixed order." },
  { index: "02", title: "The resolver answers", detail: "The built-in table answers for a call, the variables table answers for a project name, and an id answers with the thing it names." },
  { index: "03", title: "The answer may be a pointer", detail: "A variable can hold a reference. The resolver does not follow it: a pointer is a perfectly good value to hand back." },
  { index: "04", title: "! asks again", detail: "The suffix hands the pointer back to the resolver and asks for the thing it names, which may itself be a pointer." },
  { index: "05", title: "The walk is bounded", detail: "Each hop is recorded. A pointer that leads back to one already seen answers #CYCLE! rather than looping." }
];

export const RULED: readonly Card[] = [
  {
    title: "! is the resolution operator",
    detail:
      "Written after the thing, so it composes left to right with every other postfix: x!, x!.field, x!.{(…)}, x![0]. It was briefly a collapse for one-row tables; that job belongs to an index, and this one had no operator at all.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A reference is its own value kind",
    detail:
      "It appears in the kinds table on the Values page beside number and table, rather than being modelled as a table whose cells are tables.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A resource reference resolves to a table",
    detail:
      "A sheet resolves to one today, read as the rectangle anything was written into. When a document or a deck lands it answers with a table too, which is a shape the language already slices.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "! on something that is not a reference does nothing",
    detail:
      "Resolving means keep going until this is not a pointer, so a number resolves to itself. A variable that sometimes holds a reference can then be written the same way everywhere, and no formula has to know what a name happens to hold today.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Dotting a reference does not resolve it",
    detail:
      "The suffix comes first, always. One rule and no surprises, at the cost of a slightly longer line. Resolving silently on a dot would make the cost of a formula unreadable from the formula, which is the thing this whole design is trying to keep visible.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Resolution runs in the capability",
    detail:
      "Next to the rows. A filter over a hundred thousand rows runs where the rows are and the browser receives an answer rather than a table to throw most of away.",
    tag: "ruled",
    tone: "ruled"
  }
];
