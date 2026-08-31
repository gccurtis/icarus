import ts from "typescript";

import { check } from "../shared/check.mjs";
import { procedureEntries } from "../shared/trees.mjs";
import { GATE, exportedFunctions, firstStatement, isCall } from "../shared/procedures.mjs";

export default check({
  name: "no-procedure-acts-outside-a-scope",
  says: `Every api/<procedure> entry opens with ${GATE}(). One function establishes who is asking and which project, so a procedure cannot be reached without one.`,
  run(tree) {
    const found = [];
    for (const entry of procedureEntries(tree)) {
      const source = tree.source(entry);
      const functions = exportedFunctions(source);

      if (functions.length === 0) {
        found.push({ path: entry, message: "exports no function, so nothing is gated" });
        continue;
      }

      for (const { body } of functions) {
        const first = firstStatement(body);
        if (first && isCall(first, GATE)) continue;
        found.push({
          path: entry,
          line: first ? tree.lineOf(entry, first) : 1,
          message: first ? `does not open with ${GATE}()` : "does nothing, so it cannot have been gated"
        });
      }
    }
    return found;
  }
});
