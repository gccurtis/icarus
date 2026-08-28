import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { vocabulary } from "../shared/keys.mjs";
import { workspaceFiles } from "../shared/trees.mjs";

/** `workspace.svelte` is the screen's centre; `workspace-<subscreen>.svelte` is one of its states. */
const fileFor = (subscreen) => (subscreen === "workspace" ? "workspace.svelte" : `workspace-${subscreen}.svelte`);

export default check({
  name: "workspace-exists-for-every-screen",
  says: "The filesystem is the registry; a map beside it would be a second list of what exists.",
  subjects: {
    "declared-resolves": "every screen-and-subscreen the vocabulary names resolves to a file, or that screen renders blank",
    "file-is-declared": "every file resolves to a declared screen, or it is unreachable"
  },
  run(tree) {
    const { path: keysPath, screens, subscreens } = vocabulary(tree);
    if (!screens || !subscreens) {
      return [{ subject: "declared-resolves", path: keysPath, message: "declares no screens" }];
    }

    const found = [];
    const root = tree.path("views", "workspaces");

    for (const screen of screens) {
      for (const subscreen of subscreens.get(screen) ?? []) {
        const path = join(root, screen, fileFor(subscreen));
        if (tree.isFile(path)) continue;
        found.push({ subject: "declared-resolves", path, message: `${screen}/${subscreen} renders blank` });
      }
    }

    for (const { screen, file, path, subscreen } of workspaceFiles(tree)) {
      if (subscreen === undefined) {
        found.push({ subject: "file-is-declared", path, message: `${file} is not workspace or workspace-<subscreen>` });
        continue;
      }
      const declared = subscreens.get(screen);
      if (!declared) {
        found.push({ subject: "file-is-declared", path, message: `${screen} is not a declared screen` });
        continue;
      }
      if (declared.includes(subscreen ?? "workspace")) continue;
      found.push({ subject: "file-is-declared", path, message: `${subscreen ?? "workspace"} is not one of ${screen}'s subscreens` });
    }
    return found;
  }
});
