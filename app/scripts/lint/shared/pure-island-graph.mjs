import { dirname, resolve } from "node:path";

import ts from "typescript";

import { isOrdinaryTypeScript, pureSourceKind } from "./pure-islands.mjs";
import { repositoryProgram } from "./typescript-program.mjs";

const edgeCache = new WeakMap();

const lineOf = (source, position) =>
  source.getLineAndCharacterOfPosition(Math.max(0, position)).line + 1;

const textSpecifier = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;

/** Every syntax form which can introduce another module or declaration file. */
export const moduleEdges = (tree, path) => {
  if (!edgeCache.has(tree)) edgeCache.set(tree, new Map());
  const byPath = edgeCache.get(tree);
  if (byPath.has(path)) return byPath.get(path);

  const compiler = repositoryProgram(tree);
  const source = compiler.source(path);
  const found = [];
  const add = ({ kind, node, specifier, staticEdge = true }) => {
    found.push({
      kind,
      line: lineOf(source, node.getStart(source)),
      node,
      specifier,
      staticEdge
    });
  };

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      add({
        kind: ts.isImportDeclaration(node) ? "import" : "export-from",
        node,
        specifier: textSpecifier(node.moduleSpecifier)
      });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add({
        kind: "import-equals",
        node,
        specifier: textSpecifier(node.moduleReference.expression),
        staticEdge: false
      });
    } else if (ts.isImportTypeNode(node)) {
      const argument = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : null;
      add({
        kind: "import-type",
        node,
        specifier: textSpecifier(argument),
        staticEdge: false
      });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add({
        kind: "dynamic-import",
        node,
        specifier: textSpecifier(node.arguments[0]),
        staticEdge: false
      });
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      add({
        kind: "require",
        node,
        specifier: textSpecifier(node.arguments[0]),
        staticEdge: false
      });
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);

  for (const reference of source.referencedFiles ?? []) {
    found.push({
      kind: "triple-slash-path",
      line: lineOf(source, reference.pos),
      node: source,
      specifier: reference.fileName,
      staticEdge: false
    });
  }
  for (const reference of source.typeReferenceDirectives ?? []) {
    found.push({
      kind: "triple-slash-types",
      line: lineOf(source, reference.pos),
      node: source,
      specifier: reference.fileName,
      staticEdge: false
    });
  }
  for (const reference of source.libReferenceDirectives ?? []) {
    found.push({
      kind: "triple-slash-lib",
      line: lineOf(source, reference.pos),
      node: source,
      specifier: reference.fileName,
      staticEdge: false
    });
  }

  byPath.set(path, found);
  return found;
};

export const resolveEdge = (tree, path, edge) => {
  if (!edge.specifier) return null;
  if (edge.kind === "triple-slash-path") {
    const exact = resolve(dirname(path), edge.specifier);
    if (tree.isFile(exact)) return exact;
  }
  return repositoryProgram(tree).resolveModule(edge.specifier, path);
};

/**
 * Multi-source traversal. Every governed implementation is a root; allowed
 * state/type support files join the queue only when an island source reaches
 * them. `chain` is therefore the shortest discovered path to each module.
 */
export const islandDependencyClosure = (tree, island) => {
  const queue = island.entries.map((path) => ({ path, chain: [path] }));
  const reached = new Map(queue.map(({ path, chain }) => [path, chain]));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { path, chain } = queue[cursor];
    if (!isOrdinaryTypeScript(path)) continue;
    for (const edge of moduleEdges(tree, path)) {
      if (!edge.staticEdge) continue;
      const target = resolveEdge(tree, path, edge);
      if (!target || !island.allows(target) || pureSourceKind(target) === null) continue;
      if (reached.has(target)) continue;
      const next = [...chain, target];
      reached.set(target, next);
      queue.push({ path: target, chain: next });
    }
  }
  return reached;
};
