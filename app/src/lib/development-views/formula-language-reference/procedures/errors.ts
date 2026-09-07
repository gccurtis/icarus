import type { Card, Grid } from "$development-views/formula-language-reference/types";

export const TOKENS: Grid = {
  columns: ["Token", "Raised when", "Example", "State"],
  mono: [0, 2],
  rows: [
    ["#DIV/0!", "A division whose divisor works out to zero", "=A1/0", "built"],
    ["#VALUE!", "Arithmetic on something that is not a number", "=B1*2 where B1 is text", "built"],
    ["#NAME?", "A word nothing can place: not an address, not a variable, not a built-in", "=SUMM(D4:D17)", "built"],
    ["#REF!", "An address off the grid, or carried from a cell that already holds #REF!", "=Z99+1", "built"],
    ["#NUM!", "A number that cannot be represented", "=SQRT(0-1)", "built"],
    ["#N/A", "A statistic asked of nothing", "=PERCENTILE(A1:A3, 0.5) over blanks", "built"],
    ["#ERROR!", "An expression that cannot be read at all", "=A1+", "built"],
    ["#CYCLE!", "A formula that depends on itself, directly or through others", "A5 =A6+1 with A6 =A5+1", "built"],
    ["#NULL!", "Declared in the vocabulary and raised by nothing", "—", "unused"],
    ["#FIELD?", "A field the value does not have", "=outages.custmers", "proposed"],
    ["#INDEX!", "A position past the end of a list or table", "=outages[99]", "proposed"],
    ["#SHAPE!", "A gesture the shape does not support", "=outages{name} on a number", "proposed"]
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
      "It catches a refusal and answers with its second argument. It does not catch an unsupported expression, because that is not a refusal: the cell keeps what it had.",
    tag: "built",
    tone: "works"
  },
  {
    title: "Unsupported is not an error",
    detail:
      "A cross-sheet reference and a function that answers with a range are left alone. The cell keeps its stored value and the Problems list stays quiet, because nothing is wrong: the evaluator simply has nothing to say yet.",
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
      "#FIELD? for a field the value does not have, #INDEX! for a position past the end, #SHAPE! for a gesture the shape does not support. Somebody who mistyped a field name should not have to work out which of five meanings of #VALUE! applies. Three tokens join the declared vocabulary.",
    tag: "representation",
    tone: "ruled"
  },
  {
    title: "An error carries where it came from",
    detail:
      "The token, plus the cell that first raised it, so a total three hops from the break can say which cell broke. Carrying the token alone is what every other spreadsheet does and the reason people hunt. There is no error member in the representation, so this is a new field on the holder's state.",
    tag: "representation",
    tone: "ruled"
  },
  {
    title: "A refused formula stores empty",
    detail:
      "With the failure on the holder's state, which is what the representation already intends: there is no error kind because a failure belongs to the holder. Storing the token as text leaves a cell that failed indistinguishable from a cell that says #REF! on purpose. It costs a migration and a state field the store does not have.",
    tag: "representation",
    tone: "ruled"
  }
];
