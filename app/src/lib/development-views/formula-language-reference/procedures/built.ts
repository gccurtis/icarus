import type { Card, Grid, Stage } from "$development-views/formula-language-reference/types";

export const STAGES: readonly Stage[] = [
  {
    index: "01",
    title: "Read what was typed",
    detail:
      "Text becomes one of three intents: clear, an expression when it opens with =, or a literal. A literal carrying more decimals than the number needs also mints a value format, so 7.00 keeps both zeros.",
    source: "procedures/values.ts · procedures/cells.ts"
  },
  {
    index: "02",
    title: "Turn the intent into ops",
    detail: "typed() refuses a write under a spill or a merge, then returns the ops that set the cell's value or its expression. Nothing is applied here; a refusal is an answer.",
    source: "procedures/cells.ts"
  },
  {
    index: "03",
    title: "Apply to a copy",
    detail: "withRecalculation applies the edit to a copy of the live sheet with the shared applier, so recalculation sees the sheet as it will be rather than as it was.",
    source: "representation/data/behavior/spreadsheets/apply-ops.ts"
  },
  {
    index: "04",
    title: "Order the formulas",
    detail:
      "Every formula cell's addresses are collected, edges are drawn between formula cells only, and Kahn's algorithm gives an order. Whatever will not sort is a cycle and is marked, not evaluated.",
    source: "procedures/evaluate.ts"
  },
  {
    index: "05",
    title: "Evaluate each one",
    detail: "Tokenise, parse by precedence, walk the tree. A cell reads through an overlay, so a formula sees values computed earlier in this same pass rather than last pass's.",
    source: "procedures/evaluate.ts"
  },
  {
    index: "06",
    title: "Append the consequences",
    detail: "Only values that actually changed become ops, and they ride with the edit as one change. Undo takes the edit and its consequences back together.",
    source: "procedures/evaluate.ts"
  },
  {
    index: "07",
    title: "Persist",
    detail: "The runtime applies the change set optimistically and flushes it; the capability diffs before and after and writes the sheetCells rows that moved.",
    source: "model/client/spreadsheet-runtimes · capabilities/spreadsheet"
  }
];

export const PRECEDENCE: Grid = {
  columns: ["Binding", "Operators", "Notes"],
  mono: [1],
  rows: [
    ["1 · loosest", "=  <>  <  >  <=  >=", "Answers a logic value; text compares case-insensitively"],
    ["2", "&", "Joins as text, coercing numbers and logic"],
    ["3", "+  −", "Blank reads as zero"],
    ["4", "*  /", "Division by zero refuses"],
    ["5 · tightest", "^", "Right associative"],
    ["prefix", "−  +", "Binds tighter than ^, as Excel does: -A2^2 is 16"],
    ["postfix", "%", "Divides by a hundred"]
  ]
};

export const CALLS: Grid = {
  columns: ["Signature", "Group", "Does", "State"],
  mono: [0],
  rows: [
    ["SUM(range)", "Maths", "Adds every number, ignoring text and blanks", "works"],
    ["ROUND(n, digits)", "Maths", "Rounds half away from zero", "works"],
    ["ABS(n) · SQRT(n) · POWER(n, e)", "Maths", "Magnitude, root, power", "works"],
    ["MEAN(range) · MEDIAN(range)", "Statistics", "Average and middle", "works"],
    ["PERCENTILE(range, p)", "Statistics", "The value below which p of the range falls", "works"],
    ["MIN(range) · MAX(range)", "Statistics", "Smallest and largest", "works"],
    ["COUNT(range) · COUNTA(range)", "List and range", "Numbers, and anything at all", "works"],
    ["COUNTIF(range, test) · SUMIF(range, test, sums)", "List and range", "Match a value or a comparison such as \">200\"", "works"],
    ["IF(test, then, else) · IFERROR(value, otherwise)", "Logic", "Only the branch taken is evaluated", "works"],
    ["AND(…) · OR(…) · NOT(…)", "Logic", "Logic over values and ranges", "works"],
    ["CONCAT(…) · UPPER · LOWER · TRIM · LEN", "Text", "Join, case, trim, length", "works"],
    ["FILTER(range, test) · UNIQUE(range)", "List and range", "Offered by the builder; answer with a range, which this evaluator will not write", "offered"]
  ]
};

export const FILES: Grid = {
  columns: ["Path", "Lines", "Status", "Owns"],
  mono: [0],
  rows: [
    ["procedures/evaluate.ts", "546", "new", "Tokeniser, parser, evaluator, dependency order, recalculation"],
    ["procedures/test/unit/evaluate.test.ts", "113", "new", "Eight cases: arithmetic, functions, errors, unsupported, order, cycles, one change"],
    ["components/cell-head.svelte", "158", "new", "The editable value or expression, reference picking, F4"],
    ["procedures/picking.ts", "19", "new", "The channel a lens opens so a grid click writes an address"],
    ["procedures/anchoring.ts", "24", "new", "What F4 cycles: A1 → $A$1 → A$1 → $A1"],
    ["procedures/builtins.ts", "75", "changed", "The eleven functions the builder offers"],
    ["procedures/references.ts", "146", "changed", "Precedents, dependents, problems, sheet-qualified references"],
    ["procedures/formulas.ts", "54", "changed", "The rows the Formulas panel lists"],
    ["context/formulas.svelte", "191", "changed", "The panel and the function builder modal"],
    ["content/sheet.svelte and nine lenses", "—", "changed", "Every apply now carries recalculation"]
  ]
};

