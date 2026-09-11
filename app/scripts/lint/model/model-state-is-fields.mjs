import { basename, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { objects } from "../shared/trees.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const exported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const functionInitializer = (node) =>
  node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) ? node : null;

const declaredFunctions = (source) => {
  const found = [];
  for (const statement of source.statements) {
    if (!exported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      found.push({ name: statement.name?.text ?? "default", node: statement });
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const node = functionInitializer(declaration.initializer);
      if (node) found.push({ name: declaration.name.text, node });
    }
  }
  return found;
};

const stateConstructors = (source) =>
  declaredFunctions(source).filter(({ name }) => /^create[A-Z].*State$/.test(name));

const returnedExpressions = (fn) => {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body];
  if (!fn.body || !ts.isBlock(fn.body)) return [];
  const found = [];
  const visit = (node) => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) found.push(node.expression);
    node.forEachChild(visit);
  };
  fn.body.forEachChild(visit);
  return found;
};

const directStateLiteral = (expression) => {
  let value = expression;
  while (ts.isParenthesizedExpression(value) || ts.isAsExpression(value)) value = value.expression;
  return ts.isObjectLiteralExpression(value) ? value : null;
};

const illegalStateConstruction = (literal) =>
  literal.properties.find(
    (property) =>
      ts.isSpreadAssignment(property) ||
      ts.isMethodDeclaration(property) ||
      ts.isGetAccessorDeclaration(property) ||
      ts.isSetAccessorDeclaration(property) ||
      Boolean(property.name && ts.isComputedPropertyName(property.name))
  );

const legacySurfaceNames = (tree, compiler, root) => {
  const found = new Set();
  for (const name of ["definition.ts", "definition.svelte.ts", "constructor.ts"]) {
    const path = join(root, name);
    if (!tree.isFile(path)) continue;
    const source = compiler.source(path);
    for (const statement of source.statements) {
      if (ts.isClassDeclaration(statement)) {
        for (const clause of statement.heritageClauses ?? []) {
          if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;
          for (const type of clause.types) found.add(type.expression.getText(source));
        }
      }
      if (ts.isFunctionDeclaration(statement) && statement.type) {
        found.add(statement.type.getText(source).replace(/<.*$/, ""));
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const fn = functionInitializer(declaration.initializer);
        if (fn?.type) found.add(fn.type.getText(source).replace(/<.*$/, ""));
      }
    }
  }
  return found;
};

const callableOrBroadType = (compiler, node, root, visited = new Set()) => {
  if (!node || visited.has(node)) return null;
  visited.add(node);
  if (
    ts.isFunctionTypeNode(node) ||
    ts.isConstructorTypeNode(node) ||
    node.kind === ts.SyntaxKind.AnyKeyword ||
    node.kind === ts.SyntaxKind.ObjectKeyword
  ) return node;
  if (ts.isTypeLiteralNode(node)) return callableOrBroadMembers(compiler, node.members, root, visited);
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    if (name === "Function") return node;
    for (const argument of node.typeArguments ?? []) {
      const illegal = callableOrBroadType(compiler, argument, root, visited);
      if (illegal) return illegal;
    }
    const symbol = compiler.symbolAt(node.typeName);
    for (const declaration of symbol?.declarations ?? []) {
      if (!compiler.declarationPaths(symbol).every((path) => path.startsWith(`${root}/`) || path === join(root, "types.ts") || path === join(root, "state.ts"))) {
        continue;
      }
      if (ts.isTypeAliasDeclaration(declaration)) {
        const illegal = callableOrBroadType(compiler, declaration.type, root, visited);
        if (illegal) return illegal;
      }
      if (ts.isInterfaceDeclaration(declaration)) {
        const illegal = callableOrBroadMembers(compiler, declaration.members, root, visited);
        if (illegal) return illegal;
      }
    }
  }
  let illegal = null;
  node.forEachChild((child) => {
    illegal ??= callableOrBroadType(compiler, child, root, visited);
  });
  return illegal;
};

function callableOrBroadMembers(compiler, members, root, visited) {
  for (const member of members) {
    if (
      ts.isMethodSignature(member) ||
      ts.isCallSignatureDeclaration(member) ||
      ts.isConstructSignatureDeclaration(member) ||
      ts.isIndexSignatureDeclaration(member) ||
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
    ) return member;
    if (ts.isPropertySignature(member)) {
      const illegal = callableOrBroadType(compiler, member.type, root, visited);
      if (illegal) return illegal;
    }
  }
  return null;
}

const stateContracts = (source, legacyNames) =>
  source.statements.filter(
    (statement) =>
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      (statement.name.text.endsWith("State") ||
        statement.name.text.endsWith("Model") ||
        legacyNames.has(statement.name.text))
  );

const contractMembers = (statement) => {
  if (ts.isInterfaceDeclaration(statement)) return statement.members;
  return ts.isTypeLiteralNode(statement.type) ? statement.type.members : null;
};

