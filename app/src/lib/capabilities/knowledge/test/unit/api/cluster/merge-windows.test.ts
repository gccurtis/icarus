import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { mergeWindows } from "$knowledge/api/cluster/merge-windows";
import type { LatticeSource } from "$knowledge/types/lattice-source";

const notes: LatticeSource = { kind: "document", id: "documents:1" as Id<"documents"> };
const deck: LatticeSource = { kind: "slides", id: "slideDecks:1" as Id<"slideDecks"> };

const span = (source: LatticeSource, start: number, end: number, density = 1) => ({
  source,
  start,
  end,
  density
});

describe("mergeWindows", () => {
  it("joins two overlapping spans of one source and sums their density", () => {
    expect(mergeWindows([span(notes, 0, 100), span(notes, 80, 200)])).toEqual([
      span(notes, 0, 200, 2)
    ]);
  });

  it("keeps two distant spans of one source apart", () => {
    // A document discussing a topic in two sections is two contributions, and
    // joining them would claim coverage of everything in between.
    expect(mergeWindows([span(notes, 0, 100), span(notes, 900, 1000)])).toEqual([
      span(notes, 0, 100),
      span(notes, 900, 1000)
    ]);
  });

  it("never joins across sources, whatever the offsets say", () => {
    // Offsets index a source's own text; the same range in two documents is two
    // unrelated passages.
    expect(mergeWindows([span(notes, 0, 100), span(deck, 0, 100)])).toEqual([
      span(notes, 0, 100),
      span(deck, 0, 100)
    ]);
  });

  it("carries the density already accumulated below it", () => {
    expect(mergeWindows([span(notes, 0, 100, 4), span(notes, 50, 120, 3)])).toEqual([
      span(notes, 0, 120, 7)
    ]);
  });

  it("orders its output by source and offset, so a rebuild produces the same row", () => {
    expect(mergeWindows([span(notes, 300, 400), span(deck, 0, 10), span(notes, 0, 10)])).toEqual([
      span(notes, 0, 10),
      span(notes, 300, 400),
      span(deck, 0, 10)
    ]);
  });
});
