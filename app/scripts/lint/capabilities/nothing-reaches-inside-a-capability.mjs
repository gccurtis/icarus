import { check } from "../shared/check.mjs";
import { capabilities, unitOf } from "../shared/trees.mjs";

/** `index` or `index.remote` — naming the index explicitly is still the index. */
const isIndex = (rest) => rest.length === 0 || (rest.length === 1 && /^index(\.remote)?$/.test(rest[0]));

export default check({
  name: "nothing-reaches-inside-a-capability",
  says: "No import from outside a capability names a path below its index. A capability that crosses to the server is entered at index.remote, which is that capability's index.",
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
        if (isIndex(rest)) continue;

        found.push({
          path,
          line: record.line,
          message: `reaches past ${name}'s index: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
