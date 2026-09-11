import { basename, dirname, join, relative, sep } from "node:path";

import { capabilities, objects } from "./trees.mjs";

const TEST_DIRECTORIES = new Set(["test", "tests", "__tests__", "fixture", "fixtures"]);
const NON_PRODUCTION_NAMES = /(?:^|\.)(?:test|spec|fixture|stories)\.[^.]+$/;
const SOURCE_SUFFIXES = [
  ".d.ts",
  ".svelte.ts",
  ".tsx",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".js",
  ".ts",
  ".svelte",
  ".vue",
  ".astro"
];

const segmentsBetween = (parent, path) =>
  relative(parent, path)
    .split(sep)
    .filter((part) => part.length > 0);

export const isProductionPath = (root, path) => {
  const parts = segmentsBetween(root, path);
  return !parts.some((part) => TEST_DIRECTORIES.has(part)) && !NON_PRODUCTION_NAMES.test(basename(path));
};

/**
 * The source grammar deliberately has one implementation language. Discovery
 * knows the common alternate source extensions so finding one fails closed
 * instead of silently making it an architectural escape hatch.
 */
export const pureSourceKind = (path) => {
  const suffix = SOURCE_SUFFIXES.find((candidate) => path.endsWith(candidate));
  if (!suffix) return null;
  return suffix === ".ts" ? "typescript" : suffix.slice(1);
};

export const isOrdinaryTypeScript = (path) => pureSourceKind(path) === "typescript";

const sourceFilesBelow = (tree, root) =>
  tree
    .under(root)
    .filter((path) => isProductionPath(root, path) && pureSourceKind(path) !== null);

const capabilityIslands = (tree) =>
  capabilities(tree).map(({ name, path: root }) => ({
    id: `capability:${name}`,
    kind: "capability",
    name,
    root,
    entryRoot: root,
    entries: sourceFilesBelow(tree, root),
    allows(path) {
      return tree.within(root, path) && isProductionPath(root, path);
    }
  }));

const modelIslands = (tree) => {
  const found = [];
  for (const { id, name, path: root } of objects(tree)) {
    const methods = join(root, "methods");
    if (!tree.exists(methods)) continue;
    const stateFiles = new Set([join(root, "state.ts"), join(root, "types.ts")]);
    found.push({
      id: `model:${id}`,
      kind: "model-method",
      name: id,
      root,
      entryRoot: methods,
      entries: sourceFilesBelow(tree, methods),
      allows(path) {
        return (
          isProductionPath(root, path) &&
          (tree.within(methods, path) || stateFiles.has(path))
        );
      }
    });
  }
  return found;
};

const COMPONENT_ROOTS = [
  ["app-views"],
  ["components", "authored"],
  ["components", "development"],
  ["development-views"],
  ["surfaces"]
];

const componentIslands = (tree) => {
  const procedureRoots = new Set();
  for (const segments of COMPONENT_ROOTS) {
    const root = tree.path(...segments);
    for (const path of tree.under(root)) {
      const parts = segmentsBetween(root, path);
      const marker = parts.indexOf("procedures");
      if (marker < 0) continue;
      procedureRoots.add(join(root, ...parts.slice(0, marker + 1)));
    }
  }

  return [...procedureRoots].sort().map((procedures) => {
    const owner = dirname(procedures);
    const name = tree.rel(owner).replace(/^src\/lib\//, "");
    const types = join(owner, "types");
    return {
      id: `component:${name}`,
      kind: "component-procedure",
      name,
      root: owner,
      entryRoot: procedures,
      entries: sourceFilesBelow(tree, procedures),
      allows(path) {
        return (
          isProductionPath(owner, path) &&
          (tree.within(procedures, path) || tree.within(types, path))
        );
      }
    };
  });
};

let cache = new WeakMap();

/** Filesystem-derived ownership for all three pure-island families. */
export const pureIslands = (tree) => {
  if (!cache.has(tree)) {
    cache.set(tree, [
      ...capabilityIslands(tree),
      ...modelIslands(tree),
      ...componentIslands(tree)
    ]);
  }
  return cache.get(tree);
};

export const islandLabel = (island) => `${island.kind} ${island.name}`;

export const clearPureIslandCacheForTests = () => {
  cache = new WeakMap();
};
