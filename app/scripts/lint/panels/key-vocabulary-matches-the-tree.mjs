import { check } from "../shared/check.mjs";
import { vocabulary } from "../shared/keys.mjs";
import { panelLeaves } from "../shared/trees.mjs";

/** `context/project/health.svelte` is `"project.health"`. The path is the key. */
const keyOf = ({ subject, file }) => `${subject}.${file.replace(/\.svelte$/, "")}`;

const STACKS = { context: "contexts", inspector: "inspections" };

export default check({
  name: "key-vocabulary-matches-the-tree",
  says: "Its path is its key. The key vocabulary is generated from these paths, so a key naming no file cannot compile.",
  subjects: {
    "every-file-has-a-key": "a leaf the vocabulary does not name is unreachable",
    "every-key-has-a-file": "a key naming no leaf renders nothing at all"
  },
  run(tree) {
    const generated = vocabulary(tree);
    const found = [];
    const leaves = panelLeaves(tree).filter(({ file }) => file.endsWith(".svelte"));

    for (const [stack, field] of Object.entries(STACKS)) {
      const declared = generated[field];
      if (!declared) {
        found.push({
          subject: "every-file-has-a-key",
          path: generated.panelPath,
          message: `declares no vocabulary for ${stack}/`
        });
        continue;
      }

      const mine = leaves.filter((leaf) => leaf.stack === stack);
      const keys = new Set(mine.map(keyOf));

      for (const leaf of mine) {
        if (declared.includes(keyOf(leaf))) continue;
        found.push({ subject: "every-file-has-a-key", path: leaf.path, message: `${keyOf(leaf)} is not in the vocabulary` });
      }
      for (const key of declared) {
        if (keys.has(key)) continue;
        found.push({ subject: "every-key-has-a-file", path: generated.panelPath, message: `${key} names no leaf` });
      }
    }
    return found;
  }
});
