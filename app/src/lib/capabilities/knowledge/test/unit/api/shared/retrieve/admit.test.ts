import { describe, expect, it } from "vitest";
import { admit, CHAR_BUDGET, TOP_K } from "$knowledge/api/shared/retrieve/admit";
import type { Id } from "$convex/_generated/dataModel";
import type { Region } from "$knowledge/types/retrieval";

let next = 0;

/** A region of a given size and standing, with text nothing reads but the budget. */
const aRegion = (region: { chars: number; relevance: number; density?: number }): Region => ({
  source: { kind: "document", id: `documents:${++next}` as Id<"documents"> },
  start: 0,
  end: region.chars,
  text: "x".repeat(region.chars),
  relevance: region.relevance,
  density: region.density ?? 1
});

const sizeOf = (regions: readonly Region[]) =>
  regions.reduce((total, region) => total + region.text.length, 0);

describe("admit", () => {
  it("ranks by relevance and breaks a tie on density", () => {
    const thin = aRegion({ chars: 100, relevance: 0.7 });
    const dense = aRegion({ chars: 100, relevance: 0.7, density: 3 });
    const best = aRegion({ chars: 100, relevance: 0.9 });

    const admitted = admit([thin, dense, best]);

    // Two regions scoring alike are not equally useful: one assembled from
    // several overlapping windows is material the query kept landing on, and one
    // from a single window is a passing mention.
    expect(admitted).toEqual([best, dense, thin]);
  });

  it("admits until the character budget is spent", () => {
    const admitted = admit([
      aRegion({ chars: 2000, relevance: 0.9 }),
      aRegion({ chars: 1500, relevance: 0.8 }),
      aRegion({ chars: 1000, relevance: 0.7 })
    ]);

    expect(admitted).toHaveLength(2);
    expect(sizeOf(admitted)).toBeLessThanOrEqual(CHAR_BUDGET);
  });

  it("keeps looking after one region is too large for what is left", () => {
    const admitted = admit([
      aRegion({ chars: 3800, relevance: 0.9 }),
      aRegion({ chars: 1000, relevance: 0.8 }),
      aRegion({ chars: 150, relevance: 0.7 })
    ]);

    // The budget is a budget, not a stopping point: something that fits after
    // something else did not is still worth its characters.
    expect(admitted.map((region) => region.text.length)).toEqual([3800, 150]);
  });

  it("admits the top region even when it alone exceeds the budget", () => {
    const huge = aRegion({ chars: CHAR_BUDGET * 2, relevance: 0.9 });

    const admitted = admit([huge, aRegion({ chars: 100, relevance: 0.8 })]);

    // A truncated best answer beats no answer.
    expect(admitted).toEqual([huge]);
  });

  it("gives a dense region a quarter over the budget when it just misses the cut", () => {
    const first = aRegion({ chars: 3800, relevance: 0.9 });
    const substantial = aRegion({ chars: 900, relevance: 0.8, density: 2 });

    const admitted = admit([first, substantial]);

    // Cutting substantial material to admit two thin ones is the wrong trade.
    expect(admitted).toEqual([first, substantial]);
    expect(sizeOf(admitted)).toBeGreaterThan(CHAR_BUDGET);
  });

  it("gives a passing mention no overage at all", () => {
    const first = aRegion({ chars: 3800, relevance: 0.9 });
    const thin = aRegion({ chars: 900, relevance: 0.8 });

    expect(admit([first, thin])).toEqual([first]);
  });

  it("returns no more than the caller asked for, and topK when they ask for nothing", () => {
    const many = Array.from({ length: TOP_K + 3 }, (_, index) =>
      aRegion({ chars: 10, relevance: 0.9 - index / 100 })
    );

    expect(admit(many)).toHaveLength(TOP_K);
    expect(admit(many, 2)).toHaveLength(2);
  });

  it("admits nothing from nothing", () => {
    expect(admit([])).toEqual([]);
  });
});
