import { describe, expect, it } from "vitest";
import {
  centroidOf,
  cohesionOf,
  dot,
  normalize,
  similarityMatrix,
  thresholdBySample,
  thresholdFrom,
  thresholdOf
} from "$knowledge/api/cluster/similarity";
import { bridgedGroups, tilted } from "$knowledge/test/fixture";

describe("normalize", () => {
  it("returns a unit vector", () => {
    expect(dot(normalize([3, 4, 0]), normalize([3, 4, 0]))).toBeCloseTo(1, 12);
  });

  it("leaves a zero vector alone rather than dividing by nothing", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe("centroidOf", () => {
  it("is the unit-normalized mean, which is what retrieval scores against", () => {
    const centroid = centroidOf([tilted(0, 1, 20), tilted(0, 1, -20)]);

    // Two vectors either side of an axis average onto it, and the mean of two
    // unit vectors is shorter than one — normalizing is what makes the centroid
    // comparable to the members it stands for.
    expect(centroid[0]).toBeCloseTo(1, 12);
    expect(centroid[1]).toBeCloseTo(0, 12);
    expect(dot(centroid, centroid)).toBeCloseTo(1, 12);
  });
});

describe("similarityMatrix", () => {
  it("is symmetric with a unit diagonal", () => {
    const matrix = similarityMatrix([tilted(0, 1, 0), tilted(0, 1, 60), tilted(0, 1, 90)]);

    expect(matrix[0][0]).toBeCloseTo(1, 12);
    expect(matrix[0][1]).toBeCloseTo(0.5, 12);
    expect(matrix[1][0]).toBeCloseTo(0.5, 12);
    expect(matrix[0][2]).toBeCloseTo(0, 12);
  });
});

describe("cohesionOf", () => {
  it("is the weakest pair, never the mean", () => {
    // A tight core with something barely related attached is exactly the case
    // worth knowing about, and averaging hides it: this mean is 0.73.
    const matrix = [
      [1, 0.9, 0.4],
      [0.9, 1, 0.9],
      [0.4, 0.9, 1]
    ];

    expect(cohesionOf((a, b) => matrix[a][b], [0, 1, 2])).toBe(0.4);
  });

  it("is 1 for a set with no pair in it", () => {
    expect(cohesionOf(() => 0.5, [0])).toBe(1);
  });

  it("asks for a pair rather than reading a matrix, because a large pool has none", () => {
    // Above the crossover there is no full matrix to index into — the pairs a
    // clique is measured on are looked up one at a time, from the same
    // full-dimensional arithmetic.
    const asked: string[] = [];

    cohesionOf((a, b) => {
      asked.push(`${a}-${b}`);
      return 0.8;
    }, [2, 5]);

    expect(asked).toEqual(["2-5"]);
  });
});

describe("thresholdFrom", () => {
  it("reads the percentile off the similarities it was given", () => {
    expect(thresholdFrom([0.9, 0.5, 0.8, 0.6], 0.75, 0.3)).toBe(0.9);
  });

  it("is what thresholdOf is, so the two paths agree wherever they see the same pairs", () => {
    // The approximate path has a set of edge weights and no matrix. Deriving the
    // threshold through one function is what makes an exhaustive candidate graph
    // land on the exact path's threshold rather than near it.
    const matrix = similarityMatrix([tilted(0, 1, 0), tilted(0, 1, 20), tilted(0, 1, 70)]);
    const pairs = [matrix[0][1], matrix[0][2], matrix[1][2]];

    expect(thresholdFrom(pairs, 0.75, 0.3)).toBe(thresholdOf(matrix, 0.75, 0.3));
  });

  it("falls back to the floor when there is no pair at all", () => {
    expect(thresholdFrom([], 0.75, 0.3)).toBe(0.3);
  });
});

describe("thresholdOf", () => {
  it("sits at the percentile of this level's own distribution", () => {
    const { a1, a2, b1, b2, bridge, loner, drifter } = bridgedGroups();
    const matrix = similarityMatrix([a1, a2, b1, b2, bridge, loner, drifter]);

    // A fixed threshold clusters one corpus into nothing and another into one
    // blob; this one is read off the pool in front of it.
    expect(thresholdOf(matrix, 0.75, 0.3)).toBeCloseTo(Math.cos((10 * Math.PI) / 180) / Math.SQRT2, 12);
  });

  it("never drops below the floor, however loose the pool", () => {
    const matrix = similarityMatrix([tilted(0, 1, 0), tilted(0, 1, 80), tilted(0, 1, 160)]);

    expect(thresholdOf(matrix, 0.75, 0.3)).toBe(0.3);
  });
});

/** Two blocks in id order: eight facing one axis, eight facing another. */
const blocks = () => [
  ...Array.from({ length: 8 }, () => tilted(0, 2, 0)),
  ...Array.from({ length: 8 }, () => tilted(1, 2, 0))
];

describe("thresholdBySample", () => {
  it("is thresholdOf exactly when the budget covers the pool", () => {
    const vectors = [tilted(0, 1, 0), tilted(0, 1, 20), tilted(0, 1, 70), tilted(0, 1, 110)];

    // Not "close to". A small pool lands *on* the exact path's threshold, which
    // is what makes an equality test below the crossover honest rather than
    // accidental.
    expect(thresholdBySample(vectors, 100, 0.75, 0.3)).toBe(
      thresholdOf(similarityMatrix(vectors), 0.75, 0.3)
    );
  });

  it("spans the pool rather than a neighbourhood of it", () => {
    // The pool is sorted by id before anything is clustered, and ids often track
    // the order rows were written — so pairing each artifact with the next few
    // would sample one document over and over and read back a threshold far
    // above the pool's own. Striding across it is what stops that.
    expect(thresholdBySample(blocks(), 4, 0.4, 0.3)).toBe(
      thresholdOf(similarityMatrix(blocks()), 0.4, 0.3)
    );
    expect(thresholdBySample(blocks(), 4, 0.4, 0.3)).toBe(0.3);
  });

  it("falls back to the floor when there is nothing to sample", () => {
    expect(thresholdBySample([], 100, 0.75, 0.3)).toBe(0.3);
  });
});
