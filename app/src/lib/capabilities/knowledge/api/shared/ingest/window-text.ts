/**
 * `knowledge.windowing.targetChars` and `overlapChars` in
 * `configuration/knowledge.yaml`.
 *
 * Mirrored rather than read, for the reason `revisions` mirrors its retention
 * numbers: a Convex isolate has no filesystem. `test/unit/configuration.test.ts`
 * is what fails if the file and these disagree.
 */
export const WINDOW_TARGET_CHARS = 4000;
export const WINDOW_OVERLAP_CHARS = 400;

/** A span of the source, in UTF-16 offsets, and the characters it covers. */
export type TextWindow = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

type Sentence = { start: number; end: number; chars: number };

/**
 * Split text into sentence spans: a newline always ends one, `.`/`!`/`?`
 * followed by whitespace ends one, and a run that reaches the target with
 * neither is split there anyway.
 *
 * The hard split is what stops a source with no punctuation — base64, a pasted
 * cell dump, minified anything — from being one sentence and therefore one
 * window over the whole corpus. It fires one character *after* the target, so a
 * sentence of exactly the target length is never split.
 */
const findSentences = (text: string, targetChars: number): Sentence[] => {
  const sentences: Sentence[] = [];
  let start = 0;
  let chars = 0;
  let terminated = false;
  let mark = 0;

  const flush = (end: number, count: number) => {
    if (end > start) sentences.push({ start, end, chars: count });
    start = end;
    chars = 0;
    terminated = false;
    mark = 0;
  };

  for (let i = 0; i < text.length; i++) {
    chars++;
    if (chars === targetChars) {
      mark = i + 1;
    } else if (chars > targetChars && mark > 0) {
      // Read before flushing, which resets it — resuming from the reset value
      // restarts the scan at 0 and never terminates.
      const split = mark;
      flush(split, targetChars);
      i = split - 1; // The loop's own i++ resumes at the split.
      continue;
    }

    const character = text[i];
    if (character === "\n") flush(i + 1, chars);
    else if (character === "." || character === "!" || character === "?") terminated = true;
    else if (terminated && (character === " " || character === "\t" || character === "\r")) {
      flush(i + 1, chars);
    } else if (character !== " " && character !== "\t") terminated = false;
  }

  if (start < text.length) sentences.push({ start, end: text.length, chars });
  return sentences;
};

/**
 * Cut a source's text into overlapping windows.
 *
 * **The overlap is the point.** A window accumulates sentences to the target,
 * then the next window starts far enough back to carry the last whole sentences
 * that fit in `overlapChars` — so a claim straddling a boundary is inside both
 * windows rather than invisible to each. It is also why retrieval merges windows
 * into regions instead of returning them raw.
 *
 * A window produced by a hard split has no sentence tail to carry, so those two
 * abut. Carrying part of a run that was already cut mid-token would split it
 * twice to hide one bad boundary.
 *
 * Configuration is read here rather than passed in, so no caller can window one
 * source differently from another and make two sources' vectors incomparable.
 */
export const windowText = (text: string): TextWindow[] => {
  if (text.trim().length === 0) return [];

  const sentences = findSentences(text, WINDOW_TARGET_CHARS);
  const windows: TextWindow[] = [];
  let first = 0;

  while (first < sentences.length) {
    let chars = 0;
    let past = first;
    while (past < sentences.length && chars < WINDOW_TARGET_CHARS) {
      chars += sentences[past].chars;
      past++;
    }

    const start = sentences[first].start;
    const end = sentences[past - 1].end;
    if (text.slice(start, end).trim().length > 0) {
      windows.push({ start, end, text: text.slice(start, end) });
    }

    // A window that already ends at the end of the text has no successor.
    // Without this the overlap below emits a final window that is a suffix of
    // the one before it — the same text embedded twice, as its own node.
    if (past >= sentences.length) break;

    // Walk back over whole sentences while they fit in the overlap, never past
    // the window's own first sentence — that is what guarantees progress.
    let carried = 0;
    let next = past;
    while (next > first + 1 && carried + sentences[next - 1].chars <= WINDOW_OVERLAP_CHARS) {
      carried += sentences[next - 1].chars;
      next--;
    }
    first = next > first ? next : past;
  }

  return windows;
};
