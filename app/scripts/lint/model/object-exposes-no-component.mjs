import ts from "typescript";

import { check } from "../shared/check.mjs";

/** What a Svelte component is called in a type position. */
const COMPONENT_TYPES = /\b(Component|SvelteComponent|ComponentType|Snippet)\b/;

export default check({
  name: "object-exposes-no-component",
  says: "An object exposes keys, never components. What a key renders as is the view's decision, and a model that named a component would decide it twice.",
  subjects: {
    "no-component-type": "no model type names or imports a Svelte Component",
    "no-svelte-file": "no model file is a .svelte"
  },
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("model"))) {
      if (path.endsWith(".svelte")) {
        found.push({ subject: "no-svelte-file", path, message: "a model object holds no markup" });
        continue;
      }
      if (!path.endsWith(".ts") || path.includes("/test/")) continue;

      for (const record of tree.imports(path)) {
        const fromSvelte = record.specifier === "svelte" || record.specifier.startsWith("svelte/");
        const componentName = record.names.some((name) => COMPONENT_TYPES.test(name));
        const isComponentFile = (tree.resolve(record.specifier, path) ?? "").endsWith(".svelte");
        if ((fromSvelte && componentName) || isComponentFile) {
          found.push({
            subject: "no-component-type",
            path,
            line: record.line,
            message: `names a component: ${record.specifier}`
          });
        }
      }

      tree.eachNode(path, (node) => {
        if (!ts.isTypeReferenceNode(node)) return;
        const name = node.typeName.getText(tree.source(path));
        if (!COMPONENT_TYPES.test(name)) return;
        found.push({
          subject: "no-component-type",
          path,
          line: tree.lineOf(path, node),
          message: `type ${name} decides what a key renders as`
        });
      });
    }
    return found;
  }
});
