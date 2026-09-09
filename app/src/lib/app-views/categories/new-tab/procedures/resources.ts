import type {
  ProjectResourceIndex,
  ProjectResourceKind
} from "$capabilities/project-resources/index.remote";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The metadata a launcher needs to search and open a represented resource. */
export type LauncherResource = {
  readonly id: string;
  readonly name: string;
  readonly kind: ProjectResourceKind;
  readonly updatedAt: number;
  readonly updated: string;
  readonly updatedBy: string;
};

/** One timestamp, phrased for the compact search row and Recent card. */
export const ageOf = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "just now";
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

/**
 * Project Resources is the source of truth for both launcher lists. Keeping the
 * represented id on the projection is what makes every card open a row that
 * the destination editor can actually resolve.
 */
export const resourcesOf = (
  indexed: ProjectResourceIndex | undefined,
  now: number
): readonly LauncherResource[] =>
  (indexed?.resources ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    updatedAt: row.updatedAt,
    updated: ageOf(row.updatedAt, now),
    updatedBy: row.updatedByName
  }));

/** Recent is changed-recently, with a batch-safe single card for each manager-only family. */
export const recentsOf = (
  indexed: ProjectResourceIndex | undefined,
  now: number,
  limit = 8
): readonly LauncherResource[] => {
  const representedManagerKinds = new Set<ProjectResourceKind>(["file"]);
  const seenManagerKinds = new Set<ProjectResourceKind>();
  return resourcesOf(indexed, now)
    .toSorted((left, right) =>
      right.updatedAt - left.updatedAt || left.name.localeCompare(right.name)
    )
    .filter((row) => {
      if (!representedManagerKinds.has(row.kind)) return true;
      if (seenManagerKinds.has(row.kind)) return false;
      seenManagerKinds.add(row.kind);
      return true;
    })
    .slice(0, Math.max(0, limit));
};
