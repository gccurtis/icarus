import { read } from "$capabilities/store/index.remote";
import type { TableName, TableRow } from "$representation/store/tables";

/**
 * Every row of a table, or none while the read is out.
 *
 * The empty array is deliberate and is what every procedure over it inherits: a
 * board that drew a spinner per band would flash five of them, and each band
 * already says what it looks like with nothing in it. Empty and not-yet-answered
 * look the same here for exactly one screen's worth of time.
 */
export const rowsIn = <T extends TableName>(table: T): readonly TableRow<T>[] => {
  const answer = read({ path: table });
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
  if (gap < HOUR) return `${Math.max(1, Math.round(gap / MINUTE))} minutes ago`;
  if (gap < DAY) return `${Math.round(gap / HOUR)} hours ago`;
  if (gap < 2 * DAY) return "Yesterday";
  if (gap < 30 * DAY) return `${Math.round(gap / DAY)} days ago`;
  return new Date(at).toLocaleDateString();
};
