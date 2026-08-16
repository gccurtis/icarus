import { describe, expect, it } from "vitest";
import { seeded } from "$knowledge/api/cluster/seeded";

const take = (seed: number, count: number) => {
  const random = seeded(seed);
  return Array.from({ length: count }, () => random.uniform());
};

describe("seeded", () => {
  it("gives the same seed the same stream, which is what the lattice is built on", () => {
    // A lattice that reshuffled on every rebuild would make retrieval
    // irreproducible and repair impossible to reason about.
    expect(take(0x9e3779b9, 8)).toEqual(take(0x9e3779b9, 8));
  });

  it("gives two seeds two streams, so the projection and the cells do not share one", () => {
    expect(take(0x9e3779b9, 8)).not.toEqual(take(0xd1b54a32, 8));
  });

  it("draws uniforms inside the unit interval", () => {
    for (const value of take(1, 200)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("draws integers inside the range asked for", () => {
    const random = seeded(7);

    for (let i = 0; i < 200; i++) {
      const value = random.intn(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
  });

  it("still moves from a zero seed, which is otherwise a fixed point", () => {
    // Nothing configures a zero seed today, and a generator that returned zero
    // forever would fail as a degenerate basis rather than as an error.
    expect(new Set(take(0, 8)).size).toBeGreaterThan(1);
  });
});
