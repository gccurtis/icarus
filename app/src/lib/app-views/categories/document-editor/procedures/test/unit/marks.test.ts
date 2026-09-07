import { describe, expect, it } from "vitest";

import {
  colourOps,
  linkOps,
  linksAt,
  linksOn,
  updateLinkOps,
  type Range
} from "$app-views/categories/document-editor/procedures/marks";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import type { Mark, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";

const block = (marks: Mark[] = []): TextBlock => ({
  id: "#b1",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "#a1", kind: "literal", text: "Winter readiness" }],
  display: "Winter readiness",
  marks
});

const body = (marks: Mark[] = []): DocumentBody => ({
  rows: [{ id: "#r1", kind: "blocks", blocks: [block(marks)] }]
});

const range: Range = { blockId: "#b1", from: 0, to: 6 };

const marksOf = (held: DocumentBody): Mark[] => {
  const row = held.rows[0];
  const found = row.kind === "blocks" ? row.blocks[0] : undefined;
  return found?.type === "text" ? found.marks : [];
};

describe("mark replacement batches", () => {
  it("can replace the last foreground repeatedly and invert exactly", () => {
    let held = body();

    for (const color of [
      "var(--token-ink-primary)",
      "var(--token-ink-secondary)",
      "var(--token-ink-muted)",
      "var(--token-color-danger-text)"
    ]) {
      const ops = colourOps(held, [range], { color });
      const next = applyOps(held, ops);
      expect(marksOf(next).at(-1)?.color).toBe(color);
      expect(applyOps(next, invertAll(ops))).toEqual(held);
      held = next;
    }
  });

  it("projects links carried by a left-affine caret", () => {
    const linked = applyOps(body(), linkOps(body(), [range], {
      kind: "url",
      url: "https://example.com/source"
    }));

    expect(linksAt(linked, "#b1", 0)).toEqual([]);
    expect(linksAt(linked, "#b1", 1)).toHaveLength(1);
    expect(linksAt(linked, "#b1", 6)).toHaveLength(1);
    expect(linksAt(linked, "#b1", 7)).toEqual([]);
  });

  it("can replace a last-position link and preserve its occurrence note", () => {
    const first = linkOps(body(), [range], {
      kind: "url",
      url: "https://example.com/one",
      note: "Initial source"
    });
    const linked = applyOps(body(), first);
    const replacement = linkOps(linked, [range], {
      kind: "url",
      url: "https://example.com/two",
      note: "Why this occurrence matters"
    });
    const changed = applyOps(linked, replacement);

    expect(marksOf(changed).at(-1)?.link).toEqual({
      kind: "url",
      url: "https://example.com/two",
      note: "Why this occurrence matters"
    });
    expect(applyOps(changed, invertAll(replacement))).toEqual(linked);
  });

  it("stores default link appearance as ordinary editable styling", () => {
    const linked = applyOps(body(), linkOps(body(), [range], {
      kind: "url",
      url: "https://example.com/source",
      note: "Why this occurrence matters"
    }));
    const mark = marksOf(linked)[0];

    expect(mark.style).toEqual(["underline"]);
    expect(mark.color).toBe("var(--token-color-interactive-text)");

    const placed = linksOn(linked, [range])[0];
    const edited = applyOps(linked, updateLinkOps(placed, {
      kind: "url",
      url: "https://example.com/revised",
      note: "Revised note"
    }));

    expect(marksOf(edited)).toHaveLength(1);
    expect(marksOf(edited)[0].style).toEqual(["underline"]);
    expect(marksOf(edited)[0].link).toEqual({
      kind: "url",
      url: "https://example.com/revised",
      note: "Revised note"
    });
  });
});
