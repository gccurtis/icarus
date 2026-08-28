import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { surfaces } from "../shared/trees.mjs";

export default check({
  name: "surface-shape",
  says: "A surface directory holds a document and a root component, both named for it, so the entry point is never a guess.",
  run(tree) {
    const found = [];
    for (const { name, path } of surfaces(tree)) {
      if (!tree.isFile(join(path, `${name}.svelte`))) {
        found.push({ path: join(path, `${name}.svelte`), message: "a surface has one entry, named for it" });
      }
      if (!tree.isFile(join(path, `${name}.md`))) {
        found.push({ path: join(path, `${name}.md`), message: "a surface says what it is, in a document named for it" });
      }
    }
    return found;
  }
});
