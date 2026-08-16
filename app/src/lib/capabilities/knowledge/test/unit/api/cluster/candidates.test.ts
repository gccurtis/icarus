import { describe, expect, it } from "vitest";
import { NEIGHBOURS_K, PCA_DIMS, candidateGraph } from "$knowledge/api/cluster/candidates";
import { separatedGroups, tilted } from "$knowledge/test/fixture";

/**
 * The similarity of two artifacts, computed here rather than imported — the
 * claim is that the graph's weights are the *full* dot product, and borrowing
 * the implementation's own arithmetic would not test it.
 */
const fullDot = (a: readonly number[], b: readonly number[]) => {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
};

const wide = () => separatedGroups({ groups: 8, per: 5, width: PCA_DIMS + 32 });

describe("candidateGraph", () => {
  it("scores every edge with the full embedding, never the projection", () => {
    const vectors = wide();
    const { neighbours } = candidateGraph(vectors);

    // **The whole trick.** The projection decides which pairs are worth
    // comparing; it never decides how similar they are. A weight that came back
    // from the projected space is the defect this pass exists to avoid.
    for (let i = 0; i < vectors.length; i++) {
      for (const { to, similarity } of neighbours[i]) {
        expect(similarity).toBeCloseTo(fullDot(vectors[i], vectors[to]), 12);
      }
    }
  });

  it("keeps an edge in both directions, so a clique is not an accident of order", () => {
    const { neighbours } = candidateGraph(wide());

    for (let i = 0; i < neighbours.length; i++) {
      for (const { to } of neighbours[i]) {
        expect(neighbours[to].some((neighbour) => neighbour.to === i)).toBe(true);
      }
    }
  });

  it("keeps the strongest neighbours rather than every pair", () => {
    const vectors = separatedGroups({ groups: 1, per: 100, width: 8 });
    const { neighbours } = candidateGraph(vectors);
    const edges = neighbours.reduce((total, list) => total + list.length, 0) / 2;

    // Every artifact here is close to every other, so an exhaustive graph would
    // hold 4950 edges. Bounding the graph at k per artifact is what keeps
    // clique-finding affordable on a pool the exact path cannot touch.
    expect(edges).toBeLessThanOrEqual(vectors.length * NEIGHBOURS_K);
    expect(edges).toBeLessThan((vectors.length * (vectors.length - 1)) / 2);
  });

  it("searches its own cell and the nearest few, not the whole pool", () => {
    const vectors = separatedGroups({ groups: 11, per: 3, width: 16 });
    const { neighbours } = candidateGraph(vectors);

    // 33 artifacts and k is 32, so nothing here is dropped for being a weak
    // neighbour: a pool searched exhaustively would leave every artifact with
    // all 32 of the others.
    expect(Math.min(...neighbours.map((list) => list.length))).toBeLessThan(vectors.length - 1);
  });

  it("reports the basis and the cells it selected candidates through", () => {
    const { basis, centroids, cells, k } = candidateGraph(wide());

    expect(basis).toHaveLength(PCA_DIMS);
    expect(basis[0]).toHaveLength(PCA_DIMS + 32);
    expect(k).toBe(NEIGHBOURS_K);
    for (const cell of cells) expect(cell).toBeLessThan(centroids.length);
  });

  it("fits no basis over a pool already narrower than the projection", () => {
    const { basis } = candidateGraph(separatedGroups({ groups: 4, per: 4, width: 8 }));

    expect(basis).toEqual([]);
  });

  it("builds the same graph over the same pool every time", () => {
    // Byte-identical, not merely equivalent: node ids hash their members, so a
    // graph that reshuffled would rename every cluster above it.
    expect(JSON.stringify(candidateGraph(wide()))).toBe(JSON.stringify(candidateGraph(wide())));
  });

  it("has no neighbours to find in a pool of one", () => {
    expect(candidateGraph([tilted(0, 1, 0)]).neighbours).toEqual([[]]);
  });
});
