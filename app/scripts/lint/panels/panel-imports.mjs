import { check } from "../shared/check.mjs";
import { panelLeaves } from "../shared/trees.mjs";

/** Capabilities, view state and components. Nothing else. */
const ALLOWED = new Set(["capabilities", "components"]);
const VIEW_STATE = ["client", "view-state"];

const isViewState = (segments) => VIEW_STATE.every((part, index) => segments[index] === part);

export default check({
  name: "panel-imports",
  says: "Capabilities, view state and components. Nothing else — no other panel, no surface.",
  run(tree) {
    const found = [];
    for (const { path } of panelLeaves(tree)) {
      if (!path.endsWith(".svelte")) continue;

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target) continue; // a package
        if (ALLOWED.has(target.tree)) continue;
        if (target.tree === "model" && isViewState(target.segments)) continue;
        found.push({
          path,
          line: record.line,
          message: `reaches ${record.specifier}`
        });
      }
    }
    return found;
  }
});
