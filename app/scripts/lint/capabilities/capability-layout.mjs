import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

const INDEXES = ["index.remote.ts", "index.ts"];
const FILES = ["errors.ts"];
const DIRECTORIES = ["types", "constants", "api", "test"];

export default check({
  name: "capability-layout",
  says: "A capability holds its index, its types, its constants, and its procedures.",
  subjects: {
    "has-an-index": "a capability with no index has no surface",
    "permitted-entries": "nothing else sits at the root"
  },
  run(tree) {
    const found = [];
    for (const { name, path } of capabilities(tree)) {
      const files = tree.filesIn(path);

      if (!INDEXES.some((index) => files.includes(index))) {
        found.push({ subject: "has-an-index", path, message: `no ${INDEXES[0]}` });
      }

      const permitted = new Set([...INDEXES, ...FILES, `${name}.md`]);
      for (const file of files) {
        if (permitted.has(file)) continue;
        found.push({
          subject: "permitted-entries",
          path: join(path, file),
          message: `a capability root holds ${[...permitted].join(", ")}`
        });
      }
      for (const directory of tree.dirsIn(path)) {
        if (DIRECTORIES.includes(directory)) continue;
        found.push({
          subject: "permitted-entries",
          path: join(path, directory),
          message: `not one of ${DIRECTORIES.join(", ")}`
        });
      }
    }
    return found;
  }
});
