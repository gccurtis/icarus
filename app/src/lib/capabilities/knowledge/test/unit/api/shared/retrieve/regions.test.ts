import { describe, expect, it } from "vitest";
import { assembleRegions } from "$knowledge/api/shared/retrieve/regions";
import { windowText } from "$knowledge/api/shared/ingest/window-text";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import type { ReachedWindow } from "$knowledge/types/retrieval";
import type { Id } from "$convex/_generated/dataModel";
import { paragraph } from "$knowledge/test/fixture";

const notes = { kind: "document", id: "documents:1" as Id<"documents"> } satisfies LatticeSource;
const memo = { kind: "document", id: "documents:2" as Id<"documents"> } satisfies LatticeSource;

/** A span of a source's text, exactly as ingestion stored it, with a score attached. */
const reached = (
  source: LatticeSource,
  body: string,
  start: number,
  end: number,
  score: number
): ReachedWindow => ({ source, start, end, text: body.slice(start, end), score });

describe("assembleRegions", () => {
  it("merges overlapping windows of one source and leaves another source alone", () => {
    const body = paragraph(1);
    const other = paragraph(2);

    const regions = assembleRegions([
      reached(notes, body, 300, 700, 0.8),
      reached(memo, other, 0, 400, 0.7),
      reached(notes, body, 0, 400, 0.6)
    ]);

    // Windows overlap by design, so returning them raw would return the same
    // sentences twice and spend the budget on duplicates.
    expect(regions).toHaveLength(2);
    expect(regions.find((region) => region.source.id === notes.id)).toMatchObject({
      start: 0,
      end: 700,
      density: 2
    });
  });

  it("merges windows that only touch", () => {
    const body = paragraph(1);

    const [region] = assembleRegions([
      reached(notes, body, 0, 400, 0.6),
      reached(notes, body, 400, 800, 0.6)
    ]);

    expect(region).toMatchObject({ start: 0, end: 800, density: 2 });
  });

  it("leaves a gap between windows that neither overlap nor touch", () => {
    const body = paragraph(1);

    const regions = assembleRegions([
      reached(notes, body, 0, 400, 0.6),
      reached(notes, body, 500, 900, 0.6)
    ]);

    expect(regions.map((region) => [region.start, region.end])).toEqual([
      [0, 400],
      [500, 900]
    ]);
  });

  it("ranks a region on its best covering window, never on the average", () => {
    const body = paragraph(1);

    const [region] = assembleRegions([
      reached(notes, body, 0, 400, 0.9),
      reached(notes, body, 300, 700, 0.4)
    ]);

    // A span holding one excellent passage should rank on that passage.
    // Averaging punishes it for the ordinary material merged alongside.
    expect(region.relevance).toBe(0.9);
  });

  it("quotes the source verbatim", () => {
    // Long enough to window into several overlapping spans, so the region is
    // stitched out of them rather than being one window returned whole.
    const body = [1, 2, 3, 4, 5, 6].map(paragraph).join("\n");
    const spans = windowText(body);
    expect(spans.length).toBeGreaterThan(2);

    const [region] = assembleRegions(
      spans.map((span) => reached(notes, body, span.start, span.end, 0.6))
    );

    // Whatever is quoted downstream must be what the source actually says —
    // no summarizing, no trimming to a sentence boundary.
    expect(region.text).toBe(body.slice(region.start, region.end));
    expect(region.text).toHaveLength(region.end - region.start);
  });

  it("counts a window contained in another as density and nothing else", () => {
    const body = paragraph(1);

    const [region] = assembleRegions([
      reached(notes, body, 0, 800, 0.6),
      reached(notes, body, 200, 400, 0.7)
    ]);

    expect(region.text).toBe(body.slice(0, 800));
    expect(region).toMatchObject({ start: 0, end: 800, density: 2, relevance: 0.7 });
  });

  it("assembles nothing from nothing", () => {
    expect(assembleRegions([])).toEqual([]);
  });
});
