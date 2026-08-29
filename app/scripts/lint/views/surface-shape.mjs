import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { surfaces } from "../shared/trees.mjs";

export default check({
  name: "surface-shape",
  says: "A surface directory holds a root component named for it, so the entry point is never a guess.",
  run(tree) {
    const found = [];
    for (const { name, path } of surfaces(tree)) {
      if (tree.isFile(join(path, `${name}.svelte`))) continue;
      found.push({ path: join(path, `${name}.svelte`), message: "a surface has one entry, named for it" });
    }
    return found;
  }
});
