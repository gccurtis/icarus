import type { WindowOptions, WindowPiece } from "#capabilities/knowledge/types.js";

const DEFAULT_TARGET = 4000;
const DEFAULT_OVERLAP = 400;

export const DEFAULT_WINDOW_OPTIONS: WindowOptions = {
  targetRunes: DEFAULT_TARGET,
  overlapRunes: DEFAULT_OVERLAP
};

// ─── Sentence scanning ────────────────────────────────────────────────────────

interface Sentence {
  start: number;  // character offset in source string
  end: number;
  chars: number;  // character count (simplified rune count)
}

/**
 * Split text into sentence spans. Sentence boundaries:
 *  - newline (always)
 *  - `.` / `!` / `?` followed by a space or tab
 *  - hard split at exactly targetChars if a sentence runs long
 *
 * The hard-split path mirrors Omega's stream_window.go: the split fires one
 * character AFTER the target, so a sentence of exactly targetChars is never
 * split.
 */
function findSentences(text: string, targetChars: number): Sentence[] {
  const result: Sentence[] = [];
  let sentStart = 0;
  let chars = 0;
  let terminated = false;
  let markPos = 0; // position just after the target'th char (for hard split)

  const flush = (end: number, count: number): void => {
    if (end > sentStart) {
      result.push({ start: sentStart, end, chars: count });
    }
    sentStart = end;
    chars = 0;
    terminated = false;
    markPos = 0;
  };

  for (let i = 0; i < text.length; i++) {
    chars++;

    // Record hard-split boundary position
    if (chars === targetChars) {
      markPos = i + 1;
    } else if (chars > targetChars && markPos > 0) {
      // Hard split: emit up to markPos, restart from there
      flush(markPos, targetChars);
      // Re-process current character in the new sentence
      i = markPos - 1; // -1 because the loop will i++ again
      continue;
    }

    const ch = text[i];

    if (ch === "\n") {
      flush(i + 1, chars);
    } else if (ch === "." || ch === "!" || ch === "?") {
      terminated = true;
    } else if (terminated && (ch === " " || ch === "\t" || ch === "\r")) {
      flush(i + 1, chars);
    } else {
      if (ch !== " " && ch !== "\t") {
        terminated = false;
      }
    }
  }

  // Flush any remaining text
  if (sentStart < text.length) {
    result.push({ start: sentStart, end: text.length, chars });
  }

  return result;
}

// ─── Window assembly ──────────────────────────────────────────────────────────

/**
 * Group sentences into overlapping windows. Each window accumulates sentences
 * until it reaches targetChars, then the overlap tail is carried forward into
 * the next window. Output is byte-identical to what StreamWindower produces
 * for the same text and options.
 */
export function windowText(text: string, opts?: Partial<WindowOptions>): WindowPiece[] {
  const target = opts?.targetRunes ?? DEFAULT_TARGET;
  const overlap = opts?.overlapRunes ?? DEFAULT_OVERLAP;

  if (text.trim().length === 0) {
    return [];
  }

  const sentences = findSentences(text, target);
  const pieces: WindowPiece[] = [];
  let sentIdx = 0;
  let ordinal = 0;

  while (sentIdx < sentences.length) {
    // Accumulate sentences into this window
    let runes = 0;
    let j = sentIdx;

    while (j < sentences.length && runes < target) {
      runes += sentences[j].chars;
      j++;
    }

    if (j === sentIdx) {
      // Degenerate: single sentence exceeds target (shouldn't happen after hard split)
      j = sentIdx + 1;
    }

    const winStart = sentences[sentIdx].start;
    const winEnd = sentences[j - 1].end;
    const winText = text.slice(winStart, winEnd);

    if (winText.trim().length > 0) {
      pieces.push({ start: winStart, end: winEnd, text: winText, ordinal: ordinal++ });
    }

    // Compute overlap tail: walk back from j-1 collecting up to overlapRunes
    let overlapChars = 0;
    let overlapIdx = j;
    while (overlapIdx > sentIdx + 1) {
      const prev = sentences[overlapIdx - 1];
      if (overlapChars + prev.chars > overlap) break;
      overlapChars += prev.chars;
      overlapIdx--;
    }

    // Advance: next window starts at overlapIdx, but not before j to avoid loops
    if (overlapIdx <= sentIdx) {
      sentIdx = j;
    } else {
      sentIdx = overlapIdx;
    }
  }

  return pieces;
}
