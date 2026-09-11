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
  says: "A graph builder is private when colocated, or exported only to its one start module when split into runtime/models.",
  run(tree) {
    const found = [];
    for (const { environment, builder, builderPath, startPath } of roots(tree)) {
      if (!tree.isFile(builderPath)) {
        found.push({ path: builderPath, message: `the ${environment} builder is not there` });
        continue;
      }
      const declared = declarationNamed(tree, builderPath, builder);
      if (!declared) {
        found.push({ path: builderPath, message: `declares no ${builder}` });
        continue;
      }

      if (builderPath === startPath) {
        if (isExported(declared)) {
          found.push({ path: startPath, message: `${builder} is exported, which is a second way to stand up a graph` });
        }
        if (tree.exports(startPath).has(builder)) {
          found.push({ path: startPath, message: `${builder} is re-exported` });
        }
        continue;
      }

      if (!isExported(declared)) {
        found.push({ path: builderPath, message: `${builder} is not exported to its start module` });
      }
      const importers = tree.files.filter((path) =>
        tree.imports(path).some((record) => {
          if (!record.names.includes(builder)) return false;
          return tree.resolve(record.specifier, path) === builderPath;
        })
      );
      for (const importer of importers) {
        if (importer === startPath) continue;
        found.push({ path: importer, message: `imports ${builder}; only the ${environment} start module may stand up the graph` });
      }
      if (importers.length !== 1 || importers[0] !== startPath) {
        found.push({
          path: builderPath,
          message: `${builder} must have exactly one importer, ${tree.rel(startPath)}; found ${importers.map((path) => tree.rel(path)).join(", ") || "none"}`
        });
      }
    }
    return found;
  }
});
