/**
 * Growth between elements, and across all of them.
 *
 * The two figures a column chart is most often being read for and least often
 * actually shows. A reader comparing two bars by eye is estimating a ratio from
 * two lengths, which is the one thing people are reliably bad at — and it is
 * why every presentation tool that serious analysts use draws these instead of
 * making them squint.
 *
 * **Element-over-element, not year-over-year.** The categories on these charts
 * are frequently not periods at all — regions, causes, personas — and calling
 * the figure "year over year" on a chart of regions would be nonsense. Where the
 * categories *are* periods the two coincide, and where they are not the change
 * from one bar to the next is still the thing being asked about.
 */
export type Growth = {
  /** The category this figure sits over. */
  label: string;
  /** Change from the element before it. `undefined` for the first. */
  change?: number;
};

/** The change from each element to the next, as a fraction. */
export const elementOverElement = (
  values: readonly number[],
  labels: readonly string[]
): Growth[] =>
  values.map((value, index) => {
    const previous = values[index - 1];
    // A change from nothing is not a percentage. Dividing by zero here would
    // print Infinity% over a bar, which is worse than printing nothing.
    const change =
      index === 0 || previous === undefined || previous === 0
        ? undefined
        : (value - previous) / previous;
    return { label: labels[index] ?? "", change };
  });

/**
 * Compound growth across the whole series, as a fraction per step.
 *
 * **It returns `undefined` rather than a number whenever the maths is a lie.**
 * CAGR is undefined for a first value of zero, undefined across fewer than two
 * points, and — the one people forget — meaningless when the series crosses
 * zero, because a compound rate implies repeated multiplication and no real
 * rate takes a positive quantity to a negative one. A chart that printed a
 * figure in those cases would be inventing one.
 */
export const cagr = (values: readonly number[]): number | undefined => {
  if (values.length < 2) return undefined;

  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0 || last <= 0) return undefined;

  const steps = values.length - 1;
  return Math.pow(last / first, 1 / steps) - 1;
};

/** A fraction as a signed percentage, or an em dash where there is no figure. */
export const asPercent = (fraction: number | undefined, digits = 1) =>
  fraction === undefined
    ? "—"
    : `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(digits)}%`;
