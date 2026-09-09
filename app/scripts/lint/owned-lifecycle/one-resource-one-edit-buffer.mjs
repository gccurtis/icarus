import { join } from "node:path";

import { check } from "../shared/check.mjs";

export default check({
  id: "LIFE-06",
  pillar: "owned-lifecycle",
  finding: "ARCH-03",
  name: "one-resource-one-edit-buffer",
  says: "Each resource register checks its open map before creating exactly one runtime for an id.",
  run(tree) {
    const found = [];
    for (const name of tree.dirsIn(tree.path("model", "client")).filter((part) => part.endsWith("-runtimes"))) {
      const path = join(tree.path("model", "client", name), "methods", "attach.ts");
      const text = tree.read(path);
      const lookup = text.search(/\.open\.get\s*\(\s*id\s*\)/);
      const creates = [...text.matchAll(/\bcreateRuntime\s*\(\s*id\s*\)/g)];
      const firstCreate = creates[0]?.index ?? -1;
      if (tree.isFile(path) && lookup >= 0 && creates.length === 1 && lookup < firstCreate) continue;
      found.push({
        path: tree.isFile(path) ? path : join(tree.path("model", "client", name), "methods"),
        fingerprint: name,
        message: `${name} does not prove lookup-before-single-create for one resource id`
      });
    }
    return found;
  }
});
