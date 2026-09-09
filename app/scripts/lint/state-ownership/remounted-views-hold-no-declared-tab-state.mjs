import ts from "typescript";

import { check } from "../shared/check.mjs";
import { bindingNames } from "../shared/production.mjs";
import { categories } from "../shared/trees.mjs";

const classifications = (text) => {
  const found = new Map();
  const pattern = /@state-lifetime\s+(component|tab|resource|durable)\s*:\s*([^\n]+)/g;
  for (const match of text.matchAll(pattern)) {
    for (const name of match[2].split(",").map((part) => part.trim()).filter(Boolean)) {
      found.set(name, match[1]);
    }
  }
  return found;
};

const localState = (tree, path) => {
  const found = [];
  for (const script of tree.scripts(path)) {
    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        node.initializer.getText(script.source).includes("$state")
      ) {
        found.push(...bindingNames(node.name));
      }
      node.forEachChild(visit);
    };
    visit(script.source);
  }
  return [...new Set(found)].sort();
};

export default check({
  id: "OWN-03",
  pillar: "state-ownership",
  finding: "ARCH-06",
  name: "remounted-views-hold-no-declared-tab-state",
  says: "State in a keyed category content view is explicitly classified, and tab/resource/durable state is never local to that remounted component.",
  subjects: {
    "state-is-classified": "every local binding states its intended lifetime",
    "only-component-state-is-local": "longer-lived state cannot remain in the component"
  },
  run(tree) {
    const found = [];
    for (const category of categories(tree)) {
      const content = `${category.path}/content`;
      for (const file of tree.filesIn(content).filter((name) => name.endsWith(".svelte"))) {
        const path = `${content}/${file}`;
        const bindings = localState(tree, path);
        if (bindings.length === 0) continue;
        const declared = classifications(tree.read(path));
        const missing = bindings.filter((name) => !declared.has(name));
        if (missing.length > 0) {
          found.push({
            subject: "state-is-classified",
            path,
            fingerprint: missing.join(","),
            message: `local state has no @state-lifetime classification: ${missing.join(", ")}`
          });
        }
        const misplaced = bindings.filter((name) => {
          const lifetime = declared.get(name);
          return lifetime && lifetime !== "component";
        });
        if (misplaced.length > 0) {
          found.push({
            subject: "only-component-state-is-local",
            path,
            fingerprint: misplaced.map((name) => `${name}:${declared.get(name)}`).join(","),
            message: `local bindings declare a longer lifetime: ${misplaced.map((name) => `${name} (${declared.get(name)})`).join(", ")}`
          });
        }
      }
    }
    return found;
  }
});
