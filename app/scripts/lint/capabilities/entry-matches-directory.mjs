import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

/** `shared/` holds steps two procedures both take; it is not a call tree of its own. */
const NOT_A_PROCEDURE = new Set(["shared"]);

export default check({
  name: "entry-matches-directory",
  says: "Every directory under api/ holds a file of the same name, at every depth. Without it a procedure's entry point is a guess.",
  run(tree) {
    const found = [];
    const walk = (dir) => {
      for (const name of tree.dirsIn(dir)) {
        const child = join(dir, name);
        if (!NOT_A_PROCEDURE.has(name) && !tree.isFile(join(child, `${name}.ts`))) {
          found.push({ path: child, message: `holds no ${name}.ts, so its entry point is a guess` });
        }
        walk(child);
      }
    };

    for (const { path } of capabilities(tree)) {
      const api = join(path, "api");
      if (tree.exists(api)) walk(api);
    }
    return found;
  }
});
