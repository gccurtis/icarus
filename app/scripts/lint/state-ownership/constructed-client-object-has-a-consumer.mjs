import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";
import { objects } from "../shared/trees.mjs";

const aggregateProperty = (name) =>
  name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const unwrap = (expression) => {
  let node = expression;
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node))
  ) node = node.expression;
  return node;
};

const isClientModelCall = (expression) => {
  const node = unwrap(expression);
  return Boolean(
    node &&
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "clientModel"
  );
};

const bindingTakes = (name, property) =>
  ts.isObjectBindingPattern(name) &&
  name.elements.some((element) => {
    if (!ts.isBindingElement(element)) return false;
    const selected = element.propertyName ?? element.name;
    return ts.isIdentifier(selected) && selected.text === property;
  });

const aggregateConsumes = (tree, path, property) => {
  const imported = tree.imports(path).some(
    (record) => !record.type && record.specifier === "$runtime/client/start" && record.names.includes("clientModel")
  );
  if (!imported) return false;

  for (const { source } of tree.scripts(path)) {
    const roots = new Set();
    const collectRoots = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        isClientModelCall(node.initializer)
      ) {
        if (ts.isIdentifier(node.name)) roots.add(node.name.text);
      }
      node.forEachChild(collectRoots);
    };
    collectRoots(source);

    let consumed = false;
    const visit = (node) => {
      if (consumed) return;
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        bindingTakes(node.name, property)
      ) {
        const initializer = unwrap(node.initializer);
        if (
          isClientModelCall(initializer) ||
          (ts.isIdentifier(initializer) && roots.has(initializer.text))
        ) consumed = true;
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === property) {
        const expression = unwrap(node.expression);
        if (
          isClientModelCall(expression) ||
          (ts.isIdentifier(expression) && roots.has(expression.text))
        ) consumed = true;
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === property
      ) {
        const expression = unwrap(node.expression);
        if (
          isClientModelCall(expression) ||
          (ts.isIdentifier(expression) && roots.has(expression.text))
        ) consumed = true;
      }
      if (!consumed) node.forEachChild(visit);
    };
    visit(source);
    if (consumed) return true;
  }
  return false;
};

export default check({
  id: "OWN-05",
  pillar: "state-ownership",
  finding: "ARCH-11",
  name: "constructed-client-object-has-a-consumer",
  says: "Every client model object is consumed by production code outside its composition root and its own directory.",
  run(tree) {
    const sources = productionSources(tree);
    const found = [];
    const start = tree.path("runtime", "client", "start.ts");
    const startText = tree.read(start);
    for (const object of objects(tree).filter((candidate) => candidate.environment === "client")) {
      const specifier = `$model/client/${object.name}`;
      const constructors = tree
        .imports(start)
        .filter((record) => !record.type && record.specifier === specifier)
        .flatMap((record) => record.names)
        .filter((name) => /^create[A-Z]/.test(name));
      const constructed = constructors.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(startText));
      if (!constructed) continue;
      const property = aggregateProperty(object.name);
      const consumed = sources.some((path) => {
        if (tree.within(object.path, path) || tree.within(tree.path("runtime"), path)) return false;
        const importsObject = tree.imports(path).some(
          (record) => record.specifier === specifier || record.specifier.startsWith(`${specifier}/`)
        );
        return importsObject || aggregateConsumes(tree, path, property);
      });
      if (consumed) continue;
      found.push({
        path: object.path,
        fingerprint: object.name,
        message: `${object.name} is constructed/exposed as a client model but has no production consumer outside runtime`
      });
    }
    return found;
  }
});
