import { realpathSync } from "node:fs";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  islandDependencyClosure,
  moduleEdges,
  resolveEdge
} from "../shared/pure-island-graph.mjs";
import {
  islandLabel,
  isOrdinaryTypeScript,
  pureIslands,
  pureSourceKind
} from "../shared/pure-islands.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const STANDARD_TYPE_ALLOWLIST = new Set([
  "Array",
  "ArrayBuffer",
  "ArrayBufferView",
  "Awaited",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "ConstructorParameters",
  "Error",
  "Exclude",
  "Extract",
  "Float32Array",
  "Float64Array",
  "InstanceType",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Lowercase",
  "Map",
  "NonNullable",
  "Number",
  "Omit",
  "Parameters",
  "Partial",
  "Pick",
  "Promise",
  "PromiseLike",
  "Readonly",
  "ReadonlyArray",
  "ReadonlyMap",
  "ReadonlySet",
  "Record",
  "RegExp",
  "Required",
  "ReturnType",
  "String",
  "Set",
  "ThisParameterType",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uncapitalize",
  "Uppercase",
  "WeakMap",
  "WeakSet"
]);

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const relativeChain = (tree, chain) => chain.map((path) => tree.rel(path)).join(" -> ");

const safeRealpath = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const typeReferences = (source) => {
  const found = [];
  const visit = (node) => {
    if (ts.isTypeReferenceNode(node)) found.push({ name: node.typeName.getText(source), node: node.typeName });
    if (ts.isExpressionWithTypeArguments(node)) {
      found.push({ name: node.expression.getText(source), node: node.expression });
    }
    if (ts.isTypeQueryNode(node)) {
      found.push({ name: `typeof ${node.exprName.getText(source)}`, node: node.exprName, query: true });
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
};

const ambientDeclarations = (source) => {
  const found = [];
  const visit = (node) => {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
    const declared = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword);
    if (
      (ts.isModuleDeclaration(node) &&
        (declared || ts.isStringLiteral(node.name) || (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0)) ||
      declared
    ) found.push(node);
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
};

export default check({
  name: "pure-island-import-closure",
  baseline: false,
  says: "Every capability, model-method, and component-procedure dependency resolves inside its exact pure island.",
  subjects: {
    "unsupported-source": "pure-island implementations use ordinary TypeScript modules",
    "dependency-escape": "static value and type dependencies stay inside the exact owner zone",
    "unresolved-dependency": "every dependency edge and referenced type has known provenance",
    "dynamic-load": "pure islands contain no runtime or type-level dynamic loading",
    "ambient-type": "pure-island types are owner-local or explicitly reviewed standard-library types",
    "ambient-declaration": "pure islands cannot add or merge ambient declarations",
    "symlink-escape": "a logical in-island path cannot resolve outside its owner"
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
      for (const entry of island.entries) {
        const kind = pureSourceKind(entry);
        if (!isOrdinaryTypeScript(entry)) {
          remember({
            subject: "unsupported-source",
            path: entry,
            line: 1,
            fingerprint: `${island.id}:${kind}`,
            message: `${islandLabel(island)} contains ${kind ?? "an unknown source form"}; pure implementations must be ordinary .ts modules`
          });
        }
        const real = safeRealpath(entry);
        if (real && real !== entry && !island.allows(real)) {
          remember({
            subject: "symlink-escape",
            path: entry,
            line: 1,
            fingerprint: `${island.id}:${tree.rel(entry)}`,
            message: `${tree.rel(entry)} resolves outside ${islandLabel(island)} to ${compiler.describes(real)}`
          });
        }
      }

      const closure = islandDependencyClosure(tree, island);
      for (const [path, chain] of closure) {
        if (!isOrdinaryTypeScript(path)) continue;
        const source = compiler.source(path);

        for (const edge of moduleEdges(tree, path)) {
          const fingerprint = `${edge.kind}:${edge.specifier ?? "computed"}`;
          if (!edge.staticEdge) {
            remember({
              subject: "dynamic-load",
              path,
              line: edge.line,
              fingerprint,
              message: `${edge.kind} is forbidden in ${islandLabel(island)}${edge.specifier ? ` (${edge.specifier})` : " with a computed target"}`
            });
            continue;
          }

          const alias = edge.specifier ? tree.aliasTarget(edge.specifier) : null;
          const externalSpecifier =
            edge.specifier && !edge.specifier.startsWith(".") && !alias;
          if (externalSpecifier) {
            const resolved = resolveEdge(tree, path, edge);
            remember({
              subject: "dependency-escape",
              path,
              line: edge.line,
              fingerprint,
              message: `${relativeChain(tree, chain)} -> ${edge.specifier} names ${resolved ? compiler.describes(resolved) : "an external package/module"}, outside ${islandLabel(island)}`
            });
            continue;
          }

          const target = resolveEdge(tree, path, edge);
          if (!target) {
            remember({
              subject: "unresolved-dependency",
              path,
              line: edge.line,
              fingerprint,
              message: `${edge.kind} ${edge.specifier ?? "<computed>"} does not resolve; dependency provenance fails closed`
            });
            continue;
          }

          const targetKind = pureSourceKind(target);
          if (!island.allows(target) || targetKind === null) {
            remember({
              subject: "dependency-escape",
              path,
              line: edge.line,
              fingerprint,
              message: `${relativeChain(tree, chain)} -> ${edge.specifier} resolves to ${compiler.describes(target)}, outside ${islandLabel(island)}`
            });
            continue;
          }

          const real = safeRealpath(target);
          if (real && real !== target && !island.allows(real)) {
            remember({
              subject: "symlink-escape",
              path,
              line: edge.line,
              fingerprint,
              message: `${relativeChain(tree, chain)} -> ${edge.specifier} resolves through a symlink to ${compiler.describes(real)}`
            });
          }
        }

        for (const node of ambientDeclarations(source)) {
          remember({
            subject: "ambient-declaration",
            path,
            line: lineOf(source, node),
            fingerprint: node.getText(source).slice(0, 80),
            message: `ambient declaration or module augmentation is forbidden in ${islandLabel(island)}`
          });
        }

        for (const reference of typeReferences(source)) {
          const symbol = compiler.symbolAt(reference.node);
          const declarationPaths = compiler.declarationPaths(symbol);
          const simpleName = reference.name.replace(/^typeof /, "").split(".").at(-1);
          const standard =
            !reference.query &&
            STANDARD_TYPE_ALLOWLIST.has(simpleName) &&
            declarationPaths.length > 0 &&
            declarationPaths.every((declaration) => declaration.includes("/node_modules/typescript/lib/"));
          if (standard) continue;
          if (declarationPaths.length === 0) {
            remember({
              subject: "unresolved-dependency",
              path,
              line: lineOf(source, reference.node),
              fingerprint: `type:${reference.name}`,
              message: `${reference.name} has no resolvable declaration; type provenance fails closed`
            });
            continue;
          }
          if (declarationPaths.every((declaration) => island.allows(declaration))) continue;
          remember({
            subject: "ambient-type",
            path,
            line: lineOf(source, reference.node),
            fingerprint: `type:${reference.name}`,
            message: `${reference.name} resolves to ${declarationPaths.map((declaration) => compiler.describes(declaration)).join(", ")}, outside ${islandLabel(island)}`
          });
        }
      }
    }
    return found;
  }
});
