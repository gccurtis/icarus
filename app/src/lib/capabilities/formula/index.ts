/**
 * The formula engine's built-in vocabulary.
 *
 * A capability rather than a constant, so the list the Function Builder shows and
 * the list the evaluator honours cannot drift apart. The categories are what the
 * builder groups its result rows by — a taxonomy that is scanned rather than
 * operated, which is why it is on the row and not on a filter chip.
 */
import { read, type Read } from "$capabilities/read.svelte";

export type Builtin = {
  readonly id: string;
  /** As it is written at a call site, arguments and all. */
  readonly signature: string;
  readonly category: "Maths" | "Statistics" | "Text" | "List and range" | "Logic";
  readonly description: string;
};

const BUILTINS: readonly Builtin[] = [
  {
    id: "b-sum",
    signature: "SUM(range)",
    category: "Maths",
    description: "Adds every number in a range, ignoring text and blanks. SUM(A1:A20)"
  },
  {
    id: "b-round",
    signature: "ROUND(n, digits)",
    category: "Maths",
    description: "Rounds to a number of decimal places, half away from zero. ROUND(1.845, 2) → 1.85"
  },
  {
    id: "b-abs",
    signature: "ABS(n)",
    category: "Maths",
    description: "The magnitude, sign discarded. ABS(-1842) → 1842"
  },
  {
    id: "b-mean",
    signature: "MEAN(range)",
    category: "Statistics",
    description: "The arithmetic mean of the numbers in a range. Blanks are not zeros."
  },
  {
    id: "b-median",
    signature: "MEDIAN(range)",
    category: "Statistics",
    description: "The middle value, or the mean of the two middles when the count is even."
  },
  {
    id: "b-pct",
    signature: "PERCENTILE(range, p)",
    category: "Statistics",
    description: "The value below which p of the range falls. PERCENTILE(outages, 0.95)"
  },
  {
    id: "b-concat",
    signature: "CONCAT(a, b, …)",
    category: "Text",
    description: "Joins its arguments end to end, numbers rendered as written."
  },
  {
    id: "b-upper",
    signature: "UPPER(text)",
    category: "Text",
    description: "Upper-cases every letter. UPPER(\"feeder 12\") → \"FEEDER 12\""
  },
  {
    id: "b-count",
    signature: "COUNT(range)",
    category: "List and range",
    description: "How many values a range holds. Blanks are not counted."
  },
  {
    id: "b-filter",
    signature: "FILTER(range, test)",
    category: "List and range",
    description: "The rows of a range for which the test is true. Spills."
  },
  {
    id: "b-if",
    signature: "IF(test, then, else)",
    category: "Logic",
    description: "Evaluates one branch or the other. Never both."
  }
];

export const builtins = (): Read<readonly Builtin[]> => read(BUILTINS, "formula.builtins");
