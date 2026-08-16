import { describe, expect, it } from "vitest";
import { assignCells, cellCount } from "$knowledge/api/cluster/cells";
import { tilted } from "$knowledge/test/fixture";

/** Three well-separated directions, four artifacts around each. */
const threeGroups = () =>
  [0, 1, 2].flatMap((axis) =>
    [-6, -2, 2, 6].map((degrees) => tilted(axis, (axis + 1) % 3, degrees))
  );

describe("cellCount", () => {
  it("is roughly the square root of the pool when configuration names no number", () => {
    // Self-scaling, and the standard choice: cells and members per cell grow at
    // the same rate, so probing a few cells stays a small fraction of the pool.
    expect(cellCount(100)).toBe(10);
    expect(cellCount(2001)).toBe(45);
  });

  it("is never zero, so a tiny pool still has somewhere to put its artifacts", () => {
    expect(cellCount(1)).toBe(1);
    expect(cellCount(0)).toBe(1);
  });
});

describe("assignCells", () => {
  it("puts every artifact in exactly one cell", () => {
    const { assignments, centroids } = assignCells(threeGroups(), 3);

    expect(assignments).toHaveLength(12);
    for (const cell of assignments) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(centroids.length);
    }
  });

  it("puts artifacts pointing the same way in the same cell", () => {
    const { assignments } = assignCells(threeGroups(), 3);

    // The whole point of a cell: an artifact's neighbours are the ones it shares
    // one with, so candidate search can skip the rest of the pool.
    expect(new Set(assignments.slice(0, 4)).size).toBe(1);
    expect(new Set(assignments.slice(4, 8)).size).toBe(1);
    expect(new Set(assignments).size).toBe(3);
  });

  it("assigns the same pool the same cells every time", () => {
    // Seeded rather than randomly initialized, because a lattice that reshuffled
    // on every rebuild would make retrieval irreproducible.
    expect(assignCells(threeGroups(), 3)).toEqual(assignCells(threeGroups(), 3));
  });

  it("makes no more cells than there are artifacts to fill them", () => {
    const { centroids } = assignCells([tilted(0, 1, 0), tilted(0, 1, 90)], 8);

    expect(centroids).toHaveLength(2);
  });

  it("has nothing to assign in an empty pool", () => {
    expect(assignCells([], 4)).toEqual({ centroids: [], assignments: [] });
  });
});
