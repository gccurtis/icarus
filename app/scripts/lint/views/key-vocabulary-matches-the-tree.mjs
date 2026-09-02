import { check } from "../shared/check.mjs";
import { vocabulary } from "../shared/keys.mjs";
import { viewLeaves } from "../shared/trees.mjs";

/** `categories/analysis/context/fields.svelte` is `"analysis.fields"`. The path is the key. */
const keyOf = ({ category, name }) => `${category}.${name}`;

const STACKS = { context: "contexts", inspector: "inspections" };

export default check({
  name: "key-vocabulary-matches-the-tree",
  says: "Its path is its key. A view the vocabulary does not name is a view nothing can open.",
  // One direction only. The vocabulary is the plan and the tree is progress
  // against it, so a key with no view is a view not built yet — it renders the
  // placeholder, which names itself. A view with no key is the failure: nothing
  // routes to it and no rail can offer it.
  //
  // `content/` is not here. Those names are generated from the tree by
  // `pnpm category-keys`, so its `--check` is what holds them.
  //
  // `general/` is not here either. It holds views that no category owns, and one
  // of them — the function builder — is a modal opened from a panel rather than
  // a lens reached by key, so "its path is its key" is not true of that shelf.
  // The shelf is ten named directories rather than an open tree, which is what
  // makes leaving it uncovered affordable.
  run(tree) {
    const generated = vocabulary(tree);
    const found = [];
    const leaves = viewLeaves(tree).filter(({ category }) => category !== "general");

    for (const [surface, field] of Object.entries(STACKS)) {
      const declared = generated[field];
      if (!declared) {
        found.push({ path: generated.viewPath, message: `declares no vocabulary for ${surface}/` });
        continue;
      }

      for (const leaf of leaves.filter((candidate) => candidate.surface === surface)) {
        if (declared.includes(keyOf(leaf))) continue;
        found.push({ path: leaf.path, message: `${keyOf(leaf)} is not in the vocabulary` });
      }
    }
    return found;
  }
});
