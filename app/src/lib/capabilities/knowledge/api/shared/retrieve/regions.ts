import { sourceKey } from "$knowledge/types/lattice-source";
import type { ReachedWindow, Region } from "$knowledge/types/retrieval";

/** Windows of one source, in the order the spans have to be walked to merge. */
const bySource = (windows: readonly ReachedWindow[]): Map<string, ReachedWindow[]> => {
  const grouped = new Map<string, ReachedWindow[]>();
  for (const window of windows) {
    const key = sourceKey(window.source);
    const found = grouped.get(key);
    if (found) found.push(window);
    else grouped.set(key, [window]);
  }
  for (const group of grouped.values()) {
    group.sort((left, right) => left.start - right.start || left.end - right.end);
  }
  return grouped;
};

/**
 * The span's text, stitched from the windows covering it.
 *
 * **Verbatim, and that is the whole requirement.** Each window contributes only
 * the characters past where the last one ended, so the result is the source's
 * own characters between `start` and `end` — what is quoted downstream is what
 * the source actually says.
 *
 * Windows are only merged when they overlap or touch, so there is no gap for a
 * span to be missing: every window in one starts at or before the point the
 * previous one reached.
 */
const stitch = (span: readonly ReachedWindow[]): string => {
  let text = "";
  let at = span[0].start;
  for (const window of span) {
    if (window.end <= at) continue;
    text += window.text.slice(at - window.start);
    at = window.end;
  }
  return text;
};

/**
 * Merge what descent reached into the passages it stands for.
 *
 * Per source, windows that **overlap or touch** become one contiguous span.
 *
 * `relevance` is the best covering window's score rather than an average: a span
 * holding one excellent passage should rank on that passage, and averaging would
 * punish it for the ordinary material merged alongside.
 *
 * `density` counts the windows covering the span. It is the retrieval-time
 * cousin of the density on a cluster's windows — both say "the corpus keeps
 * returning here", one about clustering and one about this query.
 */
export const assembleRegions = (windows: readonly ReachedWindow[]): Region[] => {
  const regions: Region[] = [];

  for (const group of bySource(windows).values()) {
    let span: ReachedWindow[] = [];
    let end = 0;

    const emit = () => {
      if (span.length === 0) return;
      regions.push({
        source: span[0].source,
        start: span[0].start,
        end,
        text: stitch(span),
        relevance: Math.max(...span.map((window) => window.score)),
        density: span.length
      });
    };

    for (const window of group) {
      if (span.length > 0 && window.start > end) {
        emit();
        span = [];
      }
      if (span.length === 0) end = window.end;
      span.push(window);
      end = Math.max(end, window.end);
    }
    emit();
  }

  return regions;
};
