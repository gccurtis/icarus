import { check } from "../shared/check.mjs";
import { SERVER, TEST, homes } from "../shared/home.mjs";

export default check({
  name: "node-is-server-only",
  says: "node:* appears in no client or shared module.",
  run(tree) {
    const found = [];
    for (const [path, { home }] of homes(tree)) {
      if (home === SERVER || home === TEST || home === null) continue;
      for (const record of tree.imports(path)) {
        if (!record.specifier.startsWith("node:")) continue;
        found.push({
          path,
          line: record.line,
          message: `${record.specifier} in a ${home} module`
        });
      }
    }
    return found;
  }
});
