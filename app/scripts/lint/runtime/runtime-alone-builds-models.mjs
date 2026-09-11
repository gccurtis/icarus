import { join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { isExported, lineOf, pascal, topLevelFunctions, visit } from "../shared/pure-contract.mjs";
import { isProductionPath } from "../shared/pure-islands.mjs";
import { objects } from "../shared/trees.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const camel = (value) => {
  const name = pascal(value);
  return name[0]?.toLowerCase() + name.slice(1);
};

const symbolOfFunction = (compiler, declaration) => {
  if (ts.isFunctionDeclaration(declaration)) return compiler.symbolAt(declaration.name);
  return compiler.symbolAt(declaration.name);
};

const productionSources = (tree) =>
  tree.files.filter(
    (path) =>
      path.endsWith(".ts") &&
      !path.endsWith(".d.ts") &&
      isProductionPath(tree.src, path)
  );

const expectedBuilder = (tree, environment) =>
  tree.path(
    "runtime",
    environment,
    "models",
    environment === "server" ? "build.server.ts" : "build.ts"
  );

export default check({
  name: "runtime-alone-builds-models",
  baseline: false,
  says: "Runtime is the sole, single caller of every model state constructor and binding function.",
  subjects: {
    builder: "each environment has one designated runtime model builder",
    construction: "state is constructed exactly once and only by its matching builder",
    binding: "a model is bound exactly once and only by its matching builder",
    grammar: "runtime builders construct and aggregate models without invoking domain behavior",
    shutdown: "runtime owns closeable adapter shutdown"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const found = [];
    const sources = productionSources(tree);
    const callsBySymbol = new Map();

    for (const path of sources) {
      const source = compiler.source(path);
      visit(source, (node) => {
        if (!ts.isCallExpression(node)) return;
        const target = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name
          : node.expression;
        const symbol = compiler.symbolAt(target);
        if (!symbol) return;
        if (!callsBySymbol.has(symbol)) callsBySymbol.set(symbol, []);
        callsBySymbol.get(symbol).push({ path, source, node });
      });
    }

    for (const environment of ["client", "server"]) {
      const builder = expectedBuilder(tree, environment);
      if (!tree.isFile(builder)) {
        found.push({
          subject: "builder",
          path: join(tree.path("runtime", environment), "models"),
          fingerprint: `${environment}:missing-builder`,
          message: `${environment} runtime has no designated models/${environment === "server" ? "build.server.ts" : "build.ts"}`
        });
      }
    }

    for (const { id, name, path: root, environment } of objects(tree)) {
      const builder = expectedBuilder(tree, environment);
      const statePath = join(root, "state.ts");
      const portPath = join(root, "port.ts");
      const declarations = [];

      if (tree.isFile(statePath)) {
        const source = compiler.source(statePath);
        const constructors = topLevelFunctions(source, { exportsOnly: true }).filter(({ name: functionName }) => /^create[A-Z].*State$/.test(functionName));
        for (const fn of constructors) declarations.push({ kind: "construction", path: statePath, ...fn });
      }
      if (tree.isFile(portPath)) {
        const source = compiler.source(portPath);
        const expected = `bind${pascal(name)}`;
        const bindings = topLevelFunctions(source, { exportsOnly: true }).filter(({ name: functionName }) => functionName === expected);
        for (const fn of bindings) declarations.push({ kind: "binding", path: portPath, ...fn });
      }

      for (const declaration of declarations) {
        const symbol = symbolOfFunction(compiler, declaration.declaration);
        const calls = symbol ? callsBySymbol.get(symbol) ?? [] : [];
        if (calls.length !== 1) {
          found.push({
            subject: declaration.kind,
            path: declaration.path,
            line: lineOf(compiler.source(declaration.path), declaration.node),
            fingerprint: `${id}:${declaration.name}:callers:${calls.length}`,
            message: `${declaration.name} must have exactly one production caller in ${tree.rel(builder)}; found ${calls.length}`
          });
        }
        for (const call of calls) {
          if (call.path === builder) continue;
          found.push({
            subject: declaration.kind,
            path: call.path,
            line: lineOf(call.source, call.node),
            fingerprint: `${id}:${declaration.name}:caller:${tree.rel(call.path)}`,
            message: `${declaration.name} is called outside its matching runtime model builder`
          });
        }
      }

      if (!tree.isFile(builder)) continue;
      const builderSource = compiler.source(builder);
      const expectedKey = camel(name);
      const text = tree.read(builder);
      if (!new RegExp(`\\b${expectedKey}\\b`).test(text)) {
        found.push({
          subject: "binding",
          path: builder,
          line: 1,
          fingerprint: `${id}:missing-key:${expectedKey}`,
          message: `${id} is not aggregated under its exact runtime key ${expectedKey}`
        });
      }

      for (const edge of tree.imports(builder)) {
        const target = tree.resolve(edge.specifier, builder);
        if (!target) continue;
        if (target.includes("/methods/") || target.includes("/capabilities/")) {
          found.push({
            subject: "grammar",
            path: builder,
            line: edge.line,
            fingerprint: `${id}:domain-import:${edge.specifier}`,
            message: "runtime model builders cannot import model methods or capability behavior"
          });
        }
      }

      if (tree.isFile(portPath) && /\bclose\s*[?(]/.test(tree.read(portPath))) {
        const lifetime = environment === "server"
          ? tree.path("runtime", environment, "lifetime.server.ts")
          : builder;
        if (!tree.isFile(lifetime) || !new RegExp(`\\b${expectedKey}\\b[\\s\\S]*?\\.close\\s*\\(`).test(tree.read(lifetime))) {
          found.push({
            subject: "shutdown",
            path: tree.isFile(lifetime) ? lifetime : builder,
            line: 1,
            fingerprint: `${id}:close-owner`,
            message: `${id} declares close but its runtime lifetime does not visibly own it`
          });
        }
      }
    }
    return found;
  }
});
