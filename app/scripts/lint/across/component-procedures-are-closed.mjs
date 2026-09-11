import { join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  callPath,
  isFunction,
  lineOf,
  unwrap,
  visit
} from "../shared/pure-contract.mjs";
import { isProductionPath, pureIslands } from "../shared/pure-islands.mjs";

const componentIslands = (tree) =>
  pureIslands(tree).filter(({ kind }) => kind === "component-procedure");

const forbiddenAdapterSyntax = (node) =>
  ts.isAsExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isSpreadAssignment(node) ||
  ts.isSpreadElement(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  (ts.isBindingElement(node) && Boolean(node.dotDotDotToken)) ||
  (ts.isCallExpression(node) &&
    ["Proxy", "Reflect", "Object.defineProperty", "Object.defineProperties", "Object.setPrototypeOf"]
      .includes(callPath(node.expression)?.join(".")));

const inlineHandler = /(?:on:[a-z]+|on[a-z]+)\s*=\s*\{\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\}/g;

export default check({
  name: "component-procedures-are-closed",
  baseline: false,
  says: "Component procedures are closed pure islands invoked through exact owner adapters and the standard client runner.",
  subjects: {
    effects: "effects live beside rather than beneath procedures",
    dependency: "procedures import only same-owner procedures and pure types",
    lifecycle: "procedures cannot acquire, release, close, or construct models",
    authority: "procedures receive narrow ports rather than remote/model/runtime authority",
    adapter: "owner adapters construct an exact frozen authority subset without casts or spreads",
    markup: "markup handlers extract event data and make one named adapter/runner call"
  },
  run(tree) {
    const found = [];
    for (const island of componentIslands(tree)) {
      const procedures = island.entryRoot;
      const nestedEffects = join(procedures, "effects");
      for (const path of tree.under(nestedEffects)) {
        if (!isProductionPath(procedures, path)) continue;
        found.push({
          subject: "effects",
          path,
          line: 1,
          fingerprint: `${island.id}:nested-effect:${tree.rel(path)}`,
          message: "effect/lifecycle code is nested inside the pure procedures island; move it to owner effects/"
        });
      }

      for (const path of island.entries.filter((file) => file.endsWith(".ts"))) {
        const source = tree.source(path);
        for (const edge of tree.imports(path)) {
          const target = tree.resolve(edge.specifier, path);
          if (target && island.allows(target)) continue;
          found.push({
            subject: target?.includes("/model/") || target?.includes("/capabilities/") || target?.includes("/runtime/")
              ? "authority"
              : "dependency",
            path,
            line: edge.line,
            fingerprint: `${island.id}:import:${edge.specifier}`,
            message: `procedure imports ${edge.specifier} outside its owner-local pure surface`
          });
        }

        for (const statement of source.statements) {
          if (!ts.isVariableStatement(statement)) continue;
          for (const declaration of statement.declarationList.declarations) {
            const type = declaration.type?.getText(source) ?? "";
            if (!/Port|Adapter|Model/.test(type) || !declaration.initializer) continue;
            found.push({
              subject: "authority",
              path,
              line: lineOf(source, declaration),
              fingerprint: `${island.id}:held-port:${declaration.name.getText(source)}`,
              message: "procedure module retains a port/model/adapter between invocations"
            });
          }
        }

        visit(source, (node) => {
          if (!ts.isCallExpression(node)) return;
          const called = callPath(node.expression)?.at(-1);
          if (!called || !/^(?:acquire|release|close|bind[A-Z]|create[A-Z].*State)$/.test(called)) return;
          found.push({
            subject: "lifecycle",
            path,
            line: lineOf(source, node),
            fingerprint: `${island.id}:lifecycle:${called}:${node.pos}`,
            message: `pure procedure calls lifecycle operation ${called}`
          });
        });
      }

      const adapters = join(island.root, "adapters");
      for (const path of tree.under(adapters).filter((file) => file.endsWith(".ts") && isProductionPath(adapters, file))) {
        const source = tree.source(path);
        visit(source, (node) => {
          if (!forbiddenAdapterSyntax(node)) return;
          found.push({
            subject: "adapter",
            path,
            line: lineOf(source, node),
            fingerprint: `${island.id}:adapter:${node.pos}:${ts.SyntaxKind[node.kind]}`,
            message: `owner adapter contains ${ts.SyntaxKind[node.kind]} instead of exact member-by-member construction`
          });
        });

        const returnsPort = [];
        visit(source, (node) => {
          if (!ts.isReturnStatement(node) || !node.expression) return;
          const text = node.expression.getText(source);
          if (/port/i.test(text) || ts.isObjectLiteralExpression(unwrap(node.expression))) returnsPort.push(node);
        });
        for (const returned of returnsPort) {
          const value = unwrap(returned.expression);
          const frozen =
            ts.isCallExpression(value) &&
            callPath(value.expression)?.join(".") === "Object.freeze";
          if (frozen) continue;
          found.push({
            subject: "adapter",
            path,
            line: lineOf(source, returned),
            fingerprint: `${island.id}:unfrozen-adapter-result:${returned.pos}`,
            message: "owner adapter returns a live/unfrozen procedure authority surface"
          });
        }
      }

      for (const path of tree.under(island.root).filter((file) => file.endsWith(".svelte") && isProductionPath(island.root, file))) {
        for (const edge of tree.imports(path)) {
          const target = tree.resolve(edge.specifier, path);
          if (!target || (!target.includes("/model/") && !target.includes("/capabilities/"))) continue;
          found.push({
            subject: "authority",
            path,
            line: edge.line,
            fingerprint: `${island.id}:markup-authority:${edge.specifier}`,
            message: "component markup imports model/capability authority directly instead of an owner adapter"
          });
        }
        const text = tree.read(path);
        for (const match of text.matchAll(inlineHandler)) {
          const body = match[1] ?? "";
          const calls = [...body.matchAll(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(/g)];
          if (calls.length <= 1 && !/\b(?:if|for|while|switch|try)\b|;[\s\S]*;/.test(body)) continue;
          found.push({
            subject: "markup",
            path,
            line: text.slice(0, match.index).split("\n").length,
            fingerprint: `${island.id}:inline-handler:${match.index}`,
            message: "markup event handler contains branching or multi-step behavior instead of one named adapter/runner call"
          });
        }
      }
    }
    return found;
  }
});
