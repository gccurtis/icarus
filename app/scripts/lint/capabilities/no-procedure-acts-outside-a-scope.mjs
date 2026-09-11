import ts from "typescript";

import { check } from "../shared/check.mjs";
import { procedureEntries } from "../shared/trees.mjs";
import {
  GATE,
  exportedFunctions,
  firstStatement,
  hasCapabilityContext,
  isCall
} from "../shared/procedures.mjs";

export default check({
  name: "no-procedure-acts-outside-a-scope",
  says: `Every api/<procedure> entry receives CapabilityContext, or retains the baselined ${GATE}() gate until migrated.`,
  run(tree) {
    const found = [];
    for (const entry of procedureEntries(tree)) {
      const source = tree.source(entry);
      const functions = exportedFunctions(source);

      if (functions.length === 0) {
        found.push({ path: entry, message: "exports no function, so nothing is gated" });
        continue;
      }

      for (const { body, parameters } of functions) {
        if (hasCapabilityContext({ parameters })) continue;
        const first = firstStatement(body);
        if (first && isCall(first, GATE)) continue;
        found.push({
          path: entry,
          line: first ? tree.lineOf(entry, first) : 1,
          message: first
            ? `neither receives CapabilityContext nor opens with ${GATE}()`
            : "does nothing, so it cannot have received authenticated scope"
        });
      }
    }
    return found;
  }
});
