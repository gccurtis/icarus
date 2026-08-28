import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { surfaces } from "../shared/trees.mjs";

/** The two concerns that hold no reactive state: a step, and an intent. */
const PLAIN = ["procedures", "interactions"];

export default check({
  name: "effects-declare-runes",
  says: "Checked both ways — either direction is a file that does not do what it looks like.",
  subjects: {
    "effects-are-svelte-ts": "everything under effects/ is compiled, or its runes never run",
    "others-declare-no-rune": "nothing under procedures/ or interactions/ holds one"
  },
  run(tree) {
    const found = [];
    for (const { path } of surfaces(tree)) {
      for (const file of tree.under(join(path, "effects"))) {
        if (!file.endsWith(".ts") || file.endsWith(".svelte.ts")) continue;
        found.push({ subject: "effects-are-svelte-ts", path: file, message: "is not .svelte.ts, so its runes never run" });
      }
      for (const concern of PLAIN) {
        for (const file of tree.under(join(path, concern))) {
          if (!file.endsWith(".ts")) continue;
          if (!tree.declaresRunes(file)) continue;
          found.push({ subject: "others-declare-no-rune", path: file, message: `${concern}/ holds no reactive state` });
        }
      }
    }
    return found;
  }
});