export const GAPS: readonly Card[] = [
  {
    title: "The formulas table is untouched",
    detail:
      "A formula lives as text on the cell. The representation already has a formulas table with an id, a representation string and a usedBy list, and SheetCell.formulaId to point at it. Nothing writes either.",
    tag: "large",
    tone: "gap"
  },
  {
    title: "No back references",
    detail:
      "dataBackReferences exists to record what each formula points at, which is the stored dependency graph. Today the graph is rebuilt from text on every edit: fine for one sheet of forty formulas, wrong at project scale.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "Names do not resolve",
    detail: "Any bare name answers #NAME?. Variables are read by the function builder for display and by nothing else, and the variables table has no rows at all.",
    tag: "large",
    tone: "gap"
  },
  {
    title: "Another sheet is left alone",
    detail:
      "='Hardening cost model'!E10 parses and the precedent row opens that sheet, but the value is not computed. FormulaValue already models a range as a resource id and a pair of corners.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "No lists, records or tables",
    detail: "Everything on the Values, Slicing and References pages is a proposal. The evaluator answers with a number, text, logic or an error, and nothing else.",
    tag: "large",
    tone: "gap"
  },
  {
    title: "Addresses are text, not identity",
    detail:
      "A1 in the stored text is resolved against the grid at evaluation. Insert a row above and the same text names a different cell, because nothing rewrites the formula.",
    tag: "large",
    tone: "gap"
  },
  {
    title: "It runs in the view layer",
    detail: "Recalculation is a procedure the views call, so it is per sheet and per browser. Nothing recomputes on the server.",
    tag: "medium",
    tone: "gap"
  },
  {
    title: "The built-in set is too small",
    detail:
      "Twenty-five names cover arithmetic, five statistics, some logic and a little text. There is nothing for dates, nothing that takes a table, no way to ask whether a result is empty, and no text search. Every page in this suite assumes functions this table does not have.",
    tag: "medium",
    tone: "gap"
  }
];

export const RULED: readonly Card[] = [
  {
    title: "The evaluator moves before it grows",
    detail:
      "Capability, formulas table and ids first; slicing and variables after. They then land on a design that will hold them, and the editor keeps working throughout because the ops language does not change. Growing first would write every line against a shape that has to be replaced.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "The parser survives",
    detail:
      "Tokeniser, precedence and the function table are the parts worth keeping. What changes is where a name goes to become a value, which is the one thing this evaluator does that belongs somewhere else. Starting again is cleaner on paper and throws away the eight cases that already hold.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Emptiness and dates are the next built-ins",
    detail:
      "ISEMPTY, and the date parts a formula needs to ask a date anything. Both are small, both are asked for by pages in this suite, and neither waits on slicing. The table functions come after, because every one of them needs the value kinds to land first.",
    tag: "ruled",
    tone: "ruled"
  }
];

export const REPRESENTATION: readonly Card[] = [
  {
    title: "FormulaValue gains a reference member",
    detail:
      "A formula can answer with a pointer today only if a cell is written directly, because a cell stores a VariableValue while a formula produces a FormulaValue. A reference is its own kind and a big answer travels as one, so the member has to exist.",
    tag: "approved · new member",
    tone: "ruled"
  },
  {
    title: "The holder's state carries a failure",
    detail:
      "A refused formula stores empty rather than the token as text, which means the state beside the value has to say what failed. There is no error kind, by design, and this is the field that replaces one.",
    tag: "approved · new field",
    tone: "ruled"
  },
  {
    title: "That failure names the cell it came from",
    detail:
      "So a total three hops from the break can point at the break. It rides on the same state field rather than adding a second one.",
    tag: "approved · new field",
    tone: "ruled"
  },
  {
    title: "Three error tokens join the vocabulary",
    detail:
      "#FIELD?, #INDEX! and #SHAPE!. The vocabulary is declared rather than inferred, which is why #NULL! can sit in it raised by nothing, and why adding three is an edit rather than an accident.",
    tag: "approved · vocabulary",
    tone: "ruled"
  },
  {
    title: "variables gains a declared type",
    detail:
      "The value must satisfy it, so a formula can be checked before it runs. The table has name, value and provenance today and nothing that says what a name is allowed to hold.",
    tag: "approved · new field",
    tone: "ruled"
  },
  {
    title: "Nothing else has to change",
    detail:
      "The formulas table, dataBackReferences, SheetCell.formulaId, FormulaUse and CellRef are already the shapes this design needs. The work against them is wiring rather than modelling, which is the point of having written the pages first.",
    tag: "unchanged",
    tone: "works"
  }
];

export const COUNTS = {
  written: 860,
  created: 5,
  changed: 5,
  calls: 25,
  failures: 8,
  cases: 8,
  suite: 930
} as const;
