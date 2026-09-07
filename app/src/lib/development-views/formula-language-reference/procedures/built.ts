import type { Card, Grid, Stage } from "$development-views/formula-language-reference/types";

export const STAGES: readonly Stage[] = [
  {
    index: "01",
    title: "Read what was typed",
    detail:
      "Text becomes one of three intents: clear, an expression when it opens with =, or a literal. A literal carrying more decimals than the number needs also mints a value format, so 7.00 keeps both zeros.",
    source: "spreadsheet-editor/procedures/values.ts · cells.ts"
  },
  {
    index: "02",
    title: "Translate the addresses",
    detail:
      "E4 becomes the ids of its row and its column, and the dollar signs are lifted out into a mask stored beside the formula. From here on nothing knows the sheet the person was looking at.",
    source: "behavior/spreadsheets/translation.ts"
  },
  {
    index: "03",
    title: "Turn the intent into ops",
    detail:
      "typed() refuses a write under a spill or a merge, then returns the ops that set the cell's value, or its formula and its anchors. Nothing is applied here; a refusal is an answer.",
    source: "spreadsheet-editor/procedures/cells.ts"
  },
  {
    index: "04",
    title: "Apply to a copy",
    detail:
      "withRecalculation applies the edit to a copy of the live sheet with the shared applier, so recalculation sees the sheet as it will be rather than as it was.",
    source: "behavior/spreadsheets/apply-ops.ts"
  },
  {
    index: "05",
    title: "Order the formulas",
    detail:
      "Every formula's addresses are read off the ids it stores, edges are drawn between formula cells only, and Kahn's algorithm gives an order. Whatever will not sort is a ring, and every cell in it is marked.",
    source: "behavior/spreadsheets/formulas.ts"
  },
  {
    index: "06",
    title: "Answer each one",
    detail:
      "Tokenise, parse by precedence, walk the tree. Names go to the built-ins, then the project's variables, then whatever the id names; a cell reads through an overlay, so a formula sees values computed earlier in this same pass.",
    source: "behavior/formulas/evaluate.ts"
  },
  {
    index: "07",
    title: "Append the consequences",
    detail:
      "Only values and failures that actually changed become ops, and they ride with the edit as one change. Undo takes the edit and its consequences back together.",
    source: "behavior/spreadsheets/formulas.ts"
  },
  {
    index: "08",
    title: "Answer it again, with authority",
    detail:
      "The capability applies the same ops, recomputes with every sheet and every variable in the project in reach, mints or updates the formulas rows the cells point at, and writes the back references. What the client computed optimistically and what is stored agree because both ran the same function.",
    source: "capabilities/spreadsheet/api/shared/answering.ts"
  }
];

export const PRECEDENCE: Grid = {
  columns: ["Binding", "Operators", "Notes"],
  mono: [1],
  rows: [
    ["1 · loosest", "or", "Reads as the word"],
    ["2", "and", "Reads as the word"],
    ["3", "not", "A prefix, so not a = b negates the comparison"],
    ["4", "=  <>  <  >  <=  >=", "Answers a logic value; text compares case-insensitively"],
    ["5", "&", "Joins as text, coercing numbers and logic"],
    ["6", "+  −", "Blank reads as zero"],
    ["7", "*  /", "Division by zero refuses"],
    ["8 · tightest", "^", "Right associative"],
    ["prefix", "−  +", "Binds tighter than ^, as Excel does: -A2^2 is 16"],
    ["postfix", "[ ]  . field  .{ }  !  %", "Slice, field, query, resolve, per cent — chained left to right"]
  ]
};

export const CALLS: Grid = {
  columns: ["Signature", "Group", "Does", "State"],
  mono: [0],
  rows: [
    ["SUM(…)", "Maths", "Adds every number it can find, at any depth", "works"],
    ["ROUND(n, digits) · ABS · SQRT · POWER", "Maths", "Round half away from zero, magnitude, root, power", "works"],
    ["MEAN · AVERAGE · MEDIAN · MIN · MAX", "Statistics", "Over nothing, each answers #N/A", "works"],
    ["PERCENTILE(range, p)", "Statistics", "The value below which p of the range falls", "works"],
    ["COUNT(…) · COUNTA(…)", "Lists", "Numbers, and anything that is not empty", "works"],
    ["COUNTIF(range, test) · SUMIF(range, test, sums)", "Lists", "Match a value or a comparison such as \">200\"", "works"],
    ["UNIQUE(list)", "Lists", "The first of each value, in order", "works"],
    ["ISEMPTY(x)", "Lists", "Whether anything survived", "works"],
    ["IF(test, then, else) · IFERROR(value, otherwise) · IFEMPTY(value, otherwise)", "Logic", "Only the branch taken is evaluated", "works"],
    ["AND(…) · OR(…) · NOT(x)", "Logic", "Logic over values, lists and ranges", "works"],
    ["CONCAT · CONCATENATE · UPPER · LOWER · TRIM · LEN", "Text", "Join, case, trim, length", "works"],
    ["DATE(y, m, d) · YEAR · MONTH · DAY", "Dates", "Built from parts rather than from a clock, so the domain stays pure", "works"]
  ]
};

