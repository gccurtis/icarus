import { describe, expect, it } from "vitest";
import {
  WINDOW_OVERLAP_CHARS,
  WINDOW_TARGET_CHARS,
  windowText
} from "$knowledge/api/shared/ingest/window-text";

/** Sentences of a known, equal length, so the arithmetic in a failure is readable. */
const SENTENCE_CHARS = 201;
const sentence = (n: number) => `S${String(n).padStart(3, "0")} ${"x".repeat(194)}. `;
const prose = (count: number) =>
  Array.from({ length: count }, (_, n) => sentence(n)).join("");

describe("windowText", () => {
  it("reads nothing out of nothing", () => {
    expect(windowText("")).toEqual([]);
    expect(windowText("   \n  \t ")).toEqual([]);
  });

  it("makes one window of a text below the target", () => {
    const text = prose(3);
    const [only, ...rest] = windowText(text);

    expect(rest).toEqual([]);
    expect(only.start).toBe(0);
    expect(only.end).toBe(text.length);
    expect(only.text).toBe(text);
  });

  it("overlaps adjacent windows, so a claim across a boundary is in both", () => {
    const text = prose(60);
    const windows = windowText(text);

    expect(windows.length).toBeGreaterThan(2);
    for (let i = 1; i < windows.length; i++) {
      const previous = windows[i - 1];
      const current = windows[i];

      expect(current.start).toBeLessThan(previous.end);
      // The shared span is the same characters read from either window, which
      // is the property that matters — not merely that the numbers overlap.
      expect(text.slice(current.start, previous.end)).toBe(
        previous.text.slice(current.start - previous.start)
      );
      expect(text.slice(current.start, previous.end)).toBe(
        current.text.slice(0, previous.end - current.start)
      );
    }
  });

  it("carries back whole sentences up to the overlap, and no more", () => {
    const windows = windowText(prose(60));
    const carried = windows[0].end - windows[1].start;

    expect(carried).toBe(SENTENCE_CHARS);
    expect(carried).toBeLessThanOrEqual(WINDOW_OVERLAP_CHARS);
    expect(carried + SENTENCE_CHARS).toBeGreaterThan(WINDOW_OVERLAP_CHARS);
  });

  it("covers the whole text, in order, with no gap between windows", () => {
    const text = prose(60);
    const windows = windowText(text);

    expect(windows[0].start).toBe(0);
    expect(windows.at(-1)?.end).toBe(text.length);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].start).toBeGreaterThan(windows[i - 1].start);
      expect(windows[i].start).toBeLessThanOrEqual(windows[i - 1].end);
    }
  });

  it("hard-splits a run with no sentence boundary at all", () => {
    // Base64, a pasted cell dump, minified anything. Without this a single
    // "sentence" would be the whole source and one window would be the corpus.
    const windows = windowText("x".repeat(WINDOW_TARGET_CHARS * 2 + 100));

    expect(windows.map((window) => window.end - window.start)).toEqual([
      WINDOW_TARGET_CHARS,
      WINDOW_TARGET_CHARS,
      100
    ]);
    // A hard split leaves no sentence tail to carry, so these abut rather than
    // overlap. The alternative is splitting mid-token twice instead of once.
    expect(windows[1].start).toBe(windows[0].end);
  });

  it("treats a newline as a sentence boundary", () => {
    const windows = windowText("first line\nsecond line\n");

    expect(windows).toHaveLength(1);
    expect(windows[0].text).toBe("first line\nsecond line\n");
  });
});
