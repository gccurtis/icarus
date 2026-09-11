import { relative, resolve, sep } from "node:path";

import ts from "typescript";

const PROGRAM_SOURCE_SUFFIX = /(?:\.[cm]?[jt]sx?|\.svelte\.ts)$/;
const cache = new WeakMap();

const aliasPaths = (tree) => {
  const paths = {};
  for (const [alias, target] of Object.entries(tree.aliases)) {
    const normalized = target.split(sep).join("/");
    paths[alias] = [normalized];
    paths[`${alias}/*`] = [`${normalized}/*`];
  }
  return paths;
};

const configurationFor = (tree) => ({
  allowArbitraryExtensions: true,
  allowJs: true,
  baseUrl: tree.base,
  checkJs: false,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  paths: aliasPaths(tree),
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ESNext
});

const normalize = (path) => resolve(path);

/**
 * One compiler program and module resolver per immutable checker Tree. It uses
 * the aliases loaded from the repository's Svelte configuration and the same
 * bundler-resolution mode as tsconfig.json.
 */
export const repositoryProgram = (tree) => {
  if (cache.has(tree)) return cache.get(tree);

  const options = configurationFor(tree);
  const rootNames = tree.files.filter(
    (path) => PROGRAM_SOURCE_SUFFIX.test(path) && !path.endsWith(".svelte")
  );
  const program = ts.createProgram({ rootNames, options });
  const checker = program.getTypeChecker();
  const moduleResolutionCache = ts.createModuleResolutionCache(
    tree.base,
    (path) => path,
    options
  );

  const api = {
    checker,
    options,
    program,
    source(path) {
      return program.getSourceFile(normalize(path)) ?? program.getSourceFile(path) ?? tree.source(path);
    },
    resolveModule(specifier, from) {
      const resolved = ts.resolveModuleName(
        specifier,
        from,
        options,
        ts.sys,
        moduleResolutionCache
      ).resolvedModule?.resolvedFileName;
      return resolved ? normalize(resolved) : tree.resolve(specifier, from);
    },
    symbolAt(node) {
      const symbol = checker.getSymbolAtLocation(node);
      if (!symbol) return null;
      return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    },
    declarationPaths(symbol) {
      return [...(symbol?.declarations ?? [])]
        .map((declaration) => declaration.getSourceFile()?.fileName)
        .filter(Boolean)
        .map(normalize);
    },
    describes(path) {
      const inside = relative(tree.base, path).split(sep).join("/");
      return inside.startsWith("../") ? path : inside;
    }
  };

  cache.set(tree, api);
  return api;
};
