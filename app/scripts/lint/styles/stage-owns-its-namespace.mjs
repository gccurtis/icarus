import { check } from "../shared/check.mjs";
import { declarationsIn } from "../shared/css.mjs";
import { OWNS, stageOf, stylesheets } from "../shared/styles.mjs";

export default check({
  name: "stage-owns-its-namespace",
  says: "Themes declare --palette-* and --theme-*, slots --chromatic-*, tokens --token-*, integrations none of them.",
  run(tree) {
    const found = [];
    for (const path of stylesheets(tree)) {
      const stage = stageOf(tree, path);
      const owns = OWNS[stage];
      if (!owns) continue;

      for (const { name, line } of declarationsIn(tree.read(path), path)) {
        if (owns(name)) continue;
        found.push({ path, line, message: `${name} belongs to another stage` });
      }
    }
    return found;
  }
});
