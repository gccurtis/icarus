import { basename, dirname, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  broadTypeNode,
  isFunction,
  lineOf,
  staticName,
  topLevelFunctions,
  visit
} from "../shared/pure-contract.mjs";
import { capabilities, procedureEntries, unitOf } from "../shared/trees.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const referencesOutside = (compiler, node, root) => {
  let outside = null;
  visit(node, (child) => {
    if (outside || !ts.isTypeReferenceNode(child)) return;
    const name = child.typeName.getText();
    if (["Readonly", "ReadonlyArray", "Array", "Promise"].includes(name)) return;
    const symbol = compiler.symbolAt(child.typeName);
    const paths = compiler.declarationPaths(symbol);
    if (paths.length === 0 || paths.some((path) => !path.startsWith(`${root}/`))) outside = child;
  });
  return outside;
};

const localTypeHasCallable = (compiler, node, root, seen = new Set()) => {
  if (!node || seen.has(node)) return null;
  seen.add(node);
  let found = broadTypeNode(node, { functions: true, unknown: false });
  if (found) return found;
  visit(node, (child) => {
    if (found || !ts.isTypeReferenceNode(child)) return;
    const symbol = compiler.symbolAt(child.typeName);
    for (const declaration of symbol?.declarations ?? []) {
      const path = declaration.getSourceFile()?.fileName;
      if (!path?.startsWith(`${root}/`)) continue;
      if (ts.isTypeAliasDeclaration(declaration)) {
        found ??= localTypeHasCallable(compiler, declaration.type, root, seen);
      } else if (ts.isInterfaceDeclaration(declaration)) {
        for (const member of declaration.members) {
          if (
            ts.isMethodSignature(member) ||
            ts.isCallSignatureDeclaration(member) ||
            ts.isConstructSignatureDeclaration(member) ||
            ts.isIndexSignatureDeclaration(member)
          ) {
            found = member;
            break;
          }
          if (ts.isPropertySignature(member)) {
            found ??= localTypeHasCallable(compiler, member.type, root, seen);
          }
        }
      }
    }
  });
  return found;
};

const catchConvertsToResult = (clause) => {
  let returned = null;
  let threw = false;
  const step = (node) => {
    if (node !== clause && isFunction(node)) return;
    if (ts.isReturnStatement(node)) returned ??= node;
    if (ts.isThrowStatement(node)) threw = true;
    node.forEachChild(step);
  };
  step(clause.block);
  return returned && !threw ? returned : null;
};

export default check({
  name: "capability-contract-is-local",
  baseline: false,
  says: "Every capability entry receives exact local context, ports, and admitted input and returns local data.",
  subjects: {
    signature: "registered entries use exactly (context, ports, input)",
    locality: "entry boundary types are declared by their own capability",
    "broad-authority": "entry surfaces contain no any, unknown, object, index signature, or service bag",
    "data-only": "context, input, and result contain no callable or live authority",
    admission: "raw input is owned by a local admission function before entry",
    faults: "thrown operational faults are not reclassified as domain results"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const units = capabilities(tree);
    const found = [];

    for (const path of procedureEntries(tree)) {
      const capability = unitOf(tree, units, path);
      if (!capability) continue;
      const source = compiler.source(path);
      const operation = basename(path, ".ts");
      const entries = topLevelFunctions(source, { exportsOnly: true }).filter(({ name }) => name === operation.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));
      const entry = entries[0] ?? topLevelFunctions(source, { exportsOnly: true })[0];
      if (!entry) {
        found.push({
          subject: "signature",
          path,
          line: 1,
          fingerprint: `${capability.name}:${operation}:missing-entry`,
          message: `${operation} exports no free capability entry`
        });
        continue;
      }

      const names = entry.node.parameters.map((parameter) =>
        ts.isIdentifier(parameter.name) ? parameter.name.text : null
      );
      if (names.length !== 3 || names.some((name, index) => name !== ["context", "ports", "input"][index])) {
        found.push({
          subject: "signature",
          path,
          line: lineOf(source, entry.node),
          fingerprint: `${operation}:parameters:${names.join(",")}`,
          message: `${entry.name} must receive exactly (context, ports, input); found (${names.join(", ")})`
        });
      }

      const categories = [
        ...entry.node.parameters.map((parameter, index) => ({
          name: ["context", "ports", "input"][index] ?? `parameter-${index + 1}`,
          node: parameter,
          type: parameter.type
        })),
        { name: "result", node: entry.node, type: entry.node.type }
      ];

      for (const category of categories) {
        if (!category.type) {
          found.push({
            subject: "signature",
            path,
            line: lineOf(source, category.node),
            fingerprint: `${operation}:${category.name}:untyped`,
            message: `${entry.name} has no explicit ${category.name} type`
          });
          continue;
        }
        const broad = broadTypeNode(category.type, {
          functions: category.name !== "ports",
          unknown: true
        });
        if (broad) {
          found.push({
            subject: "broad-authority",
            path,
            line: lineOf(source, broad),
            fingerprint: `${operation}:${category.name}:${broad.getText(source)}`,
            message: `${category.name} uses broad or callable authority ${broad.getText(source)}`
          });
        }
        const outside = referencesOutside(compiler, category.type, capability.path);
        if (outside) {
          found.push({
            subject: "locality",
            path,
            line: lineOf(source, outside),
            fingerprint: `${operation}:${category.name}:${outside.getText(source)}`,
            message: `${category.name} type ${outside.getText(source)} is not declared inside ${capability.name}`
          });
        }
        if (category.name !== "ports") {
          const callable = localTypeHasCallable(compiler, category.type, capability.path);
          if (callable) {
            found.push({
              subject: "data-only",
              path,
              line: lineOf(callable.getSourceFile(), callable),
              fingerprint: `${operation}:${category.name}:callable:${callable.pos}`,
              message: `${category.name} contains callable or indexed data rather than an owned value`
            });
          }
        }
      }

      const admission = join(dirname(path), `admit-${operation}.ts`);
      if (!tree.isFile(admission)) {
        found.push({
          subject: "admission",
          path: dirname(path),
          fingerprint: `${capability.name}:${operation}:missing-admission`,
          message: `${operation} has no local admit-${operation}.ts ownership boundary`
        });
      }

      visit(source, (node) => {
        if (!ts.isCatchClause(node)) return;
        const returned = catchConvertsToResult(node);
        if (!returned) return;
        found.push({
          subject: "faults",
          path,
          line: lineOf(source, returned),
          fingerprint: `${operation}:caught-result:${returned.pos}`,
          message: "capability catch converts an operational fault into a normal result instead of rethrowing"
        });
      });
    }
    return found;
  }
});
