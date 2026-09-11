import { basename, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  callPath,
  isExported,
  isFunction,
  lineOf,
  literalStrings,
  propertyNamed,
  propertyValue,
  staticName,
  unwrap,
  visit
} from "../shared/pure-contract.mjs";
import { capabilities } from "../shared/trees.mjs";

const objectValue = (node) => {
  const value = unwrap(node);
  if (ts.isObjectLiteralExpression(value)) return { literal: value, frozen: false };
  if (
    ts.isCallExpression(value) &&
    callPath(value.expression)?.join(".") === "Object.freeze" &&
    ts.isObjectLiteralExpression(unwrap(value.arguments[0]))
  ) return { literal: unwrap(value.arguments[0]), frozen: true };
  return null;
};

const exportedAdapterObjects = (source) => {
  const found = [];
  for (const statement of source.statements) {
    if (!isExported(statement) || !ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const object = objectValue(declaration.initializer);
      if (object) found.push({ name: declaration.name.text, declaration, ...object });
    }
  }
  return found;
};

const functionReturns = (fn) => {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [unwrap(fn.body)];
  const found = [];
  const step = (node) => {
    if (node !== fn && isFunction(node)) return;
    if (ts.isReturnStatement(node) && node.expression) found.push(unwrap(node.expression));
    node.forEachChild(step);
  };
  if (fn?.body) step(fn.body);
  return found;
};

const bindingRecords = (literal) => {
  const found = new Map();
  for (const property of literal?.properties ?? []) {
    const name = staticName(property.name);
    const values = literalStrings(propertyValue(property));
    if (name && values?.length === 2) found.set(name, values);
  }
  return found;
};

const portClosures = (literal, prefix = [], found = []) => {
  for (const property of literal?.properties ?? []) {
    const name = staticName(property.name);
    if (!name) continue;
    const value = propertyValue(property);
    if (isFunction(value)) {
      found.push({ name: [...prefix, name].join("."), property, fn: value });
      continue;
    }
    const nested = objectValue(value);
    if (nested) portClosures(nested.literal, [...prefix, name], found);
  }
  return found;
};

