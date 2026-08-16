import type { LatticeWindow } from "$knowledge/types/lattice-node";
import { sourceKey } from "$knowledge/types/lattice-source";

/**
 * A cluster's windows: its members' spans, joined where they genuinely are one
 * span.
 *
 * **Two windows join when — and only when — they name the same source and their
 * ranges overlap.** The joined window spans the union and its density is the
 * sum, and density is what makes a cluster legible without re-reading a word:
 * scattered density-1 windows are a thin thematic link, one dense window over a
 * single document is that document's argument.
 *
 * Windows from one source that do **not** overlap stay separate. A document
 * discussing a topic in two distant sections is two contributions, and joining
 * them would claim coverage of everything between.
 *
 * The output is ordered by source and offset so that re-clustering an unchanged
 * grouping writes an unchanged row.
 */
export const mergeWindows = (windows: readonly LatticeWindow[]): LatticeWindow[] => {
  const bySource = new Map<string, LatticeWindow[]>();
  for (const window of windows) {
    const key = sourceKey(window.source);
    const group = bySource.get(key);
    if (group) group.push(window);
    else bySource.set(key, [window]);
  }

  const merged: LatticeWindow[] = [];
  for (const [, group] of [...bySource].sort(([left], [right]) => (left < right ? -1 : 1))) {
    group.sort((left, right) => left.start - right.start || left.end - right.end);
    for (const window of group) {
      const open = merged.at(-1);
      if (open && sourceKey(open.source) === sourceKey(window.source) && window.start < open.end) {
        merged[merged.length - 1] = {
          source: open.source,
          start: open.start,
          end: Math.max(open.end, window.end),
          density: open.density + window.density
        };
      } else {
        merged.push({ ...window });
      }
    }
  }

  return merged;
};
