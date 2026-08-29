import { check } from "../shared/check.mjs";

export default check({
  name: "nothing-imports-development",
  says: "Nothing outside development/ imports a development surface. It may import anything; the trade only holds in one direction.",
  run(tree) {
    const development = tree.path("views", "development");
    const found = [];

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      if (tree.within(development, path)) continue;
      if (tree.within(tree.routes, path)) continue;

      for (const record of tree.imports(path)) {
        const resolved = tree.resolve(record.specifier, path);
        if (!resolved || !tree.within(development, resolved)) continue;
        found.push({
          path,
          line: record.line,
          message: `imports a development surface: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
