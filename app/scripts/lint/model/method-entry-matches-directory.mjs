import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { objects } from "../shared/trees.mjs";

/** `shared/` holds steps two methods both take; it is not a call tree of its own. */
const NOT_A_METHOD = new Set(["shared"]);
const ENTRIES = [".ts", ".svelte.ts"];

export default check({
  name: "method-entry-matches-directory",
  says: "Every method directory holds a file of the same name, at every depth.",
  run(tree) {
    const found = [];
    const walk = (dir) => {
      for (const name of tree.dirsIn(dir)) {
        const child = join(dir, name);
        if (!NOT_A_METHOD.has(name) && !ENTRIES.some((suffix) => tree.isFile(join(child, name + suffix)))) {
          found.push({ path: child, message: `holds no ${name}.ts, so its entry point is a guess` });
        }
        walk(child);
      }
    };

    for (const { path } of objects(tree)) {
      const methods = join(path, "methods");
      if (tree.exists(methods)) walk(methods);
    }
    return found;
  }
});
