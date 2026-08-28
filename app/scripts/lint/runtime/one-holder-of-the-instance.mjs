import { check } from "../shared/check.mjs";
import { mutableBindings } from "../shared/module-load.mjs";
import { roots } from "../shared/runtime.mjs";

export default check({
  name: "one-holder-of-the-instance",
  says: "One place holds the instance. A second cache is a second graph.",
  subjects: {
    "state-only-in-start": "a mutable module-scope binding appears in start*",
    "no-state-elsewhere": "and nowhere else in the repository"
  },
  run(tree) {
    const holders = new Set(roots(tree).map(({ startPath }) => startPath));
    const found = [];

    for (const { environment, startPath } of roots(tree)) {
      if (!tree.isFile(startPath)) continue;
      if (mutableBindings(tree, startPath).length === 0) {
        found.push({
          subject: "state-only-in-start",
          path: startPath,
          message: `holds no instance, so nothing remembers the ${environment} graph`
        });
      }
    }

    for (const path of tree.under(tree.path("runtime"))) {
      if (!path.endsWith(".ts") || path.includes("/test/")) continue;
      if (holders.has(path)) continue;
      for (const binding of mutableBindings(tree, path)) {
        found.push({
          subject: "no-state-elsewhere",
          path,
          line: binding.line,
          message: `${binding.keyword} ${binding.name} is a second holder`
        });
      }
    }
    return found;
  }
});
