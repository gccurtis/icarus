import { check } from "../shared/check.mjs";
import { BOTH, CLIENT, SERVER, TEST, homes } from "../shared/home.mjs";
import { buildGraph, describeChain, shortestPathTo } from "../shared/graph.mjs";

/**
 * A capability door is the one edge allowed to change process, so the walk stops
 * there rather than reporting every procedure behind it. `one-crossing` is what
 * says there is only one such door in the first place.
 */
const isCapabilityDoor = (tree, path) => {
  const segments = tree.rel(path).split("/");
  return segments[2] === "capabilities" && segments.length === 5 && segments[4].startsWith("index.");
};

export default check({
  name: "processes-do-not-mix",
  says: "Transitively, following the real graph.",
  subjects: {
    "client-does-not-import-server": "or the browser bundle carries the filesystem and the secrets",
    "server-does-not-import-client": "or the process carries state belonging to one tab",
    "both-imports-only-both": "what makes a shared module safe for either side to take"
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
        (to, edge) => carries(edge) && homeOf(to) === forbidden && !isCapabilityDoor(tree, to),
        {
          cross: (to, edge) =>
            carries(edge) && homeOf(to) === BOTH && !isCapabilityDoor(tree, to)
        }
      );

    const found = [];

    for (const [path, { home }] of where) {
      if (home === TEST || home === null) continue;

      // The door is the crossing, so reaching the server is what it is for.
      // Reaching the client is not: that pulls a browser module into the
      // process on the other side of it.
      if (isCapabilityDoor(tree, path)) {
        const chain = walk(path, CLIENT);
        if (chain) {
          found.push({
            subject: "both-imports-only-both",
            path,
            message: `a door reaches ${CLIENT} code: ${describeChain(tree, chain)}`
          });
        }
        continue;
      }

      const forbidden = home === CLIENT ? SERVER : home === SERVER ? CLIENT : null;
      if (forbidden) {
        const chain = walk(path, forbidden);
        if (chain) {
          found.push({
            subject: home === CLIENT ? "client-does-not-import-server" : "server-does-not-import-client",
            path,
            message: `reaches ${forbidden} code: ${describeChain(tree, chain)}`
          });
        }
        continue;
      }

      // A both-module may take only both-modules, so either side is a finding.
      for (const other of [CLIENT, SERVER]) {
        const chain = walk(path, other);
        if (chain) {
          found.push({
            subject: "both-imports-only-both",
            path,
            message: `reaches ${other} code: ${describeChain(tree, chain)}`
          });
        }
      }
    }
    return found;
  }
});
