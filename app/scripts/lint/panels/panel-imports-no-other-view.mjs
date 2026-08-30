import { check } from "../shared/check.mjs";
import { panelLeaves } from "../shared/trees.mjs";

/** Capabilities, components, view state and modals. A panel needs nothing else. */
const REACHABLE = new Set([
  "capabilities",
  "authored-components",
  "vendored-components",
  "development-components",
  "modals"
]);
const AROUND_IT = new Set(["views", "workspaces"]);
const VIEW_STATE = ["client", "view-state"];

const isViewState = (segments) => VIEW_STATE.every((part, index) => segments[index] === part);

export default check({
  name: "panel-imports-no-other-view",
  says: "A panel does not import another panel, a surface, or a workspace. It renders on its own and holds no part of what is around it.",
  subjects: {
    "no-other-panel": "a panel shows another panel by key, so view state stays the one record of what is open",
    "no-surface": "a panel is rendered inside a surface; reaching back out to one is a cycle",
    "no-other-tree": "capabilities, components, view state and modals — a panel needs nothing else"
  },
  run(tree) {
    const found = [];
    for (const { path } of panelLeaves(tree)) {
      if (!path.endsWith(".svelte")) continue;

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target) continue; // a package
        if (REACHABLE.has(target.tree)) continue;
        if (target.tree === "model" && isViewState(target.segments)) continue;

        const subject =
          target.tree === "panels"
            ? "no-other-panel"
            : AROUND_IT.has(target.tree)
              ? "no-surface"
              : "no-other-tree";
        found.push({ subject, path, line: record.line, message: `imports ${record.specifier}` });
      }
    }
    return found;
  }
});
