const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? "" : "s"} ago`;

/** How long ago, in the words a reader uses. Never a clock time. */
export const since = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < 10 * SECOND) return "just now";
  if (gap < MINUTE) return plural(Math.round(gap / SECOND), "second");
  if (gap < HOUR) return plural(Math.max(1, Math.round(gap / MINUTE)), "minute");
  if (gap < DAY) return plural(Math.max(1, Math.round(gap / HOUR)), "hour");
  if (gap < 30 * DAY) return plural(Math.max(1, Math.round(gap / DAY)), "day");
  if (gap < 365 * DAY) return plural(Math.max(1, Math.round(gap / (30 * DAY))), "month");
  return plural(Math.max(1, Math.round(gap / (365 * DAY))), "year");
};

export const seconds = (from: number, to: number): string => {
  const gap = Math.max(0, to - from);
  return gap < MINUTE
    ? `${Math.max(1, Math.round(gap / SECOND))}s`
    : `${Math.floor(gap / MINUTE)}m ${Math.round((gap % MINUTE) / SECOND)}s`;
};
