import { basename, dirname, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  exportedFunctionNodes,
  functionType,
  implicitDependencies
} from "../shared/explicit-dependencies.mjs";
import { objects } from "../shared/trees.mjs";

const definitionsIn = (tree, root) =>
  ["definition.ts", "definition.svelte.ts"].map((file) => join(root, file)).filter((path) => tree.isFile(path));

const simpleTypeName = (type) => {
  if (!type || !ts.isTypeReferenceNode(type)) return undefined;
  return ts.isIdentifier(type.typeName) ? type.typeName.text : undefined;
};

const publicObjectTypes = (tree, root) => {
  const names = new Set();
  for (const path of [...definitionsIn(tree, root), join(root, "constructor.ts")].filter((file) => tree.isFile(file))) {
    const source = tree.source(path);
    for (const statement of source.statements) {
      if (ts.isClassDeclaration(statement)) {
        for (const heritage of statement.heritageClauses ?? []) {
          if (heritage.token !== ts.SyntaxKind.ImplementsKeyword) continue;
          for (const type of heritage.types) {
            if (ts.isIdentifier(type.expression)) names.add(type.expression.text);
          }
        }
      }
      if (ts.isFunctionDeclaration(statement)) {
        const name = simpleTypeName(statement.type);
        if (name) names.add(name);
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const value = declaration.initializer;
        if (!value || (!ts.isArrowFunction(value) && !ts.isFunctionExpression(value))) continue;
        const name = simpleTypeName(value.type);
        if (name) names.add(name);
      }
    }
  }
  return names;
};

const memberName = (member, source) => member.name?.getText(source) ?? "callable surface";

const attachedInDefinition = (tree, path) => {
  const source = tree.source(path);
  const found = [];
  const visit = (node, owner = "definition") => {
    const nextOwner =
      (ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name
        ? node.name.text
        : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
          ? node.name.text
          : owner;
    if (
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      found.push({ owner, name: memberName(node, source), node });
    }
    if (
      (ts.isPropertyDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) found.push({ owner, name: memberName(node, source), node });
    node.forEachChild((child) => visit(child, nextOwner));
  };
  source.forEachChild(visit);
  return found;
};

const attachedInTypes = (tree, path, publicTypes) => {
  const source = tree.source(path);
  const found = [];
  const inspect = (owner, members) => {
    for (const member of members) {
      if (ts.isMethodSignature(member) || ts.isCallSignatureDeclaration(member)) {
        found.push({ owner, name: memberName(member, source), node: member });
      }
      if (ts.isPropertySignature(member) && functionType(member.type)) {
        found.push({ owner, name: memberName(member, source), node: member });
      }
    }
  };
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement) && publicTypes.has(statement.name.text)) {
      inspect(statement.name.text, statement.members);
    }
    if (
      ts.isTypeAliasDeclaration(statement) &&
      publicTypes.has(statement.name.text) &&
      ts.isTypeLiteralNode(statement.type)
    ) inspect(statement.name.text, statement.type.members);
  }
  return found;
};

const methodEntries = (tree, root) => {
  const methods = join(root, "methods");
  if (!tree.exists(methods)) return [];
  return tree.under(methods).filter((path) => {
    if (!/\.(?:svelte\.)?ts$/.test(path) || path.includes("/test/") || path.includes("/shared/")) return false;
    const relative = path.slice(methods.length + 1).split("/");
    if (relative.length === 1) return true;
    const file = basename(path).replace(/(?:\.svelte)?\.ts$/, "");
    return file === basename(dirname(path));
  });
};

const forbiddenImport = ({ specifier, imported }) => {
  if (specifier.startsWith("node:")) return `imports ${imported} from ${specifier} instead of receiving an interface`;
  if (specifier.startsWith("$runtime/")) return `acquires ${imported} from ${specifier} instead of an explicit input`;
  if (specifier.startsWith("$capabilities/")) return `acquires ${imported} from ${specifier} instead of a supplied capability port`;
  return undefined;
};

export default check({
  name: "model-functions-are-explicit",
  says: "A model is stored fields; every query or command is a free function receiving its inputs explicitly.",
  subjects: {
    "fields-only": "model objects expose no methods, getters, setters or callable properties",
    "explicit-input": "model method entries receive an explicit first input",
    "implicit-dependency": "model functions receive clocks, I/O and capability ports"
  },
  run(tree) {
    const found = [];
    for (const { name: object, path: root } of objects(tree)) {
      for (const path of definitionsIn(tree, root)) {
        for (const attached of attachedInDefinition(tree, path)) {
          found.push({
            subject: "fields-only",
            path,
            line: tree.lineOf(path, attached.node),
            fingerprint: `${object}:${attached.owner}:${attached.name}`,
            message: `${attached.owner}.${attached.name} is attached behavior; expose stored fields and use a free function`
          });
        }
      }

      const types = join(root, "types.ts");
      if (tree.isFile(types)) {
        for (const attached of attachedInTypes(tree, types, publicObjectTypes(tree, root))) {
          found.push({
            subject: "fields-only",
            path: types,
            line: tree.lineOf(types, attached.node),
            fingerprint: `${object}:${attached.owner}:${attached.name}`,
            message: `${attached.owner}.${attached.name} is callable behavior on the model surface`
          });
        }
      }

      for (const path of methodEntries(tree, root)) {
        for (const { name, node } of exportedFunctionNodes(tree.source(path))) {
          if ((node.parameters?.length ?? 0) > 0) continue;
          found.push({
            subject: "explicit-input",
            path,
            line: tree.lineOf(path, node),
            fingerprint: name,
            message: `${name} receives no explicit model/data input`
          });
        }
      }

      const methods = join(root, "methods");
      if (!tree.exists(methods)) continue;
      for (const path of tree.under(methods)) {
        if (!/\.(?:svelte\.)?ts$/.test(path) || path.includes("/test/")) continue;
        for (const issue of implicitDependencies(tree, path, { forbiddenImport })) {
          found.push({
            subject: "implicit-dependency",
            path,
            line: issue.line,
            fingerprint: issue.fingerprint,
            message: issue.detail
          });
        }
      }
    }
    return found;
  }
});
