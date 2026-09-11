const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact elapsed time for the library's Last updated column. */
export const updatedTime = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "NOW";
  if (gap < HOUR) return `${Math.floor(gap / MINUTE)} MIN`;
  if (gap < DAY) return `${Math.floor(gap / HOUR)} HR`;
  if (gap < 30 * DAY) return `${Math.floor(gap / DAY)} D`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
