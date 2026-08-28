import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { unitOf, vocabularies } from "../shared/trees.mjs";

export default check({
  name: "vocabulary-is-entered-at-index",
  says: "A vocabulary is entered at its index. Its internal file names are its own business.",
  subjects: {
    "index-exists": "every vocabulary directory holds an index.ts",
    "no-deep-import": "no import from outside a vocabulary names a path below its index"
  },
  run(tree) {
    const units = vocabularies(tree);
    const found = [];

    for (const { name, path } of units) {
      if (!tree.isFile(join(path, "index.ts"))) {
        found.push({ subject: "index-exists", path, message: `${name} holds no index.ts, so it has no surface` });
      }
    }

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      const self = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "authored-components") continue;
        const [vocabulary, ...rest] = target.segments;
        if (!vocabulary) continue;
        if (self?.name === vocabulary) continue;
        if (rest.length === 0) continue;

        found.push({
          subject: "no-deep-import",
          path,
          line: record.line,
          message: `reaches past ${vocabulary}'s index: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