export default check({
  name: "capability-adapter-is-exact",
  baseline: false,
  says: "Runtime capability transformers select a literal model subset and bind exact frozen local ports member by member.",
  subjects: {
    layout: "each capability has a named runtime transformer module",
    declaration: "transformers declare sorted models and complete static binding records",
    subset: "transformers reference only their declared acquired model subset",
    construction: "context and ports are explicit frozen own-property objects",
    delegation: "each capability port member delegates once to its recorded model member",
    escape: "transformers use no casts, spreads, reflection, hidden members, or imported live models",
    decisions: "runtime transformers translate and bind without domain control flow"
  },
  run(tree) {
    const found = [];
    const root = tree.path("runtime", "server", "capabilities", "adapters");

    for (const capability of capabilities(tree)) {
      const path = join(root, `${capability.name}.server.ts`);
      if (!tree.isFile(path)) {
        found.push({
          subject: "layout",
          path: root,
          fingerprint: `${capability.name}:missing-adapter`,
          message: `${capability.name} has no runtime capability adapter`
        });
      }
    }

    for (const path of tree.under(root).filter((file) => file.endsWith(".server.ts"))) {
      const source = tree.source(path);
      const owner = basename(path, ".server.ts");
      const adapters = exportedAdapterObjects(source);
      if (adapters.length === 0) {
        found.push({
          subject: "declaration",
          path,
          line: 1,
          fingerprint: `${owner}:missing-exported-object`,
          message: "adapter module exports no literal transformer definition"
        });
      }

      for (const edge of tree.imports(path)) {
        const target = tree.resolve(edge.specifier, path);
        if (target?.includes("/model/") && !edge.type) {
          found.push({
            subject: "escape",
            path,
            line: edge.line,
            fingerprint: `${owner}:live-model-import:${edge.specifier}`,
            message: `transformer imports live model value ${edge.specifier}; acquired values must arrive as parameters`
          });
        }
        if (target?.includes("/runtime/server/infrastructure/")) {
          found.push({
            subject: "escape",
            path,
            line: edge.line,
            fingerprint: `${owner}:infrastructure:${edge.specifier}`,
            message: "transformer imports runtime infrastructure instead of translating its explicit inputs"
          });
        }
      }

      for (const adapter of adapters) {
        const modelsProperty = propertyNamed(adapter.literal, "models");
        const models = literalStrings(propertyValue(modelsProperty));
        if (!models || new Set(models).size !== models.length || [...models].sort().join("\0") !== models.join("\0")) {
          found.push({
            subject: "declaration",
            path,
            line: lineOf(source, modelsProperty ?? adapter.literal),
            fingerprint: `${adapter.name}:models`,
            message: "transformer models must be a sorted duplicate-free string-literal list"
          });
        }

        const bindingsProperty = propertyNamed(adapter.literal, "bindings");
        const bindingsObject = objectValue(propertyValue(bindingsProperty));
        const records = bindingRecords(bindingsObject?.literal);
        if (!bindingsObject || records.size === 0) {
          found.push({
            subject: "declaration",
            path,
            line: lineOf(source, bindingsProperty ?? adapter.literal),
            fingerprint: `${adapter.name}:bindings`,
            message: "transformer must declare literal member-to-model binding records"
          });
        }

        for (const member of ["context", "ports"]) {
          const fn = propertyValue(propertyNamed(adapter.literal, member));
          const returns = isFunction(fn) ? functionReturns(fn) : [];
          const objects = returns.map(objectValue).filter(Boolean);
          if (objects.length !== 1 || !objects[0].frozen) {
            found.push({
              subject: "construction",
              path,
              line: lineOf(source, fn ?? adapter.literal),
              fingerprint: `${adapter.name}:${member}:frozen-literal`,
              message: `${member} must visibly construct and freeze one exact object literal`
            });
          }
          if (member !== "ports" || objects.length !== 1) continue;

          for (const closure of portClosures(objects[0].literal)) {
            const calls = [];
            const step = (node) => {
              if (node !== closure.fn && isFunction(node)) return;
              if (ts.isCallExpression(node)) calls.push(node);
              node.forEachChild(step);
            };
            step(closure.fn);
            const modelCalls = calls
              .map((call) => callPath(call.expression))
              .filter((parts) => parts?.[0] === "models" && parts.length >= 3);
            const record = records.get(closure.name);
            if (
              modelCalls.length !== 1 ||
              !record ||
              modelCalls[0][1] !== record[0] ||
              modelCalls[0].at(-1) !== record[1]
            ) {
              found.push({
                subject: "delegation",
                path,
                line: lineOf(source, closure.property),
                fingerprint: `${adapter.name}:binding:${closure.name}`,
                message: `${closure.name} must make one call to its recorded [model, member] binding`
              });
            }
          }
        }

        const declared = new Set(models ?? []);
        visit(adapter.literal, (node) => {
          if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "models" &&
            !declared.has(node.name.text)
          ) {
            found.push({
              subject: "subset",
              path,
              line: lineOf(source, node),
              fingerprint: `${adapter.name}:model:${node.name.text}:${node.pos}`,
              message: `transformer reads undeclared model ${node.name.text}`
            });
          }
        });
      }

      visit(source, (node) => {
        const reflected =
          ts.isCallExpression(node) &&
          ["Proxy", "Reflect", "Object.defineProperty", "Object.defineProperties", "Object.setPrototypeOf", "Symbol"]
            .includes(callPath(node.expression)?.join("."));
        const rest = ts.isBindingElement(node) && Boolean(node.dotDotDotToken);
        if (
          ts.isAsExpression(node) ||
          ts.isTypeAssertionExpression(node) ||
          ts.isSpreadAssignment(node) ||
          ts.isSpreadElement(node) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node) ||
          rest ||
          reflected
        ) {
          found.push({
            subject: "escape",
            path,
            line: lineOf(source, node),
            fingerprint: `${owner}:escape:${node.pos}:${ts.SyntaxKind[node.kind]}`,
            message: `transformer contains ${ts.SyntaxKind[node.kind]} instead of exact member-by-member construction`
          });
        }
        if (
          ts.isIfStatement(node) ||
          ts.isSwitchStatement(node) ||
          ts.isForStatement(node) ||
          ts.isForInStatement(node) ||
          ts.isForOfStatement(node) ||
          ts.isWhileStatement(node) ||
          ts.isDoStatement(node) ||
          ts.isTryStatement(node)
        ) {
          found.push({
            subject: "decisions",
            path,
            line: lineOf(source, node),
            fingerprint: `${owner}:decision:${node.pos}:${ts.SyntaxKind[node.kind]}`,
            message: `transformer contains domain control flow ${ts.SyntaxKind[node.kind]}`
          });
        }
      });
    }
    return found;
  }
});
