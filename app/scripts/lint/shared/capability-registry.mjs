import ts from "typescript";

import { callPath, isExported, propertyValue, staticName, unwrap } from "./pure-contract.mjs";

export const registryPath = (tree) =>
  tree.path("runtime", "server", "capabilities", "registry.server.ts");

export const remotePath = (tree) =>
  tree.path("runtime", "remote", "capabilities.remote.ts");

export const frozenObject = (node) => {
  const value = unwrap(node);
  if (ts.isObjectLiteralExpression(value)) return { literal: value, frozen: false };
  if (
    ts.isCallExpression(value) &&
    callPath(value.expression)?.join(".") === "Object.freeze" &&
    ts.isObjectLiteralExpression(unwrap(value.arguments[0]))
  ) return { literal: unwrap(value.arguments[0]), frozen: true };
  return null;
};

export const registryDeclaration = (tree) => {
  const path = registryPath(tree);
  if (!tree.isFile(path)) return null;
  const source = tree.source(path);
  for (const statement of source.statements) {
    if (!isExported(statement) || !ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "capabilityRegistry") continue;
      const object = frozenObject(declaration.initializer);
      return object ? { path, source, declaration, ...object } : { path, source, declaration, literal: null, frozen: false };
    }
  }
  return { path, source, declaration: null, literal: null, frozen: false };
};

export const registryRecords = (declaration) => {
  const found = [];
  for (const property of declaration?.literal?.properties ?? []) {
    const name = staticName(property.name);
    const object = frozenObject(propertyValue(property));
    if (name) found.push({ name, property, object });
  }
  return found;
};

export const recordProperty = (record, name) =>
  record?.object?.literal?.properties.find((property) => staticName(property.name) === name) ?? null;

export const stringValue = (node) => {
  const value = unwrap(node);
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : null;
};

export const referencePath = (node) => callPath(unwrap(node));

export const remoteRegistryReferences = (tree) => {
  const path = remotePath(tree);
  if (!tree.isFile(path)) return [];
  const source = tree.source(path);
  const found = [];
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const parts = callPath(node);
      if (parts?.[0] === "capabilityRegistry" && parts.length === 2) {
        found.push({ name: parts[1], node });
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
};
