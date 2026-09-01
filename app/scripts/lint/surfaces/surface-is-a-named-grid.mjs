import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { surfaces, viewLeaves } from "../shared/trees.mjs";

/**
 * A named grid, not a stack of divs: `grid-template-areas` with regions named
 * for what they hold, so what appears where survives a reorder of the markup.
 */
const AREAS = /grid-template-areas\s*:/;
const REGION = /grid-area\s*:|["'][a-z][a-z0-9-]*(\s+[a-z][a-z0-9-]*)*["']/;

const laysItselfOut = (text) => AREAS.test(text) && REGION.test(text);

export default check({
  name: "surface-is-a-named-grid",
  says: "Every surface lays itself out with grid-template-areas and named regions.",
  run(tree) {
    const found = [];

    for (const { name, path } of surfaces(tree)) {
      const root = join(path, `${name}.svelte`);
      if (!tree.isFile(root)) continue; // surface-shape is what says the root is missing
      if (laysItselfOut(tree.read(root))) continue;
      found.push({ path: root, message: "does not name its regions with grid-template-areas" });
    }

    // A content view is the centre of a category, so it is a surface for this
    // rule even though a category holds one file per view rather than a root.
    for (const { path } of viewLeaves(tree).filter(({ surface }) => surface === "content")) {
      if (laysItselfOut(tree.read(path))) continue;
      found.push({ path, message: "does not name its regions with grid-template-areas" });
    }
    return found;
  }
});
