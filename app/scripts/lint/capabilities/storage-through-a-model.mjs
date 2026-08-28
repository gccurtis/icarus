import { check } from "../shared/check.mjs";

export default check({
  name: "storage-through-a-model",
  says: "Nothing under capabilities/ imports $representation/store. The object that owns the lifetime is the only way in.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("capabilities"))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "representation") continue;
        if (target.segments[0] !== "store") continue;
        found.push({
          path,
          line: record.line,
          message: `opens storage directly: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
