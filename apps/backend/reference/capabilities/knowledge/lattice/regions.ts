import type { KnowledgeWindow, Region } from "#capabilities/knowledge/types.js";

export const DEFAULT_CHAR_BUDGET = 4000;
const DENSE_OVERAGE_FACTOR = 1.25;

/**
 * Given a scored set of retrieved windows, assemble a list of Regions:
 *  1. Merge overlapping windows from the same source into contiguous spans.
 *  2. Sort by (relevance DESC, density DESC).
 *  3. Admit spans under charBudget, with a 25% overage allowed for dense
 *     spans (density ≥ 2).
 *  4. The top-scoring region is always admitted even if it alone exceeds budget.
 */
export function assembleRegions(
  windows: KnowledgeWindow[],
  scores: Map<string, number>,
  charBudget: number
): Region[] {
  if (windows.length === 0) return [];

  // Group by source
  const bySource = new Map<string, KnowledgeWindow[]>();
  for (const w of windows) {
    let group = bySource.get(w.sourceId);
    if (!group) {
      group = [];
      bySource.set(w.sourceId, group);
    }
    group.push(w);
  }

  const candidates: Region[] = [];

  for (const [sourceId, srcWins] of bySource) {
    // Sort windows by start position
    srcWins.sort((a, b) => a.start - b.start);

    // Merge overlapping spans
    interface Span {
      start: number;
      end: number;
      windows: KnowledgeWindow[];
    }

    const spans: Span[] = [];
    let current: Span | null = null;

    for (const w of srcWins) {
      if (!current || w.start > current.end) {
        // New span
        current = { start: w.start, end: w.end, windows: [w] };
        spans.push(current);
      } else {
        // Extend current span
        if (w.end > current.end) current.end = w.end;
        current.windows.push(w);
      }
    }

    // Build regions from spans
    for (const span of spans) {
      const bestScore = Math.max(...span.windows.map((w) => scores.get(w.id) ?? 0));
      const density = span.windows.length;
      const label = span.windows[0].label;

      // Reconstruct text from ordered windows
      const ordered = [...span.windows].sort((a, b) => a.start - b.start);
      // Find the window that covers the span's start to end
      // Text is reconstructed by finding non-overlapping runs
      let text = "";
      let textPos = span.start;
      for (const w of ordered) {
        if (w.start > textPos) {
          // Gap (shouldn't happen in normal windows, but be safe)
          text += w.text;
          textPos = w.end;
        } else if (w.end > textPos) {
          // Partial or full contribution
          const sliceFrom = textPos - w.start;
          text += w.text.slice(sliceFrom);
          textPos = w.end;
        }
      }

      candidates.push({
        sourceId,
        label,
        start: span.start,
        end: span.end,
        text: text || ordered[0].text,
        relevance: bestScore,
        density
      });
    }
  }

  // Sort by relevance desc, then density desc
  candidates.sort((a, b) =>
    b.relevance !== a.relevance ? b.relevance - a.relevance : b.density - a.density
  );

  // Admit within budget
  const admitted: Region[] = [];
  let usedChars = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const regionLen = c.text.length;
    const isDense = c.density >= 2;
    const effectiveBudget = isDense ? charBudget * DENSE_OVERAGE_FACTOR : charBudget;

    if (i === 0) {
      // Top-scoring region always admitted
      admitted.push(c);
      usedChars += regionLen;
      continue;
    }

    if (usedChars + regionLen <= effectiveBudget) {
      admitted.push(c);
      usedChars += regionLen;
    }
  }

  return admitted;
}
