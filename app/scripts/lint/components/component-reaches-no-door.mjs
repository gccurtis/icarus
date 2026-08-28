import { check } from "../shared/check.mjs";

/** A component knows only its props, so none of these is reachable from here. */
const DOORS = new Set(["capabilities", "model", "runtime", "representation"]);

export default check({
  name: "component-reaches-no-door",
  says: "No file under components/ imports $capabilities, $model, $runtime or $representation.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("components"))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target || !DOORS.has(target.tree)) continue;
        found.push({
          path,
          line: record.line,
          message: `a component that reaches ${record.specifier} renders differently depending on where it is mounted`
        });
      }
    }
    return found;
  }
});
