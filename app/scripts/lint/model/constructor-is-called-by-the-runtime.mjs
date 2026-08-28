import { check } from "../shared/check.mjs";
import { objects, unitOf } from "../shared/trees.mjs";

export default check({
  name: "constructor-is-called-by-the-runtime",
  says: "Nothing outside runtime/ and the object's own files imports a constructor.ts. A second caller is a second instance of something meant to be one.",
  run(tree) {
    const units = objects(tree);
    const found = [];

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      if (tree.within(tree.path("runtime"), path)) continue;
      if (path.includes("/test/")) continue;
      const self = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "model") continue;

        const [environment, name, ...rest] = target.segments;
        if (rest.at(-1) !== "constructor") continue;
        if (self && self.id === `${environment}/${name}`) continue;

        found.push({
          path,
          line: record.line,
          message: `builds ${environment}/${name} itself; the runtime holds the one instance`
        });
      }
    }
    return found;
  }
});
