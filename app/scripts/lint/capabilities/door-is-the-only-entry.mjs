import { check } from "../shared/check.mjs";
import { capabilities, unitOf } from "../shared/trees.mjs";

export default check({
  name: "door-is-the-only-entry",
  says: "No import from outside a capability names anything below its index.ts.",
  // Importers inside `capabilities/` are `capability-imports · no-sideways`.
  // The same rule, but a sibling reaching in is a different mistake from a view
  // doing it, and one line should produce one finding.
  run(tree) {
    const units = capabilities(tree);
    const found = [];

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      const importer = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "capabilities") continue;

        const [name, ...rest] = target.segments;
        if (!name) continue;
        if (importer) continue; // a sibling's reach is no-sideways' business
        if (rest.length === 0) continue; // the door itself

        found.push({
          path,
          line: record.line,
          message: `reaches past ${name}'s door: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