export default check({
  name: "model-state-is-fields",
  baseline: false,
  says: "Every model state is explicitly constructed stored data with no attached or inherited behavior.",
  subjects: {
    "state-file": "each model has one state.ts and no legacy definition file",
    "state-constructor": "state.ts exports one explicit object-literal state constructor",
    "fields-only": "state contracts contain stored fields rather than callable, indexed, inherited or broad authority",
    "state-shape": "state construction cannot add prototypes, proxies, accessors, symbols or hidden properties"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const found = [];
    for (const { id, path: root } of objects(tree)) {
      const statePath = join(root, "state.ts");
      const legacyDefinitions = ["definition.ts", "definition.svelte.ts"]
        .map((name) => join(root, name))
        .filter((path) => tree.isFile(path));

      if (!tree.isFile(statePath)) {
        found.push({
          subject: "state-file",
          path: root,
          fingerprint: `${id}:missing-state`,
          message: `${id} has no state.ts owning its stored fields and constructor`
        });
      }
      for (const legacy of legacyDefinitions) {
        found.push({
          subject: "state-file",
          path: legacy,
          line: 1,
          fingerprint: `${id}:${basename(legacy)}`,
          message: `${basename(legacy)} is a legacy attached-object state surface; migrate it to state.ts`
        });
      }

      const legacyNames = legacySurfaceNames(tree, compiler, root);
      const typeFiles = [statePath, join(root, "types.ts")].filter((path) => tree.isFile(path));
      let stateContractCount = 0;
      for (const path of typeFiles) {
        const source = compiler.source(path);
        for (const contract of stateContracts(source, legacyNames)) {
          if (path === statePath && contract.name.text.endsWith("State")) stateContractCount += 1;
          if (ts.isInterfaceDeclaration(contract) && (contract.heritageClauses?.length ?? 0) > 0) {
            found.push({
              subject: "fields-only",
              path,
              line: lineOf(source, contract),
              fingerprint: `${contract.name.text}:inheritance`,
              message: `${contract.name.text} inherits a surface instead of declaring exact stored fields`
            });
          }
          const members = contractMembers(contract);
          const illegal = members && callableOrBroadMembers(compiler, members, root, new Set());
          if (!illegal) continue;
          found.push({
            subject: "fields-only",
            path,
            line: lineOf(source, illegal),
            fingerprint: `${contract.name.text}:${illegal.name?.getText(source) ?? ts.SyntaxKind[illegal.kind]}`,
            message: `${contract.name.text} contains callable, indexed, inherited, or broad behavior instead of a stored field`
          });
        }
      }

      if (!tree.isFile(statePath)) continue;
      const source = compiler.source(statePath);
      if (stateContractCount === 0) {
        found.push({
          subject: "fields-only",
          path: statePath,
          line: 1,
          fingerprint: `${id}:missing-state-contract`,
          message: `${id} state.ts declares no named *State stored-field contract`
        });
      }

      const constructors = stateConstructors(source);
      if (constructors.length !== 1) {
        found.push({
          subject: "state-constructor",
          path: statePath,
          line: 1,
          fingerprint: `${id}:constructors:${constructors.length}`,
          message: `${id} state.ts must export exactly one create*State function; found ${constructors.length}`
        });
      }
      for (const { name, node } of constructors) {
        const returns = returnedExpressions(node);
        if (returns.length === 0) {
          found.push({
            subject: "state-constructor",
            path: statePath,
            line: lineOf(source, node),
            fingerprint: `${name}:no-return`,
            message: `${name} does not visibly return an owned state object`
          });
          continue;
        }
        for (const expression of returns) {
          const literal = directStateLiteral(expression);
          const illegal = literal && illegalStateConstruction(literal);
          if (literal && !illegal) continue;
          found.push({
            subject: "state-shape",
            path: statePath,
            line: lineOf(source, illegal ?? expression),
            fingerprint: `${name}:return-shape`,
            message: `${name} must return an explicit ordinary object with declared data properties only`
          });
        }
      }

      const visit = (node) => {
        if (
          ts.isClassDeclaration(node) ||
          ts.isClassExpression(node) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isComputedPropertyName(node)
        ) {
          found.push({
            subject: "state-shape",
            path: statePath,
            line: lineOf(source, node),
            fingerprint: `runtime:${ts.SyntaxKind[node.kind]}`,
            message: "state.ts contains attached, computed, accessor, or class behavior"
          });
        }
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "Proxy"
        ) {
          found.push({
            subject: "state-shape",
            path: statePath,
            line: lineOf(source, node),
            fingerprint: "runtime:Proxy",
            message: "state cannot be hidden behind a Proxy"
          });
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "Object" &&
          ["create", "defineProperty", "defineProperties", "setPrototypeOf"].includes(node.expression.name.text)
        ) {
          found.push({
            subject: "state-shape",
            path: statePath,
            line: lineOf(source, node),
            fingerprint: `runtime:Object.${node.expression.name.text}`,
            message: `${node.expression.getText(source)} can add hidden or inherited state behavior`
          });
        }
        node.forEachChild(visit);
      };
      source.forEachChild(visit);
    }
    return found;
  }
});
