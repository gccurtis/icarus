import { check } from "../shared/check.mjs";
import { vocabulary } from "../shared/keys.mjs";
import { panelLeaves } from "../shared/trees.mjs";

/** `context/project/health.svelte` is `"project.health"`. The path is the key. */
const keyOf = ({ subject, file }) => `${subject}.${file.replace(/\.svelte$/, "")}`;

const STACKS = { context: "contexts", inspector: "inspections" };

export default check({
  name: "key-vocabulary-matches-the-tree",
  says: "Its path is its key. A panel the vocabulary does not name is a panel nothing can open.",
  // One direction only. The vocabulary is the plan and the tree is progress
  // against it, so a key with no panel is a panel not built yet — it renders the
  // placeholder, which names itself. A panel with no key is the failure: nothing
  // routes to it and no rail can offer it.
  run(tree) {
    const generated = vocabulary(tree);
    const found = [];
    const leaves = panelLeaves(tree).filter(({ file }) => file.endsWith(".svelte"));

    for (const [stack, field] of Object.entries(STACKS)) {
      const declared = generated[field];
      if (!declared) {
        found.push({ path: generated.panelPath, message: `declares no vocabulary for ${stack}/` });
        continue;
      }

      for (const leaf of leaves.filter((candidate) => candidate.stack === stack)) {
        if (declared.includes(keyOf(leaf))) continue;
        found.push({ path: leaf.path, message: `${keyOf(leaf)} is not in the vocabulary` });
      }
    }
    return found;
  }
});
