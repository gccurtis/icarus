import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { check } from "../shared/check.mjs";
import { domains } from "../shared/trees.mjs";

/**
 * The declaration is a setting rather than a module, because a module under
 * `data/types/` would have to compile to nothing and a module under
 * `data/behavior/` would be a function over nothing. `configuration/` is where
 * a list of what is allowed already lives.
 */
const DECLARATION = ["configuration", "representation.yaml"];

const declared = (tree) => {
  const path = join(tree.base, ...DECLARATION);
  if (!tree.exists(path)) return { path, graph: null };
  const document = parseYaml(tree.read(path));
  const graph = document?.representation?.domains ?? null;
  return { path, graph };
};

/** The first cycle reachable from `start`, as the chain that closes it. */
const cycleFrom = (graph, start) => {
  const walk = (at, chain) => {
    for (const next of graph[at] ?? []) {
      if (chain.includes(next)) return [...chain.slice(chain.indexOf(next)), next];
      const found = walk(next, [...chain, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, [start]);
};

export default check({
  name: "domain-graph-is-declared",
  says: "The domain graph is declared and acyclic.",
  subjects: {
    "declaration-matches-imports": "a domain imports exactly the domains it declares it may",
    "no-cycle": "the real graph is acyclic"
  },
  run(tree) {
    const { path: declarationPath, graph } = declared(tree);
    if (!graph) {
      return [
        {
          subject: "declaration-matches-imports",
          path: declarationPath,
          message: "declares no representation.domains, so there is nothing for the tree to agree with"
        }
      ];
    }

    const found = [];
    const normalised = Object.fromEntries(
      Object.entries(graph).map(([name, allowed]) => [name, [...(allowed ?? [])]])
    );

    const { types, behavior } = domains(tree);
    const onDisk = new Set([...types, ...behavior].map(({ name }) => name));

    for (const name of onDisk) {
      if (name in normalised) continue;
      found.push({
        subject: "declaration-matches-imports",
        path: tree.path("representation", "data", "types", name),
        message: "is on disk and not declared"
      });
    }
    for (const name of Object.keys(normalised)) {
      if (onDisk.has(name)) continue;
      found.push({
        subject: "declaration-matches-imports",
        path: declarationPath,
        message: `declares ${name}, which is not on disk`
      });
    }

    // What the tree actually reaches, read off the specifiers.
    for (const path of tree.under(tree.path("representation", "data"))) {
      if (!path.endsWith(".ts")) continue;
      // src / lib / representation / data / {types,behavior} / <domain> / …
      const segments = tree.rel(path).split("/");
      const self = segments[5];
      if (!self) continue;

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "representation") continue;
        const [data, kind, other] = target.segments;
        if (data !== "data" || !["types", "behavior"].includes(kind) || !other) continue;
        if (other === self) continue;
        if ((normalised[self] ?? []).includes(other)) continue;
        found.push({
          subject: "declaration-matches-imports",
          path,
          line: record.line,
          message: `${self} reaches ${other}, which it does not declare`
        });
      }
    }

    const reported = new Set();
    for (const name of Object.keys(normalised)) {
      const cycle = cycleFrom(normalised, name);
      if (!cycle) continue;
      const key = [...cycle].sort().join(",");
      if (reported.has(key)) continue;
      reported.add(key);
      found.push({
        subject: "no-cycle",
        path: declarationPath,
        message: `cycle: ${cycle.join(" → ")}`
      });
    }
    return found;
  }
});
