import ts from "typescript";

import { check } from "../shared/check.mjs";
import { bodyOfDeclaration, declarationNamed, roots } from "../shared/runtime.mjs";

/**
 * The two refusals each accessor owes, and what each one is guarded on.
 *
 * Collapsing them would report both mistakes in whichever words fit one of them:
 * reaching a tab's graph from the server can never succeed however long you
 * wait, and reaching it before the layout ran is only early.
 */
const GUARDS = {
  client: [
    { subject: "client-guards-browser", condition: /!\s*browser\b/ },
    { subject: "client-guards-absence", condition: /!\s*instance\b/ }
  ],
  server: [
    { subject: "server-guards-shutdown", condition: /(?<![!\w])closed\b/ },
    { subject: "server-guards-absence", condition: /!\s*instance\b/ }
  ]
};

/** `if (<condition>) throw …` at the top of a body, however the throw is written. */
const refusals = (tree, path, body) => {
  const found = [];
  if (!body || !ts.isBlock(body)) return found;
  for (const statement of body.statements) {
    if (!ts.isIfStatement(statement)) continue;
    let throws = false;
    const step = (node) => {
      if (ts.isThrowStatement(node)) throws = true;
      node.forEachChild(step);
    };
    step(statement.thenStatement);
    if (throws) found.push(statement.expression.getText(tree.source(path)));
  }
  return found;
};

export default check({
  name: "accessor-refuses-twice",
  says: "The accessor refuses rather than returns nothing, in two different words.",
  subjects: {
    "client-guards-browser": "reaching a tab's graph from the server is a category error, and says so",
    "client-guards-absence": "reaching it before the layout ran is a question of order, and says that instead",
    "server-guards-shutdown": "a request arriving mid-drain hears \"shutting down\", not \"not built\"",
    "server-guards-absence": "and one arriving before init hears the opposite"
  },
  run(tree) {
    const found = [];
    for (const { environment, accessor, startPath } of roots(tree)) {
      if (!tree.isFile(startPath)) continue;
      const conditions = refusals(tree, startPath, bodyOfDeclaration(declarationNamed(tree, startPath, accessor)));

      for (const { subject, condition } of GUARDS[environment]) {
        if (conditions.some((text) => condition.test(text))) continue;
        found.push({
          subject,
          path: startPath,
          message: `${accessor}() has no refusal guarded on ${condition.source}`
        });
      }
    }
    return found;
  }
});
