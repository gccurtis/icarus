import ts from "typescript";

import { check } from "../shared/check.mjs";
import { declarationNamed, roots } from "../shared/runtime.mjs";

const isExported = (node) => {
  const statement = node?.statement ?? node;
  if (!statement || !ts.canHaveModifiers(statement)) return false;
  return (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
};

export default check({
  name: "builder-is-not-exported",
  says: "No build<Env>Model leaves its module. The initializer returns what it built, so nothing needs a second way in.",
  run(tree) {
    const found = [];
    for (const { environment, builder, startPath } of roots(tree)) {
      if (!tree.isFile(startPath)) {
        found.push({ path: startPath, message: `the ${environment} root is not there` });
        continue;
      }
      const declared = declarationNamed(tree, startPath, builder);
      if (!declared) {
        found.push({ path: startPath, message: `declares no ${builder}` });
        continue;
      }
      if (isExported(declared)) {
        found.push({ path: startPath, message: `${builder} is exported, which is a second way to stand up a graph` });
      }
      if (tree.exports(startPath).has(builder)) {
        found.push({ path: startPath, message: `${builder} is re-exported` });
      }
    }
    return found;
  }
});
