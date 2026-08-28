import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { CONCERN_EXTENSIONS, BANNED } from "../shared/views.mjs";
import { surfaces } from "../shared/trees.mjs";

const CONCERNS = Object.keys(CONCERN_EXTENSIONS);

export default check({
  name: "concern-is-one-of-five",
  says: "A surface root holds its document, its component, its types, and the five concerns.",
  subjects: {
    "permitted-root-entries": "a surface root holds its document, its component, its types, and the five concerns",
    "banned-names": "no utils/, helpers/, stores/, index.ts: names that hide what a file is for"
  },
  run(tree) {
    const found = [];
    for (const { name, path } of surfaces(tree)) {
      const permitted = new Set([`${name}.md`, `${name}.svelte`, "types.ts"]);

      for (const file of tree.filesIn(path)) {
        const reason = BANNED.get(file);
        if (reason) {
          found.push({ subject: "banned-names", path: join(path, file), message: reason });
          continue;
        }
        if (permitted.has(file)) continue;
        found.push({
          subject: "permitted-root-entries",
          path: join(path, file),
          message: "a surface root holds its document, its component and its types"
        });
      }

      for (const directory of tree.dirsIn(path)) {
        const reason = BANNED.get(directory);
        if (reason) {
          found.push({ subject: "banned-names", path: join(path, directory), message: reason });
          continue;
        }
        if (CONCERNS.includes(directory) || directory === "test") continue;
        found.push({
          subject: "permitted-root-entries",
          path: join(path, directory),
          message: `not one of ${CONCERNS.join(", ")}`
        });
      }
    }
    return found;
  }
});
