/**
 * The real import graph: every edge that resolves to a file in this repository.
 *
 * Built from specifiers rather than from a type-checker program, which is what
 * `no-relative-imports` buys — an aliased specifier names its target without
 * anything having to know where the importing file sits.
 *
 * An unresolvable specifier is a package, and packages are outside every
 * boundary rule here. A specifier that should have resolved and did not is
 * `documented-paths-resolve`'s business, not this module's.
 */

/** @returns {Map<string, Array<{ to: string, specifier: string, line: number, type: boolean }>>} */
export const buildGraph = (tree) => {
  const edges = new Map();
  for (const from of tree.files) {
    if (!/\.(ts|js|mjs|svelte)$/.test(from)) continue;
    const out = [];
    for (const record of tree.imports(from)) {
      const to = tree.resolve(record.specifier, from);
      if (to) out.push({ to, specifier: record.specifier, line: record.line, type: record.type });
    }
    edges.set(from, out);
  }
  return edges;
};

/**
 * The shortest chain from `start` to the first module `wanted` accepts, or null.
 *
 * Breadth-first so a finding names the shortest way in — the long ones are the
 * same defect read further along, and reporting them all buries the edge that
 * actually has to change.
 */
export const shortestPathTo = (graph, start, wanted, { cross = () => true } = {}) => {
  const seen = new Set([start]);
  const queue = [[start]];
  while (queue.length > 0) {
    const chain = queue.shift();
    const at = chain.at(-1);
    for (const edge of graph.get(at) ?? []) {
      if (seen.has(edge.to)) continue;
      const next = [...chain, edge.to];
      if (wanted(edge.to, edge, chain)) return next;
      if (!cross(edge.to, edge)) continue;
      seen.add(edge.to);
      queue.push(next);
    }
  }
  return null;
};

/** A chain of absolute paths, written the way a finding reads it. */
export const describeChain = (tree, chain) =>
  chain.map((path) => tree.rel(path).replace(/^src\/lib\//, "")).join(" → ");
