import { check } from "../shared/check.mjs";
import { objects, unitOf } from "../shared/trees.mjs";

/** `index` or `index.server` — the environment decides which, and `object-layout` checks that. */
const isIndex = (rest) => rest.length === 1 && /^index(\.server)?$/.test(rest[0]);

export default check({
  name: "object-is-entered-at-its-index",
  says: "An import from outside an object names its index, never a path below it.",
  run(tree) {
    const units = objects(tree);
    const found = [];

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      const self = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "model") continue;

        const [environment, name, ...rest] = target.segments;
        if (!name) continue;
        if (self && self.id === `${environment}/${name}`) continue;
        if (rest.length === 0 || isIndex(rest)) continue;

        found.push({
          path,
          line: record.line,
          message: `reaches past ${environment}/${name}'s index: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