export const FILES: Grid = {
  columns: ["Path", "Lines", "Owns"],
  mono: [0],
  rows: [
    ["types/formulas/", "114", "Expression, Address, Slice, Refusal, Answer, Resolver"],
    ["behavior/formulas/parse.ts", "240", "Precedence, slices, queries, suffixes"],
    ["behavior/formulas/builtins.ts", "241", "Thirty-three functions, three of them lazy"],
    ["behavior/formulas/evaluate.ts", "165", "The walk, the resolution order, the reference ring guard"],
    ["behavior/formulas/slicing.ts", "118", "Positional and semantic slicing over every shape"],
    ["behavior/formulas/values.ts", "131", "Coercions, comparison, shapes"],
    ["behavior/formulas/refusals.ts", "99", "The declared token vocabulary and how a refusal travels"],
    ["behavior/formulas/addresses.ts", "90", "How an id is written inside a formula"],
    ["behavior/formulas/tokens.ts · names.ts", "73", "The tokeniser, and what a legal word is"],
    ["behavior/spreadsheets/formulas.ts", "269", "The sheet's resolver, dependency order, recalculation"],
    ["behavior/spreadsheets/translation.ts", "217", "A1 to ids and back, the locks, and shifting on a fill"],
    ["behavior/spreadsheets/addressing.ts", "188", "Where a cell sits, moved down from the editor"],
    ["capabilities/variables/", "278", "Read, save and remove a project's names"],
    ["capabilities/spreadsheet/api/shared/answering.ts", "180", "Recomputation, the formulas table, the back references"],
    ["spreadsheet-editor/procedures/recalculation.ts", "76", "What the lenses call: facts, drawing, and one edit"],
    ["spreadsheet-editor/context/variables.svelte", "150", "The panel"]
  ]
};

export const GAPS: readonly Card[] = [
  {
    title: "A table does not spill yet",
    detail:
      "A formula can answer with a list, a record or a table, and the body already models a spill. Nothing writes one, so a table lands in its cell and the grid draws it as a count.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "A variable cannot hold a function",
    detail:
      "The value kind exists and a formula row can be pointed at, but calling a name that holds a function answers #NAME?. Nothing yet writes a formula row from a variable.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "Resolution runs where the sheet is, not where the rows are",
    detail:
      "The ruling was that a filter over a hundred thousand rows runs in the capability. It does run there, but over the whole sheet loaded into memory rather than against an index.",
    tag: "large",
    tone: "gap"
  },
  {
    title: "The back references are written and not yet read",
    detail:
      "Every formula's targets are stored on save. Recalculation still rebuilds the graph from the ids in the sheet, which is right for one sheet and wrong at project scale.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "A document cannot hold one yet",
    detail:
      "Nothing in the language knows what a spreadsheet is, and a content block already has a formula item. The wiring on that side is not written, so the claim is true and untested.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "The client sees one sheet",
    detail:
      "A formula naming another sheet is left alone in the browser and answered by the capability. The value is right the moment it is saved, and stale for as long as the edit is unsaved.",
    tag: "small",
    tone: "gap"
  }
];

export const RULED: readonly Card[] = [
  {
    title: "The evaluator moved before it grew",
    detail:
      "The language went to the representation as its own domain, the sheet's addressing went with it, and the capability became the authority. Slicing and variables landed on that rather than on top of the old evaluator.",
    tag: "done",
    tone: "ruled"
  },
  {
    title: "The parser survived",
    detail:
      "Tokeniser, precedence and the function table are recognisably the ones that were there. What changed is where a name goes to become a value, which is the whole point.",
    tag: "done",
    tone: "ruled"
  },
  {
    title: "Emptiness and dates came first",
    detail:
      "ISEMPTY, IFEMPTY and the four date functions are in. DATE is computed from civil parts rather than asked of a clock, because a pure domain cannot read one.",
    tag: "done",
    tone: "ruled"
  }
];

export const REPRESENTATION: readonly Card[] = [
  {
    title: "FormulaValue gained a reference member",
    detail:
      "A pointer is a value kind. VariableValue became an alias for FormulaValue, because the two lists are now the same list.",
    tag: "made",
    tone: "works"
  },
  {
    title: "The cell carries its failure",
    detail:
      "SheetCell.failure holds the token, the word it could not place, and the cell the refusal started in. The value stays empty, so nothing has to tell a failure from text that looks like one.",
    tag: "made",
    tone: "works"
  },
  {
    title: "Three error tokens joined the vocabulary",
    detail:
      "#FIELD?, #INDEX! and #SHAPE!, declared in behavior/formulas/refusals.ts with the other nine and a sentence each.",
    tag: "made",
    tone: "works"
  },
  {
    title: "variables gained a declared type",
    detail:
      "And a description. The capability checks the type against the value's kind before a row is written.",
    tag: "made",
    tone: "works"
  },
  {
    title: "The cell also carries its anchors",
    detail:
      "Not in the approved five. A lock has to be remembered somewhere and the ruling put it outside the formula, so SheetCell.anchors holds one mask per reference. It is the only change to the tree that was not agreed in advance.",
    tag: "unapproved",
    tone: "gap"
  }
];

export const COUNTS = {
  written: 6205,
  created: 43,
  changed: 67,
  deleted: 3,
  calls: 33,
  failures: 12,
  cases: 110,
  suite: 1032
} as const;
