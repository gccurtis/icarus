import ts from "typescript";

import { check } from "../shared/check.mjs";
import { islandDependencyClosure } from "../shared/pure-island-graph.mjs";
import { islandLabel, isOrdinaryTypeScript, pureIslands } from "../shared/pure-islands.mjs";
import {
  isDeeplyFrozenLiteral,
  isPrimitiveLiteral,
  unwrapExpression
} from "../shared/pure-values.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const exported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const allowedFunction = (node) =>
  (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
  !node.asteriskToken;

const allowedValue = (node) => {
  if (!node) return false;
  const value = unwrapExpression(node);
  return (
    allowedFunction(value) ||
    isPrimitiveLiteral(value) ||
    isDeeplyFrozenLiteral(value)
  );
};

const declarationIsTypeOnly = (declaration) =>
  ts.isInterfaceDeclaration(declaration) ||
  ts.isTypeAliasDeclaration(declaration) ||
  ts.isTypeParameterDeclaration(declaration);

const declarationAllowed = (declaration) => {
  if (declarationIsTypeOnly(declaration)) return true;
  if (ts.isFunctionDeclaration(declaration)) return allowedFunction(declaration);
  if (ts.isVariableDeclaration(declaration)) return allowedValue(declaration.initializer);
  return false;
};

const topLevelUnsafeBindings = (compiler, source) => {
  const found = new Set();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (constant && allowedValue(declaration.initializer)) continue;
      const symbol = compiler.checker.getSymbolAtLocation(declaration.name);
      if (symbol) found.add(symbol);
    }
  }
  return found;
};

const capturesUnsafeBinding = (compiler, node, unsafe) => {
  let captured = null;
  const visit = (child) => {
    if (captured) return;
    if (ts.isIdentifier(child)) {
      const symbol = compiler.checker.getSymbolAtLocation(child);
      if (symbol && unsafe.has(symbol)) captured = child;
    }
    child.forEachChild(visit);
  };
  node.forEachChild(visit);
  return captured;
};

export default check({
  name: "pure-island-exports-are-closed",
  baseline: false,
  says: "Pure islands export only free functions, types, primitives, or recursively frozen plain literals.",
  subjects: {
    "mutable-export": "exported aggregate data is visibly and recursively frozen",
    "live-export": "ports, promises, class instances and callable facades cannot leave an island",
    "lazy-singleton": "an exported function cannot close over retained mutable state",
    "unsupported-export": "every export resolves to a declared closed value or type"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const found = [];
    const remembered = new Set();
    const remember = (finding) => {
      const key = `${finding.subject}|${finding.path}|${finding.line ?? 0}|${finding.fingerprint}`;
      if (remembered.has(key)) return;
      remembered.add(key);
      found.push(finding);
    };

    for (const island of pureIslands(tree)) {
      for (const path of islandDependencyClosure(tree, island).keys()) {
        if (!isOrdinaryTypeScript(path)) continue;
        const source = compiler.source(path);
        const unsafe = topLevelUnsafeBindings(compiler, source);
        const exportedFunctions = [];

        for (const statement of source.statements) {
          if (exported(statement) && ts.isFunctionDeclaration(statement)) {
            if (!allowedFunction(statement)) {
              remember({
                subject: "live-export",
                path,
                line: lineOf(source, statement),
                fingerprint: `function:${statement.name?.text ?? "default"}`,
                message: "generator functions can retain execution state after an island call returns"
              });
            } else {
              exportedFunctions.push(statement);
            }
            continue;
          }

          if (exported(statement) && ts.isVariableStatement(statement)) {
            const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
            for (const declaration of statement.declarationList.declarations) {
              const name = declaration.name.getText(source);
              if (!constant || !allowedValue(declaration.initializer)) {
                const value = declaration.initializer && unwrapExpression(declaration.initializer);
                const live =
                  value &&
                  (ts.isNewExpression(value) ||
                    ts.isCallExpression(value) ||
                    ts.isClassExpression(value) ||
                    ts.isFunctionExpression(value) && Boolean(value.asteriskToken));
                remember({
                  subject: live ? "live-export" : "mutable-export",
                  path,
                  line: lineOf(source, declaration),
                  fingerprint: `value:${name}`,
                  message: live
                    ? `${name} exports a preconstructed live/callable value`
                    : `${name} is mutable aggregate data; recursively freeze every literal level or allocate it per invocation`
                });
              } else if (
                declaration.initializer &&
                allowedFunction(unwrapExpression(declaration.initializer))
              ) {
                exportedFunctions.push(unwrapExpression(declaration.initializer));
              }
            }
            continue;
          }

          if (
            exported(statement) &&
            (ts.isClassDeclaration(statement) ||
              ts.isEnumDeclaration(statement) ||
              ts.isModuleDeclaration(statement))
          ) {
            remember({
              subject: "live-export",
              path,
              line: lineOf(source, statement),
              fingerprint: `declaration:${statement.name?.getText(source) ?? "default"}`,
              message: "runtime class, enum, or namespace exports a live module object"
            });
            continue;
          }

          if (ts.isExportAssignment(statement)) {
            const expression = unwrapExpression(statement.expression);
            let allowed = allowedValue(expression);
            if (ts.isIdentifier(expression)) {
              const symbol = compiler.symbolAt(expression);
              allowed = Boolean(symbol?.declarations?.every(declarationAllowed));
            }
            if (!allowed) {
              remember({
                subject: "unsupported-export",
                path,
                line: lineOf(source, statement),
                fingerprint: "export-assignment",
                message: `default/export-equals value is not a closed declaration in ${islandLabel(island)}`
              });
            }
          }

          if (
            ts.isExportDeclaration(statement) &&
            statement.exportClause &&
            ts.isNamedExports(statement.exportClause) &&
            !statement.isTypeOnly
          ) {
            for (const element of statement.exportClause.elements) {
              if (element.isTypeOnly) continue;
              const symbol = compiler.symbolAt(element.name);
              if (symbol?.declarations?.length && symbol.declarations.every(declarationAllowed)) continue;
              remember({
                subject: "unsupported-export",
                path,
                line: lineOf(source, element),
                fingerprint: `named:${element.name.text}`,
                message: `${element.name.text} does not resolve to a closed function, type, primitive, or frozen literal`
              });
            }
          }
        }

        for (const fn of exportedFunctions) {
          const capture = capturesUnsafeBinding(compiler, fn, unsafe);
          if (!capture) continue;
          remember({
            subject: "lazy-singleton",
            path,
            line: lineOf(source, capture),
            fingerprint: `capture:${capture.text}`,
            message: `exported function captures retained mutable ${capture.text}`
          });
        }
      }
    }
    return found;
  }
});
