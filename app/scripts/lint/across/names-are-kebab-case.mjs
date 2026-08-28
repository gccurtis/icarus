import { relative, sep } from "node:path";

import { check } from "../shared/check.mjs";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Two trees are named by somebody else. `routes/` is named by SvelteKit's
 * conventions — `+page.svelte`, `[project]` — and `components/vendored/` is
 * written by the shadcn CLI, which rewrites it on every regeneration.
 */
const isSomebodyElses = (tree, path) =>
  tree.within(tree.routes, path) || tree.within(tree.path("components", "vendored"), path);

export default check({
  name: "names-are-kebab-case",
  says: "Checked per dot-separated segment. Case is the one naming difference that resolves on one filesystem and fails on another.",
  run(tree) {
    const found = [];
    const seen = new Set();

    for (const path of tree.files) {
      if (isSomebodyElses(tree, path)) continue;

      const segments = relative(tree.src, path).split(sep);
      for (let depth = 0; depth < segments.length; depth += 1) {
        const name = segments[depth];
        const at = tree.src + sep + segments.slice(0, depth + 1).join(sep);
        if (seen.has(at)) continue;
        seen.add(at);

        const bad = name.split(".").filter((part) => part && !KEBAB.test(part));
        if (bad.length > 0) {
          found.push({ path: at, message: `not kebab-case: ${bad.join(", ")}` });
        }
      }
    }
    return found;
  }
});
