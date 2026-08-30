import { check } from "../shared/check.mjs";
import { CLIENT, SERVER, SHARED, TEST, homes } from "../shared/home.mjs";
import { buildGraph, describeChain, shortestPathTo } from "../shared/graph.mjs";

/**
 * A capability index is the one edge allowed to change process, so the walk stops
 * there rather than reporting every procedure behind it. `one-crossing` is what
 * says there is only one such index in the first place.
 */
const isCapabilityIndex = (tree, path) => {
  const segments = tree.rel(path).split("/");
  return segments[2] === "capabilities" && segments.length === 5 && segments[4].startsWith("index.");
};

export default check({
  name: "client-server-separation",
  says: "A module runs in one process. What it imports, transitively, must be able to run there too.",
  subjects: {
    "client-takes-no-server-code": "or the browser bundle carries the filesystem and the secrets",
    "server-takes-no-client-code": "or the process carries state belonging to one tab",
    "shared-takes-only-shared-code":
      "a module either process may load can only load what either process may load"
  },
  run(tree) {
    const graph = buildGraph(tree);
    const where = homes(tree);
    const homeOf = (path) => where.get(path)?.home ?? null;

    /** A type-only edge is erased, so it carries nothing into either bundle. */
    const carries = (edge) => !edge.type;

    const walk = (from, forbidden) =>
      shortestPathTo(
        graph,
        from,
        (to, edge) => carries(edge) && homeOf(to) === forbidden && !isCapabilityIndex(tree, to),
        {
          cross: (to, edge) =>
            carries(edge) && homeOf(to) === SHARED && !isCapabilityIndex(tree, to)
        }
      );

    const found = [];

    for (const [path, { home }] of where) {
      if (home === TEST || home === null) continue;

      // The index is the crossing, so reaching the server is what it is for.
      // Reaching the client is not: that pulls a browser module into the
      // process on the other side of it.
      if (isCapabilityIndex(tree, path)) {
        const chain = walk(path, CLIENT);
        if (chain) {
          found.push({
            subject: "shared-takes-only-shared-code",
            path,
            message: `reaches ${CLIENT} code: ${describeChain(tree, chain)}`
          });
        }
        continue;
      }

      const forbidden = home === CLIENT ? SERVER : home === SERVER ? CLIENT : null;
      if (forbidden) {
        const chain = walk(path, forbidden);
        if (chain) {
          found.push({
            subject: home === CLIENT ? "client-takes-no-server-code" : "server-takes-no-client-code",
            path,
            message: `reaches ${forbidden} code: ${describeChain(tree, chain)}`
          });
        }
        continue;
      }

      // A shared module may take only shared modules, so either side is a finding.
      for (const other of [CLIENT, SERVER]) {
        const chain = walk(path, other);
        if (chain) {
          found.push({
            subject: "shared-takes-only-shared-code",
            path,
            message: `reaches ${other} code: ${describeChain(tree, chain)}`
          });
        }
      }
    }
    return found;
  }
});
