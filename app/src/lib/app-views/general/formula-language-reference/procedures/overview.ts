import type { Card, Grid, Stage } from "$authored-components/reference";

export const TRANSLATION: readonly Stage[] = [
  {
    index: "01",
    title: "The equals sign says this is a formula",
    detail:
      "A sheet reading =B2:C9 knows two things immediately: what follows is an expression rather than text, and a formula now has to exist for it. The cell keeps the expression addressed by ids and points at the formulas row the capability mints for it.",
    source: "the spreadsheet"
  },
  {
    index: "02",
    title: "Addresses become ids",
    detail:
      "B2:C9 means something only in the sheet it was typed in, and a formula is project global. So the sheet rewrites what was typed into an expression over the cells themselves, each named by the id of its row and the id of its column, before anything else sees it.",
    source: "the spreadsheet"
  },
  {
    index: "03",
    title: "The lock stays behind",
    detail:
      "The dollar signs in $C$4 tell copy and paste which part of an address to shift. That is a spreadsheet gesture about spreadsheet editing. It is not in the stored formula and the formula system has never heard of it.",
    source: "the spreadsheet"
  },
  {
    index: "04",
    title: "The formula is asked for a value",
    detail:
      "The sheet hands over the translated formula, takes a value back, and draws it. It answers the two questions a resolver is asked and nothing more, which is what lets a document block hold a formula on exactly the same terms.",
    source: "the formula"
  }
];

export const RESOLUTION: Grid = {
  columns: ["Order", "The name looks like", "Answered by", "Example"],
  mono: [1, 3],
  rows: [
    ["1", "A name in call position", "The built-in table, which is code", "SUM(…)"],
    ["2", "A project name", "The variables table, which answers with a value or a reference", "perMinuteRate"],
    ["3", "An id", "The thing that id names: a row and a column answer with a cell's value, a sheet answers with a table", "row:9c1 · col:4a7"],
    ["4", "Anything else", "Nobody. The formula answers #NAME? and says the word it could not place", "widgets"]
  ]
};

export const GRAMMAR: readonly { readonly name: string; readonly form: string }[] = [
  { name: "expression", form: "literal | name | call | expression operator expression | ( expression ) | postfix" },
  { name: "postfix", form: "expression [ slice ] | expression . field | expression .{ query } | expression !" },
  { name: "slice", form: "index | start : end   with negative indices and either end omitted" },
  { name: "query", form: "field, field, …  and  ( predicate )  in any order, comma separated" },
  { name: "predicate", form: "expression comparison expression | predicate and predicate | not predicate | ( predicate )" },
  { name: "call", form: "NAME ( expression, … )" },
  { name: "name", form: "a legal word: letters, digits and underscore, never starting with a digit" },
  { name: "literal", form: "number | \"text\" | TRUE | FALSE" }
];

export const PILLARS: readonly Card[] = [
  {
    title: "The formula system does not know what a sheet is",
    detail:
      "It sees a name and asks three questions in order: is this a built-in, is this a variable, is this an id. A sheet is not one of the answers. A spreadsheet reaches formulas the same way anything else does, by handing one over and taking a value back.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A spreadsheet is one caller among several",
    detail:
      "The document editor holds formula items in content blocks for the same reason a cell does. If the language were built around a grid, every other holder would be a special case, and there are already two.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A table is a list and a record at once",
    detail:
      "Bracket it and you take rows, which are records. Dot it and you take a column, which is a list. A record is a table one row tall; a list is a table one column wide. Every slice answers with one of the same kinds, so slicing composes.",
    tag: "built",
    tone: "works"
  },
  {
    title: "Positional and semantic slicing are different gestures",
    detail:
      "Square brackets ask where. Curly braces ask which. Where uses Python's index rules; which uses field names and predicates. Neither can be mistaken for the other while reading.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A big table travels as a reference",
    detail:
      "A value can be a pointer at a resource rather than its rows, and a pointer is its own kind. Resolution is written down with !, so nothing quietly drags a hundred thousand rows into a cell.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A refusal is a value",
    detail:
      "Errors are stored, listed in the Problems panel, and explained in the cell lens. They travel through arithmetic the way a spreadsheet's do.",
    tag: "built",
    tone: "works"
  },
  {
    title: "An edit and its consequences are one change",
    detail:
      "Recalculation rides with the edit that caused it, so undo takes both back and no reader sees a half-computed sheet.",
    tag: "built",
    tone: "works"
  }
];

export const READING: readonly { readonly index: string; readonly title: string; readonly detail: string }[] = [
  { index: "01", title: "Values", detail: "The eleven kinds a formula can answer with, including a reference, and the three that are one shape." },
  { index: "02", title: "Slicing", detail: "Brackets for position, braces for meaning, and what happens when nothing survives." },
  { index: "03", title: "References", detail: "Pointing at a thing instead of carrying it, and the suffix that resolves one." },
  { index: "04", title: "Errors", detail: "Every refusal, what raises it, and what the reader sees." },
  { index: "05", title: "As built", detail: "What runs today, file by file, and the six things it does not do." },
  { index: "06", title: "Variables", detail: "The other half. A formula that cannot say a project's name is a calculator." },
  { index: "07", title: "The build", detail: "Every file that moved to make the rest of these pages true, and why each one had to." }
];

export const RULED: readonly Card[] = [
  {
    title: "A formula is a row with an id",
    detail:
      "Typing = does not decorate a cell, it creates a formula. The cell points at it. That is what makes the same formula reachable from a document block, a variable and a second sheet.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A stored formula addresses ids, not A1 text",
    detail:
      "What a person types is relative to one sheet. What is stored names the cells themselves, so inserting a row above does not silently retarget a formula and a formula can be read from anywhere in the project.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Translation is the spreadsheet's job",
    detail:
      "The sheet turns typed addresses into ids on the way in and draws ids as addresses on the way out. Nothing in the formula system knows either spelling.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "The lock belongs to the spreadsheet",
    detail:
      "$ decides what copy and paste shifts. It never reaches the stored formula, so a locked and an unlocked reference to the same cell are the same formula.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A cell is a row id and a column id",
    detail:
      "Not a single cell id. CellRef in the representation is already the pair, with a note saying never B7, and the reason holds: a cell row exists only where something was written and is removed when the cell is cleared, so its own id is not there to point at. The pair survives a clear, an insert and a move.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Resolution order is built-in, variable, id",
    detail:
      "In that order, and the sheet is not in the list. Anything the three cannot place is #NAME?, which names the word rather than answering zero.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "The capability recomputes",
    detail:
      "One authority computes, everyone reads the same values, and an agent can write a formula with no browser open. Recalculating in whichever client made the edit holds only for as long as every client happens to agree about the answer.",
    tag: "ruled",
    tone: "ruled"
  }
];
