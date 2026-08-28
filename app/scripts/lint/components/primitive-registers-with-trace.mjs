import { check } from "../shared/check.mjs";
import { vocabularies } from "../shared/trees.mjs";

const REGISTRATION = "traceNode";

export default check({
  name: "primitive-registers-with-trace",
  says: "Every .svelte under authored/ calls the trace registration, or a review page renders a tree it cannot describe.",
  run(tree) {
    const found = [];
    for (const { path } of vocabularies(tree)) {
      for (const file of tree.under(path)) {
        if (!file.endsWith(".svelte")) continue;
        const takesIt = tree
          .imports(file)
          .some((record) => record.names.includes(REGISTRATION));
        if (takesIt && tree.read(file).includes(`${REGISTRATION}(`)) continue;
        found.push({ path: file, message: `does not call ${REGISTRATION}` });
      }
    }
    return found;
  }
});
