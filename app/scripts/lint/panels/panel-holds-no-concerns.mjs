import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { PANEL_TREES } from "../shared/trees.mjs";

export default check({
  name: "panel-holds-no-concerns",
  says: "A subject directory holds .svelte files and nothing else.",
  run(tree) {
    const found = [];
    for (const stack of PANEL_TREES) {
      const root = tree.path("views", "panels", stack);
      for (const subject of tree.dirsIn(root)) {
        const path = join(root, subject);
        for (const file of tree.filesIn(path)) {
          if (file.endsWith(".svelte") || file === `${subject}.md`) continue;
          found.push({ path: join(path, file), message: "a subject holds leaves and nothing else" });
        }
        for (const child of tree.dirsIn(path)) {
          found.push({ path: join(path, child), message: "a subject is flat; a leaf is one file" });
        }
      }
    }
    return found;
  }
});
