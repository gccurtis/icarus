import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

const DOORS = ["index.remote.ts", "index.ts"];
const FILES = ["errors.ts"];
const DIRECTORIES = ["types", "constants", "api", "test"];

export default check({
  name: "capability-layout",
  says: "A capability holds its door, its types, its constants, and its procedures.",
  subjects: {
    "has-a-door": "a capability with no door has no surface",
    "permitted-entries": "nothing else sits at the root"
  },
  run(tree) {
    const found = [];
    for (const { name, path } of capabilities(tree)) {
      const files = tree.filesIn(path);

      if (!DOORS.some((door) => files.includes(door))) {
        found.push({ subject: "has-a-door", path, message: `no ${DOORS[0]}` });
      }

      const permitted = new Set([...DOORS, ...FILES, `${name}.md`]);
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
