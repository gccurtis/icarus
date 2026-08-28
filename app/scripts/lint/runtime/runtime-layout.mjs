import { join } from "node:path";

import { check } from "../shared/check.mjs";

/**
 * Twelve files, and this is the list. Something new here is a decision about how
 * the application comes up, which is worth a line in a diff rather than a
 * directory that quietly grows.
 */
const LAYOUT = {
  "": { files: ["runtime.md"], dirs: ["client", "server"] },
  client: { files: ["client.md", "start.ts", "types.ts"], dirs: ["test"] },
  server: { files: ["server.md", "start.server.ts", "types.ts", "scope.server.ts"], dirs: ["test"] }
};

export default check({
  name: "runtime-layout",
  says: "Only the named files exist. Something new here is a decision, not an addition.",
  run(tree) {
    const found = [];
    for (const [where, { files, dirs }] of Object.entries(LAYOUT)) {
      const dir = where ? tree.path("runtime", where) : tree.path("runtime");

      for (const name of files) {
        if (tree.isFile(join(dir, name))) continue;
        found.push({ path: join(dir, name), message: "is named by the layout and is not there" });
      }
      for (const name of tree.filesIn(dir)) {
        if (files.includes(name)) continue;
        found.push({ path: join(dir, name), message: "is not one of the files this tree holds" });
      }
      for (const name of tree.dirsIn(dir)) {
        if (dirs.includes(name)) continue;
        found.push({ path: join(dir, name), message: "is not one of the directories this tree holds" });
      }
    }
    return found;
  }
});
