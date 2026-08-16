import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  WINDOW_OVERLAP_CHARS,
  WINDOW_TARGET_CHARS
} from "$knowledge/api/shared/ingest/window-text";

/**
 * The tuning numbers live in a YAML file a Convex isolate cannot read, so the
 * ones that decide behaviour are mirrored in the code that uses them. This is
 * what keeps the file authoritative: edit it and this fails.
 */
const knowledge = parse(readFileSync("configuration/knowledge.yaml", "utf8")) as {
  knowledge: { windowing: { targetChars: number; overlapChars: number } };
};

describe("windowing configuration", () => {
  it("mirrors the file the isolate cannot read", () => {
    expect(WINDOW_TARGET_CHARS).toBe(knowledge.knowledge.windowing.targetChars);
    expect(WINDOW_OVERLAP_CHARS).toBe(knowledge.knowledge.windowing.overlapChars);
  });

  it("keeps the overlap well under the target", () => {
    // At half the target every window would be mostly its neighbour, and the
    // corpus would be embedded roughly twice for no extra coverage.
    expect(WINDOW_OVERLAP_CHARS).toBeLessThan(WINDOW_TARGET_CHARS / 2);
  });
});
