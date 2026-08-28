import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { vocabularies } from "../shared/trees.mjs";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The door and the vocabulary's own document answer to their own names. */
const EXEMPT = (vocabulary, name) => name === "index.ts" || name === `${vocabulary}.md`;

export default check({
  name: "file-is-named-for-its-directory",
  says: "Every file under authored/ is kebab-case and prefixed by the directory it sits in.",
  run(tree) {
    const found = [];
    for (const { name: vocabulary, path } of vocabularies(tree)) {
      for (const file of tree.filesIn(path)) {
        if (EXEMPT(vocabulary, file)) continue;
        const stem = file.split(".")[0];

        if (!KEBAB.test(stem)) {
          found.push({ path: join(path, file), message: `${stem} is not kebab-case` });
          continue;
        }
        if (stem !== vocabulary && !stem.startsWith(`${vocabulary}-`)) {
          found.push({ path: join(path, file), message: `not prefixed by ${vocabulary}` });
        }
      }
    }
    return found;
  }
});
