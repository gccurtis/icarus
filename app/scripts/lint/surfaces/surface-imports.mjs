import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { VIEW_TREES, surfaces, unitOf } from "../shared/trees.mjs";

/** A surface is entered at its root component or its types, and nowhere else. */
const isEntry = (tree, unit, target) =>
  target === join(unit.path, `${unit.name}.svelte`) || target === join(unit.path, "types.ts");

export default check({
  name: "surface-imports",
  says: "Where a rendered surface may reach.",
  subjects: {
    "no-server-code": "nothing marked as the server's reaches a rendered surface",
    "no-route-internals": "no generated route type or route-local module",
    "no-reaching-inside": "another surface is named at its root or its types, never below"
  },
  run(tree) {
    const units = surfaces(tree);
    const found = [];

    for (const path of VIEW_TREES.flatMap((name) => tree.under(tree.path(name)))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      const self = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const { specifier, line } = record;
        const finding = (subject, message) => found.push({ subject, path, line, message });

        const resolved = tree.resolve(specifier, path);
        if (/\.server(\.|$)/.test(specifier) || (resolved && /\.server\.(ts|js)$/.test(resolved))) {
          finding("no-server-code", `reaches the server: ${specifier}`);
          continue;
        }
        if (/(^|\/)\$types(\.js)?$/.test(specifier) || /(^|\/)\+[a-z]/.test(specifier)) {
          finding("no-route-internals", `reaches a route's own module: ${specifier}`);
          continue;
        }

        if (!resolved) continue;
        const other = unitOf(tree, units, resolved);
        if (!other || other === self) continue;
        if (isEntry(tree, other, resolved)) continue;
        finding("no-reaching-inside", `reaches inside ${other.name}: ${specifier}`);
      }
    }
    return found;
  }
});
