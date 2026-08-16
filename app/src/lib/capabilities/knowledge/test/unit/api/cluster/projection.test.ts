import { describe, expect, it } from "vitest";
import {
  PROJECTION_SAMPLE_MAX,
  fitProjection,
  orthonormalize,
  project
} from "$knowledge/api/cluster/projection";
import { dot, normalize } from "$knowledge/api/cluster/similarity";

/** Spread across all four dimensions and different every index. */
const spread = (i: number) =>
  normalize([Math.sin(i), Math.cos(i * 1.7), Math.sin(i * 2.3), Math.cos(i * 0.31)]);

/**
 * Almost all of the energy along the first axis, all of the *variance* along the
 * second. A centred fit would answer with the second; an uncentered one, which
 * is what a dot product is approximated by, answers with the first.
 */
const leaning = () =>
  Array.from({ length: 20 }, (_, i) => normalize([1, i % 2 === 0 ? 0.1 : -0.1, 0, 0]));

const axis = (which: number, count: number) =>
  Array.from({ length: count }, () => [0, 1, 2, 3].map((i) => (i === which ? 1 : 0)));

describe("orthonormalize", () => {
  it("makes the rows unit length and mutually perpendicular", () => {
    const rows = [
      [2, 0, 0],
      [1, 3, 0],
      [1, 1, 4]
    ];
    orthonormalize(rows);

    expect(dot(rows[0], rows[0])).toBeCloseTo(1, 12);
    expect(dot(rows[0], rows[1])).toBeCloseTo(0, 12);
    expect(dot(rows[1], rows[2])).toBeCloseTo(0, 12);
  });

  it("re-seeds a row that collapsed instead of leaving a zero direction in the basis", () => {
    // A duplicate row has nothing left after the projection is subtracted, and a
    // zero row would project every vector onto nothing.
    const rows = [
      [1, 0, 0],
      [2, 0, 0]
    ];
    orthonormalize(rows);

    expect(dot(rows[1], rows[1])).toBeCloseTo(1, 12);
    expect(dot(rows[0], rows[1])).toBeCloseTo(0, 12);
  });
});

describe("fitProjection", () => {
  it("fits an uncentered basis, because it approximates dot products and not variance", () => {
    const [direction] = fitProjection(leaning(), 1);

    // Subtracting the mean would optimize for the wrong quantity: it would
    // answer with the second axis, where all the spread is and none of the
    // similarity. It is a one-line difference that silently degrades recall.
    expect(Math.abs(direction[0])).toBeGreaterThan(0.99);
    expect(Math.abs(direction[1])).toBeLessThan(0.15);
  });

  it("returns an orthonormal basis of the width asked for", () => {
    const basis = fitProjection([...axis(0, 8), ...axis(1, 4), ...axis(2, 2), ...axis(3, 1)], 3);

    expect(basis).toHaveLength(3);
    for (let i = 0; i < basis.length; i++) {
      for (let j = 0; j < basis.length; j++) {
        expect(dot(basis[i], basis[j])).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    }
  });

  it("fits nothing when the pool is already no wider than the projection", () => {
    // Projecting 4 dimensions into 4 buys no comparisons and costs a matrix.
    expect(fitProjection(axis(0, 4), 4)).toEqual([]);
    expect(fitProjection([], 2)).toEqual([]);
  });

  it("is the same basis every time it is fitted over the same pool", () => {
    const vectors = Array.from({ length: 40 }, (_, i) => spread(i));

    expect(fitProjection(vectors, 2)).toEqual(fitProjection(vectors, 2));
  });

  it("samples a large pool by stride rather than at random", () => {
    const vectors = Array.from({ length: PROJECTION_SAMPLE_MAX * 2 }, (_, i) => spread(i));
    const stride = Array.from(
      { length: PROJECTION_SAMPLE_MAX },
      (_, i) => vectors[Math.floor((i * vectors.length) / PROJECTION_SAMPLE_MAX)]
    );

    // Sampling is by stride *because* it is deterministic: a random sample of
    // the same pool would fit a different basis on every rebuild.
    expect(fitProjection(vectors, 2)).toEqual(fitProjection(stride, 2));
  });
});

describe("project", () => {
  it("gives a vector's coordinate in each basis direction", () => {
    const basis = [
      [1, 0, 0],
      [0, 1, 0]
    ];

    expect(project(basis, [3, 4, 5])).toEqual([3, 4]);
  });
});
