import type { Card, Grid } from "$authored-components/reference";

export const TOKENS: Grid = {
  columns: ["Token", "Raised when", "Example", "State"],
  mono: [0, 2],
  rows: [
    ["#DIV/0!", "A division whose divisor works out to zero", "=A1/0", "built"],
    ["#VALUE!", "Arithmetic on something that is not a number", "=B1*2 where B1 is text", "built"],
    ["#NAME?", "A word nothing can place: not an address, not a variable, not a built-in", "=SUMM(D4:D17)", "built"],
    ["#REF!", "An address off the grid, or carried from a cell that already holds #REF!", "=Z99+1", "built"],
    ["#NUM!", "A number that cannot be represented", "=SQRT(0-1)", "built"],
    ["#N/A", "MEAN, MEDIAN, MIN, MAX or PERCENTILE asked of no numbers at all. SUM and COUNT answer 0 instead", "=PERCENTILE(A1:A3, 0.5) over blanks", "built"],
    ["#ERROR!", "An expression that cannot be read at all", "=A1+", "built"],
    ["#CYCLE!", "A formula that depends on itself, directly or through others, or a reference ring that returns to where it started", "A5 =A6+1 with A6 =A5+1", "built"],
    ["#NULL!", "Declared in the vocabulary and raised by nothing", "—", "unused"],
    ["#FIELD?", "A field the value does not have", "=outages.custmers", "built"],
    ["#INDEX!", "A position past the end of a list or table", "=outages[99]", "built"],
    ["#SHAPE!", "A gesture the shape does not support", "=total.{name} where total is a number", "built"]
  ]
};

export const BEHAVIOUR: readonly Card[] = [
  {
    title: "An error is a value that travels",
    detail:
      "Reading a cell that holds an error raises the same error in the reader. That is why one broken cross-sheet reference turned a column of totals red the moment evaluation was switched on, and why the seed was changed rather than the rule.",
    tag: "built",
    tone: "works"
  },
  {
    title: "IFERROR is the only thing that stops it",
    detail:
      "It catches a refusal and answers with its second argument, which is evaluated only when the first refuses. Nothing else in the language stops a refusal travelling.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A sheet the browser has not loaded is left alone",
    detail:
      "There is no unsupported any more: every expression the language can read is answered. The one thing recalculation skips is a formula naming a sheet the browser does not hold. The cell keeps its stored value, the Problems list stays quiet, and the capability answers it with every sheet in the project in reach.",
    tag: "built",
    tone: "works"
  },
  {
    title: "Every refusal has a place to be read",
    detail:
      "The Problems section of the Formulas panel lists them in sheet order, the cell draws the token in the danger tone, and the error lens says what it means in a sentence and offers the expression that caused it.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A refusal names the word it could not place",
    detail:
      "For #NAME?, the explanation quotes the name. That is the only error where the message can be specific without guessing, and it is the one people hit most.",
    tag: "built",
    tone: "works"
  },
  {
    title: "A cycle marks every cell in the ring",
    detail:
      "The sort leaves the whole ring unordered, and each of its cells is marked rather than one arbitrary member. A reader who lands on any of them sees the same claim.",
    tag: "built",
    tone: "works"
  }
];

export const RULED: readonly Card[] = [
  {
    title: "Slicing failures get their own tokens",
    detail:
      "#FIELD? for a field the value does not have, #INDEX! for a position past the end, #SHAPE! for a gesture the shape does not support. Somebody who mistyped a field name should not have to work out which of five meanings of #VALUE! applies. The three tokens are in the declared vocabulary now, and the slicing that needed them raises each one.",
    tag: "made",
    tone: "ruled"
  },
  {
    title: "An error carries where it came from",
    detail:
      "The token, plus the cell that first raised it, so a total three hops from the break can say which cell broke. Carrying the token alone is what every other spreadsheet does and the reason people hunt. The field is made: SheetCell.failure holds the token, the word it could not place, and the origin cell.",
    tag: "made",
    tone: "ruled"
  },
  {
    title: "A refused formula stores empty",
    detail:
      "With the failure beside it on the cell, which is what the representation already intends: there is no error kind because a failure belongs to the holder. Storing the token as text would leave a cell that failed indistinguishable from a cell that says #REF! on purpose. It is made, and the cell is the holder.",
    tag: "made",
    tone: "ruled"
  }
];
