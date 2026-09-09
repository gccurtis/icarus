import type { TableName, TableRow } from "$representation/store/tables";
import { readStore } from "$model/client/workspace-state";

/**
 * Every row of a table, or none while the read is out.
 *
 * The empty array is deliberate and is what every procedure over it inherits: a
 * board that drew a spinner per band would flash five of them, and each band
 * already says what it looks like with nothing in it. Empty and not-yet-answered
 * look the same here for exactly one screen's worth of time.
 */
export const rowsIn = <T extends TableName>(table: T): readonly TableRow<T>[] => {
  const answer = readStore(table);
  if (!answer.ready) return [];

  const found = answer.current;
  // `Found` is a union over every table for the reader to switch on, and the
  // narrowing that proves this row came from `table` is the check beside it.
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, in the words the board reads in. */
export const since = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < HOUR) {
    const minutes = Math.max(1, Math.round(gap / MINUTE));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (gap < DAY) {
    const hours = Math.max(1, Math.round(gap / HOUR));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (gap < 2 * DAY) return "Yesterday";
  if (gap < 30 * DAY) return `${Math.round(gap / DAY)} days ago`;
  return new Date(at).toLocaleDateString();
};

/** Compact relative time for a flank, where the exact moment remains in the title. */
export const shortSince = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "now";
  if (gap < HOUR) return `${Math.max(1, Math.round(gap / MINUTE))}m`;
  if (gap < DAY) return `${Math.max(1, Math.round(gap / HOUR))}h`;

  const days = Math.max(1, Math.round(gap / DAY));
  if (days < 60) return `${days}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
};
