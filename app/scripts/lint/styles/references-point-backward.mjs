import { check } from "../shared/check.mjs";
import { declarationsIn, referencesIn } from "../shared/css.mjs";
import { READS, stageOf, stylesheets } from "../shared/styles.mjs";

export default check({
  name: "references-point-backward",
  says: "A stage reads the stage behind it, never ahead, and never past the public boundary.",
  subjects: {
    "stage-reads-behind-it":
      "a theme reads its own palette, slots read theme values, tokens read theme or chromatic values",
    "integration-reads-public-only": "an integration names public tokens and nothing behind them"
  },
  run(tree) {
    const sheets = stylesheets(tree);
    const declared = new Set();
    for (const path of sheets) {
      for (const { name } of declarationsIn(tree.read(path), path)) declared.add(name);
    }

    const found = [];
    for (const path of sheets) {
      const stage = stageOf(tree, path);
      const reads = READS[stage];
      if (!reads) continue;
      const subject = stage === "integration" ? "integration-reads-public-only" : "stage-reads-behind-it";

      for (const { name, line, prop } of referencesIn(tree.read(path), path)) {
        if (!reads(name)) {
          found.push({ subject, path, line, message: `${prop} reads ${name}, which is not behind it` });
          continue;
        }
        if (!declared.has(name)) {
          found.push({ subject, path, line, message: `${prop} reads ${name}, which nothing declares` });
        }
      }
    }
    return found;
  }
});
