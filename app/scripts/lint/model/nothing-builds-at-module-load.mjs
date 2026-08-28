import { check } from "../shared/check.mjs";
import { constructionsAtLoad, mutableBindings } from "../shared/module-load.mjs";

export default check({
  name: "nothing-builds-at-module-load",
  says: "Importing a module never produces a second instance of something the graph already holds one of.",
  subjects: {
    "no-construction": "no constructor call runs when a module is imported",
    "no-module-state": "no mutable module-scope binding anywhere under model/; holding an instance is the runtime's job"
  },
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("model"))) {
      if (!/\.ts$/.test(path) || path.includes("/test/")) continue;

      for (const construction of constructionsAtLoad(tree, path)) {
        found.push({
          subject: "no-construction",
          path,
          line: construction.line,
          message: `${construction.name} runs when the module is imported`
        });
      }
      for (const binding of mutableBindings(tree, path)) {
        found.push({
          subject: "no-module-state",
          path,
          line: binding.line,
          message: `${binding.keyword} ${binding.name} is one value shared by every instance`
        });
      }
    }
    return found;
  }
});
