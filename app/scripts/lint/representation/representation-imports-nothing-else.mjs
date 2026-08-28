import { check } from "../shared/check.mjs";

export default check({
  name: "representation-imports-nothing-else",
  says: "No file in this tree imports any other tree. A vocabulary that depended on a consumer would not be one.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("representation"))) {
      if (!/\.(ts|js)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target || target.tree === "representation") continue;
        found.push({
          path,
          line: record.line,
          message: `reaches ${target.tree}: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
