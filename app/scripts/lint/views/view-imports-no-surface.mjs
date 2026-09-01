import { check } from "../shared/check.mjs";
import { viewLeaves } from "../shared/trees.mjs";

/** Capabilities, components and workspace state. A view needs nothing else. */
const REACHABLE = new Set([
  "capabilities",
  "authored-components",
  "vendored-components",
  "development-components"
]);
const WORKSPACE_STATE = ["client", "workspace-state"];

const isWorkspaceState = (segments) =>
  WORKSPACE_STATE.every((part, index) => segments[index] === part);

export default check({
  name: "view-imports-no-surface",
  says: "A view does not import another view or a surface. It renders on its own and holds no part of what is around it.",
  subjects: {
    "no-other-view": "a view shows another by key, so workspace state stays the one record of what is open",
    "no-surface": "a view is rendered inside a surface; reaching back out to one is a cycle",
    "no-other-tree": "capabilities, components and workspace state — a view needs nothing else"
  },
  run(tree) {
    const found = [];
    for (const { path } of viewLeaves(tree)) {
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target) continue; // a package
        if (REACHABLE.has(target.tree)) continue;
        if (target.tree === "model" && isWorkspaceState(target.segments)) continue;

        const subject =
          target.tree === "app-views"
            ? "no-other-view"
            : target.tree === "surfaces"
              ? "no-surface"
              : "no-other-tree";
        found.push({ subject, path, line: record.line, message: `imports ${record.specifier}` });
      }
    }
    return found;
  }
});
