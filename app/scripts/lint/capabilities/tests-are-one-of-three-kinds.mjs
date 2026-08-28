import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { TEST_KINDS, capabilities } from "../shared/trees.mjs";

export default check({
  name: "tests-are-one-of-three-kinds",
  says: `Nothing under test/ outside ${TEST_KINDS.join(", ")}.`,
  run(tree) {
    const found = [];
    for (const { path } of capabilities(tree)) {
      const root = join(path, "test");
      if (!tree.exists(root)) continue;

      for (const name of tree.filesIn(root)) {
        found.push({ path: join(root, name), message: "sits directly under test/, which holds only the three kinds" });
      }
      for (const name of tree.dirsIn(root)) {
        if (TEST_KINDS.includes(name)) continue;
        found.push({ path: join(root, name), message: `not one of ${TEST_KINDS.join(", ")}` });
      }
    }
    return found;
  }
});
