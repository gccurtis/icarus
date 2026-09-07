import type { Card, Example, Grid } from "$development-views/formula-language-reference/types";

export const POSITIONAL: Grid = {
  columns: ["Written", "On a table", "On a list", "Reads as"],
  mono: [0],
  rows: [
    ["t[0]", "the first row, as a record", "the first value", "Zero based, as Python is"],
    ["t[-1]", "the last row", "the last value", "Negative counts back from the end"],
    ["t[2:5]", "rows 2, 3 and 4 as a table", "three values as a list", "Start included, end excluded"],
    ["t[:3]", "the first three rows", "the first three values", "An omitted start is the beginning"],
    ["t[3:]", "everything from row 3 on", "the rest of the values", "An omitted end is the end"],
    ["t[-3:]", "the last three rows", "the last three values", "The common case, written the short way"],
    ["t[:]", "the whole table", "the whole list", "A copy, and the way to say so out loud"],
    ["t[0][2]", "the third field of the first row", "—", "Slices compose left to right"]
  ]
};

export const SEMANTIC: Grid = {
  columns: ["Written", "Does", "Answers with"],
  mono: [0],
  rows: [
    ["t.{name, minutes}", "Keeps two fields and drops the rest", "a table two columns wide"],
    ["t.{(minutes > 1000)}", "Keeps the rows the predicate holds for", "a table the same width"],
    ["t.{name, (tier = \"Tier 1\")}", "Both at once: filter the rows, then keep one field", "a table one column wide"],
    ["t.{(minutes > 1000 and tier = \"Tier 1\")}", "Two conditions, spelled as a word", "a table"],
    ["t.{(not (tier = \"Deferred\"))}", "Negation, also a word", "a table"],
    ["t.{(minutes > MEAN(t.minutes))}", "A predicate may call anything the language can call", "a table"]
  ]
};

export const RULES: readonly Card[] = [
  {
    title: "A bare name projects, a parenthesis filters",
    detail:
      "Inside the braces, a name on its own asks for that column. Anything in parentheses is an expression, evaluated once per row, and the row is kept when it answers TRUE. That is the whole rule, and it is why a logic field cannot be mistaken for a filter: write (flagged) to filter, flagged to project.",
    tag: "built",
    tone: "works"
  },
  {
    title: "Order inside the braces does not matter",
    detail:
      "Projections and predicates can be written in any order and comma separated. Selection always happens before projection, so a predicate may name a field the projection drops.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A field name inside a predicate means this row's field",
    detail:
      "minutes inside the braces is the row's minutes, not a variable called minutes. A name that is not a field of the table falls through to the ordinary resolution order, so a project variable can be compared against.",
    tag: "built",
    tone: "works"
  },
  {
    title: "Both operators and words",
    detail:
      "and, or, not read as the symbols do, because a person writing a filter should not have to remember which dialect this is. = compares, <> differs, and the four inequalities do what they look like.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A field name is a legal word",
    detail:
      "Letters, digits and underscore, never starting with a digit. No spaces, no hyphens and no quoted strings to get around that. One word keeps the grammar inside the braces small enough to read at a glance, and quoting can be added later without changing anything written before it.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Slicing never mutates",
    detail:
      "Every slice answers with a new value. A formula cannot write through a slice, which is what keeps a sheet's dependency graph a graph.",
    tag: "built",
    tone: "works"
  }
];

export const EMPTY: Grid = {
  columns: ["Written", "When rows survive", "When nothing survives", "Reads as"],
  mono: [0],
  rows: [
    ["t[0]", "the first row, as a record", "empty", "Indexing into nothing is not a refusal"],
    ["t[0].name", "that row's name", "empty", "A field of empty is empty"],
    ["t[-1]", "the last row", "empty", "The same rule from the other end"],
    ["ISEMPTY(t)", "FALSE", "TRUE", "How to ask, rather than comparing against a token"],
    ["COUNT(t)", "the number of rows", "0", "Counting nothing is zero"],
    ["SUM(t.minutes)", "the total", "0", "A sum over nothing is zero, not #N/A"]
  ]
};

export const EXAMPLES: readonly Example[] = [
  {
    expression: "outages.{name, (minutes > 1000)}",
    answers: "Ashgrove · Coldwater · Lindow",
    kind: "table, one column",
    note: "Filter, then project. The predicate may name minutes even though the projection drops it."
  },
  {
    expression: "outages.{(tier = \"Tier 1\" and minutes > 2000)}[0].name",
    answers: "\"Coldwater\"",
    kind: "text",
    note: "Semantic slice, positional slice, field. Reads left to right, one narrowing at a time."
  },
  {
    expression: "SUM(outages.{(tier = \"Tier 1\")}.minutes)",
    answers: "6805",
    kind: "number",
    note: "The shape the whole design is for: a total over the rows that mean something rather than the rows that happen to be adjacent."
  },
  {
    expression: "outages.minutes[-3:]",
    answers: "[366, 1010, 1720]",
    kind: "list",
    note: "Column first, then the last three."
  },
  {
    expression: "outages.{name, minutes}[0]",
    answers: "{ name: \"Ashgrove\", minutes: 1610 }",
    kind: "record",
    note: "One row is a record. There is no suffix for this, because the index already said which one."
  },
  {
    expression: "outages.{(minutes > 99999)}[0]",
    answers: "empty",
    kind: "empty",
    note: "The optimistic filter, asked for its first row. Nothing survived, so the answer is empty and a sum over it is zero."
  }
];

export const RULED: readonly Card[] = [
  {
    title: "The exclamation mark is not a collapse",
    detail:
      "It resolves a reference into the thing it points at, and that is all it does. Taking one row out of a query is what an index is for: t[0] answers with a record, so a second gesture for the same job was one gesture too many.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Nothing survives, and that is an answer",
    detail:
      "Indexing an empty table answers empty rather than refusing. A filter that matches no rows is an ordinary outcome, not a mistake, so the language should not make every optimistic query wrap itself in IFERROR.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A field name is one word, and a hyphen is subtraction",
    detail:
      "Letters, digits and underscore. A hyphen is not legal in a name anywhere, because inside a predicate cost-tier could not be told apart from cost minus tier, and a name that is legal in one half of the braces and ambiguous in the other is worse than no hyphen at all.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "There is no conditioning gesture",
    detail:
      "Conditioning one field on another is a predicate over the row, and the braces already express that with and. A second spelling of a thing the language can already say is a rule to learn and nothing to gain.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Set operations are functions, later",
    detail:
      "Union, difference and intersection are operations on two tables rather than a slice of one. They get functions, which name their arguments, when there is something able to produce two tables to combine.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Join is a function, later",
    detail:
      "Two tables joined on a field is a real need and it is not slicing. It gets a function when the language has one table to slice properly, not an operator now.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A positional slice has no step",
    detail:
      "Start and end only. Every other spreadsheet stops here, nobody has asked for every second row, and a second colon is a grammar rule earning nothing.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A predicate may name the whole table",
    detail:
      "t.{(minutes > MEAN(t.minutes))} reads plainly and needs no new word, and the outer reference is evaluated once rather than per row. Restricting a predicate to its own row would force a second formula for every comparison against an aggregate.",
    tag: "ruled",
    tone: "ruled"
  }
];
