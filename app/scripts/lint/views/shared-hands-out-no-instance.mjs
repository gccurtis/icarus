import ts from "typescript";
import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { constructionsAtLoad } from "../shared/module-load.mjs";
import { surfaces } from "../shared/trees.mjs";

/** What a caller may take from `shared/`: a way to make one, or a way to find one. */
const OFFERS = /^(create|make|build|use|get)[A-Z]/;

export default check({
  name: "shared-hands-out-no-instance",
  says: "shared/ constructs nothing at module load and exports nothing already made. An instance here outlives the mount and is handed to the next one, so two tabs share it.",
  run(tree) {
    const found = [];
    for (const { path } of surfaces(tree)) {
      for (const file of tree.under(join(path, "shared"))) {
        if (!file.endsWith(".ts")) continue;

        for (const construction of constructionsAtLoad(tree, file)) {
          found.push({
            path: file,
            line: construction.line,
            message: `${construction.name} runs at module load, so one value outlives every mount`
          });
        }

        const offered = [...tree.exports(file)];
        const values = offered.filter((name) => !isTypeOnly(tree, file, name));
        if (values.length === 0) continue;
        // A class is a constructor: `new Review(…)` is a way to make one, which
        // is the whole thing being asked for.
        if (values.some((name) => OFFERS.test(name) || isClass(tree, file, name))) continue;
        found.push({
          path: file,
          message: `exports ${values.join(", ")}; a caller needs a way to make one, not one already made`
        });
      }
    }
    return found;
  }
});

const isClass = (tree, path, wanted) =>
  tree
    .source(path)
    .statements.some((statement) => ts.isClassDeclaration(statement) && statement.name?.text === wanted);

/** A type export is erased, so it cannot be an instance and is not this check's business. */
const isTypeOnly = (tree, path, wanted) => {
  let found = false;
  for (const statement of tree.source(path).statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === wanted) found = true;
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === wanted) found = true;
  }
  return found;
};
