import { describe, expect, it } from "vitest";
import { maximalCliques } from "$knowledge/api/cluster/cliques";

/** An adjacency predicate from a list of undirected edges. */
const graph = (edges: [number, number][]) => {
  const set = new Set(edges.flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));
  return (a: number, b: number) => set.has(`${a}:${b}`);
};

describe("maximalCliques", () => {
  it("lets cliques overlap, which is why the structure is a lattice", () => {
    // 4 bridges two triangles that are not adjacent to each other.
    const adjacent = graph([
      [0, 1],
      [0, 4],
      [1, 4],
      [2, 3],
      [2, 4],
      [3, 4]
    ]);

    expect(maximalCliques(5, adjacent)).toEqual([
      [0, 1, 4],
      [2, 3, 4]
    ]);
  });

  it("reports each clique once, at its full size", () => {
    // Every pair inside a triangle is a clique too, and every one of them is a
    // subset of the triangle — reporting them would triple the lattice.
    const adjacent = graph([
      [0, 1],
      [1, 2],
      [0, 2]
    ]);

    expect(maximalCliques(3, adjacent)).toEqual([[0, 1, 2]]);
  });

  it("leaves an artifact with no strong neighbour in no clique at all", () => {
    // Forcing it into the nearest cluster would invent a relationship the
    // weights did not support.
    const adjacent = graph([[0, 1]]);

    expect(maximalCliques(3, adjacent)).toEqual([[0, 1]]);
  });

  it("finds nothing in a pool of one", () => {
    expect(maximalCliques(1, () => true)).toEqual([]);
  });
});
