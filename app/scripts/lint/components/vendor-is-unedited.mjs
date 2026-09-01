import { check } from "../shared/check.mjs";

/**
 * The closest a check gets to "nobody touched it" without diffing the registry.
 * The CLI writes imports of Svelte, of packages, and of its own tree; every
 * other reach is something a person added, and the next regeneration eats it.
 */
const FIRST_PARTY = new Set([
  "capabilities", "model", "runtime", "representation", "surfaces", "app-views",
  "development-views", "panels", "workspaces", "modals", "development-components"
]);

export default check({
  name: "vendor-is-unedited",
  says: "No file under vendored/ imports $authored-components or any first-party tree.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("components", "vendored"))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target) continue;
        if (target.tree === "authored-components") {
          found.push({ path, line: record.line, message: `takes an authored component: ${record.specifier}` });
          continue;
        }
        if (FIRST_PARTY.has(target.tree)) {
          found.push({ path, line: record.line, message: `reaches a first-party tree: ${record.specifier}` });
        }
      }
    }
    return found;
  }
});
