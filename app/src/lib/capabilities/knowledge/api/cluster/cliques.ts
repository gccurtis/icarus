/**
 * Every maximal clique in an adjacency relation, grown greedily from each seed.
 *
 * **Cliques overlap, and that is the whole shape of the thing.** An artifact
 * adjacent to two groups that are not adjacent to each other belongs to both
 * cliques, which is why the lattice is a lattice and not a tree.
 *
 * A clique grown this way is maximal by construction: any artifact adjacent to
 * all of its final members was adjacent to all of the members it had when it was
 * scanned, and so was taken. Different seeds reach the same clique, which is
 * what the deduplication is for — a subset can never survive as a separate
 * cluster.
 *
 * Quadratic in the pool, times the average clique size. That is affordable
 * exactly while the pool is small, which is the crossover the approximate path
 * exists to answer.
 */
export const maximalCliques = (
  size: number,
  adjacent: (a: number, b: number) => boolean
): number[][] => {
  const cliques: number[][] = [];
  const seen = new Set<string>();

  for (let seed = 0; seed < size; seed++) {
    const clique = [seed];
    for (let candidate = 0; candidate < size; candidate++) {
      if (candidate === seed) continue;
      if (clique.every((member) => adjacent(member, candidate))) clique.push(candidate);
    }
    if (clique.length < 2) continue;

    clique.sort((left, right) => left - right);
    const key = clique.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    cliques.push(clique);
  }

  return cliques;
};
