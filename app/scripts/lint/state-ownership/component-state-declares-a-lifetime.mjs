import { basename, dirname, join } from "node:path";
import ts from "typescript";

import { check } from "../shared/check.mjs";
import { constructionsAtLoad, mutableBindings } from "../shared/module-load.mjs";
import { bindingNames, productionSvelte } from "../shared/production.mjs";

const isState = (node) => {
  let found = false;
  const visit = (child) => {
    if (
      ts.isCallExpression(child) &&
      (ts.isIdentifier(child.expression) && child.expression.text === "$state" ||
        ts.isPropertyAccessExpression(child.expression) &&
          ts.isIdentifier(child.expression.expression) &&
          child.expression.expression.text === "$state")
    ) {
      found = true;
    }
    if (!found) child.forEachChild(visit);
  };
  visit(node);
  return found;
};

const stateBindings = (tree, path) => {
  const found = [];
  for (const script of tree.scripts(path)) {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer && isState(node.initializer)) {
        found.push(...bindingNames(node.name));
      }
      node.forEachChild(visit);
    };
    visit(script.source);
  }
  return [...new Set(found)].sort();
};

const stateModuleOf = (tree, path) => {
  const directory = dirname(path);
  const stem = basename(path, ".svelte");
  return [join(directory, "state.svelte.ts"), join(directory, `${stem}.state.svelte.ts`)].find(
    (candidate) => tree.isFile(candidate)
  );
};

const constructsStateOwner = (tree, component, stateModule) => {
  if (!stateModule) return false;
  const names = tree
    .imports(component)
    .filter((record) => tree.resolve(record.specifier, component) === stateModule)
    .flatMap((record) => record.names);
  if (names.length === 0) return false;
  const scripts = tree.scripts(component).map(({ source }) => source.getFullText()).join("\n");
  return names.some((name) => new RegExp(`(?:new\\s+)?${name}\\s*\\(`).test(scripts));
};

const isInstanceSafe = (tree, stateModule) =>
  Boolean(stateModule) &&
  mutableBindings(tree, stateModule).length === 0 &&
  constructionsAtLoad(tree, stateModule).length === 0;

export default check({
  id: "OWN-02",
  pillar: "state-ownership",
  finding: "ARCH-05",
  name: "component-state-declares-a-lifetime",
  says: "A complex component constructs a colocated component-instance state owner instead of mixing its state ledger into markup.",
  run(tree) {
    const found = [];
    for (const path of productionSvelte(tree)) {
      const bindings = stateBindings(tree, path);
      if (bindings.length === 0) continue;
      const scriptLines = tree.scripts(path).reduce(
        (total, script) => total + script.source.getFullText().split("\n").length,
        0
      );
      if (bindings.length < 8 && !(bindings.length >= 3 && scriptLines > 300)) continue;
      const stateModule = stateModuleOf(tree, path);
      if (
        stateModule &&
        constructsStateOwner(tree, path, stateModule) &&
        isInstanceSafe(tree, stateModule)
      ) continue;
      found.push({
        path,
        fingerprint: bindings.join(","),
        message:
          `${bindings.length} local state bindings across ${scriptLines} script lines have no ` +
          "colocated, component-constructed state.svelte.ts owner"
      });
    }
    return found;
  }
});
