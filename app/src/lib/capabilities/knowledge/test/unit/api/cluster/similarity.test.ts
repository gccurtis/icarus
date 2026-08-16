import { describe, expect, it } from "vitest";
import {
  centroidOf,
  cohesionOf,
  dot,
  normalize,
  similarityMatrix,
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

    expect(cohesionOf(matrix, [0, 1, 2])).toBe(0.4);
  });

  it("is 1 for a set with no pair in it", () => {
    expect(cohesionOf([[1]], [0])).toBe(1);
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
