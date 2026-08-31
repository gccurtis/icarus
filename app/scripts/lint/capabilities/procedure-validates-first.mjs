import ts from "typescript";

import { check } from "../shared/check.mjs";
import { procedureEntries } from "../shared/trees.mjs";
import { GATE, calleeOf, exportedFunctions, firstStatement, isCall } from "../shared/procedures.mjs";

/**
 * What a validation call is called. The generator writes one of these into every
 * new procedure, so the convention and the check come from the same place — a
 * procedure that reads as validating and is not is the failure this exists to
 * catch, and a name is the only thing a linter can read.
 *
 * This is the *shape* check and not the gate. Who is asking is
 * `no-procedure-acts-outside-a-scope`, which names one function rather than a
 * pattern, because authority is not something a naming convention can carry.
 */
const VALIDATORS = /^(as|parse|validate|assert|require|check)[A-Z]/;
const METHODS = new Set(["parse", "safeParse", "validate", "assert"]);

const isValidation = (statement) => {
  const callee = calleeOf(statement);
  if (!callee) return false;
  if (ts.isIdentifier(callee)) return VALIDATORS.test(callee.text);
  if (ts.isPropertyAccessExpression(callee)) return METHODS.has(callee.name.text);
  return false;
};

export default check({
  name: "procedure-validates-first",
  says: "Every api/<procedure> entry that takes an input checks it before acting on it, straight after the gate.",
  run(tree) {
    const found = [];
    for (const entry of procedureEntries(tree)) {
      for (const { body, parameters } of exportedFunctions(tree.source(entry))) {
        // Nothing arrived, so there is nothing to check. The gate still applies.
        if (parameters.length === 0) continue;

        const gated = isCall(firstStatement(body), GATE);
        const first = firstStatement(body, gated ? 1 : 0);
        if (first && isValidation(first)) continue;

        found.push({
          path: entry,
          line: first ? tree.lineOf(entry, first) : 1,
          message: first
            ? "acts on its input before checking it"
            : "the entry does nothing, so it cannot have checked anything"
        });
      }
    }
    return found;
  }
});
