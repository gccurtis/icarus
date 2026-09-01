import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { vocabulary } from "../shared/keys.mjs";
import { workspaceFiles } from "../shared/trees.mjs";

/** `workspace.svelte` is the category's centre; `workspace-<subscreen>.svelte` is one of its states. */
const fileFor = (subscreen) => (subscreen === "workspace" ? "workspace.svelte" : `workspace-${subscreen}.svelte`);

export default check({
  name: "workspace-exists-for-every-screen",
  says: "The filesystem is the registry; a map beside it would be a second list of what exists.",
  subjects: {
    "declared-resolves": "every category-and-subscreen the vocabulary names resolves to a file, or that category renders blank",
    "file-is-declared": "every file resolves to a declared category, or it is unreachable"
  },
  run(tree) {
    const { path: keysPath, categories, subscreens } = vocabulary(tree);
    if (!categories || !subscreens) {
      return [{ subject: "declared-resolves", path: keysPath, message: "declares no categories" }];
    }

    const found = [];
    const root = tree.path("views", "workspaces");

    for (const category of categories) {
      for (const subscreen of subscreens.get(category) ?? []) {
        const path = join(root, category, fileFor(subscreen));
        if (tree.isFile(path)) continue;
        found.push({ subject: "declared-resolves", path, message: `${category}/${subscreen} renders blank` });
      }
    }

    for (const { category, file, path, subscreen } of workspaceFiles(tree)) {
      if (subscreen === undefined) {
        found.push({ subject: "file-is-declared", path, message: `${file} is not workspace or workspace-<subscreen>` });
        continue;
      }
      const declared = subscreens.get(category);
      if (!declared) {
        found.push({ subject: "file-is-declared", path, message: `${category} is not a declared category` });
        continue;
      }
      if (declared.includes(subscreen ?? "workspace")) continue;
      found.push({ subject: "file-is-declared", path, message: `${subscreen ?? "workspace"} is not one of ${category}'s subscreens` });
    }
    return found;
  }
});
