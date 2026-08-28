import { check } from "../shared/check.mjs";
import { literalColourDeclarations } from "../shared/css.mjs";
import { stageOf, stylesheets } from "../shared/styles.mjs";

export default check({
  name: "literal-colours-in-themes-only",
  says: "A colour is written in <theme>/<theme>.css and named everywhere else. Anywhere else it is a value a theme switch cannot reach.",
  run(tree) {
    const found = [];
    for (const path of stylesheets(tree)) {
      if (stageOf(tree, path) === "theme") continue;
      for (const { prop, colours, line } of literalColourDeclarations(tree.read(path), path)) {
        found.push({ path, line, message: `${prop}: ${colours.join(", ")}` });
      }
    }
    return found;
  }
});
