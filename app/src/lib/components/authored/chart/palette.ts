/**
 * The colours a chart's series are drawn in.
 *
 * **Taken from the role tokens rather than invented.** A chart that reached for
 * a literal colour would be the one surface in the application that does not
 * follow a theme, and swapping Celestial for Cyberpunk would leave it behind.
 * These resolve through the same custom properties everything else does.
 *
 * **Danger and inactive are deliberately absent.** Red means failed everywhere
 * else in this application, and a series that happens to land fifth must not
 * inherit that claim; grey means switched off. Neither is available to a chart
 * for the same reason a chip cannot pick its own colour.
 *
 * Six, in this order, because a categorical scale people can actually tell apart
 * runs out at about six — beyond that the honest answer is to group the tail
 * rather than to add a seventh colour nobody can name.
 */
export const SERIES_COLORS = [
  "var(--color-accent-1-fill)",
  "var(--color-accent-2-fill)",
  "var(--color-interactive-fill)",
  "var(--color-intelligence-fill)",
  "var(--color-success-fill)",
  "var(--color-attention-fill)"
] as const;

/** The colour for the nth series, wrapping rather than running out. */
export const seriesColor = (index: number) =>
  SERIES_COLORS[index % SERIES_COLORS.length];
