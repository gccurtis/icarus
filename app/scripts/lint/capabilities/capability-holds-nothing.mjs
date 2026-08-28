import { check } from "../shared/check.mjs";
import { constructionsAtLoad, mutableBindings } from "../shared/module-load.mjs";

export default check({
  name: "capability-holds-nothing",
  says: "Nothing survives a call. Two requests share a process; anything one leaves behind is the next one's bug.",
  subjects: {
    "no-module-state": "no mutable module-scope binding",
    "no-construction-at-load": "nothing is built when the module is imported"
  },
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("capabilities"))) {
      if (!/\.ts$/.test(path) || path.includes("/test/")) continue;

      for (const binding of mutableBindings(tree, path)) {
        found.push({
          subject: "no-module-state",
          path,
          line: binding.line,
          message: `${binding.keyword} ${binding.name} at module scope survives the call`
        });
      }
      for (const construction of constructionsAtLoad(tree, path)) {
        found.push({
          subject: "no-construction-at-load",
          path,
          line: construction.line,
          message: `${construction.name} runs when the module is imported`
        });
      }
    }
    return found;
  }
});
