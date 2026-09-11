import { basename } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { islandDependencyClosure, moduleEdges } from "../shared/pure-island-graph.mjs";
import { islandLabel, isOrdinaryTypeScript, pureIslands } from "../shared/pure-islands.mjs";
import { isDeeplyFrozenLiteral, isPrimitiveLiteral, unwrapExpression } from "../shared/pure-values.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const ALLOWED_GLOBAL_CALLS = new Set([
  "Boolean",
  "BigInt",
  "Number",
  "String",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt"
]);

const ALLOWED_GLOBAL_VALUES = new Set(["Infinity", "NaN", "undefined"]);
const ALLOWED_CONSTRUCTORS = new Set([
  "AggregateError",
  "Array",
  "ArrayBuffer",
  "BigInt64Array",
  "BigUint64Array",
  "Error",
  "EvalError",
  "Float32Array",
  "Float64Array",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Map",
  "RangeError",
  "ReferenceError",
  "RegExp",
  "Set",
  "SyntaxError",
  "TypeError",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "URIError",
  "WeakMap",
  "WeakSet"
]);

const ALLOWED_STATIC_MEMBERS = new Map([
  ["Array", new Set(["from", "isArray", "of"])],
  ["BigInt", new Set(["asIntN", "asUintN"])],
  ["JSON", new Set(["parse", "stringify"])],
  [
    "Math",
    new Set([
      "E", "LN10", "LN2", "LOG10E", "LOG2E", "PI", "SQRT1_2", "SQRT2",
      "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
      "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor",
      "fround", "hypot", "imul", "log", "log10", "log1p", "log2", "max",
      "min", "pow", "round", "sign", "sin", "sinh", "sqrt", "tan", "tanh",
      "trunc"
    ])
  ],
  ["Number", new Set(["EPSILON", "MAX_SAFE_INTEGER", "MAX_VALUE", "MIN_SAFE_INTEGER", "MIN_VALUE", "NaN", "NEGATIVE_INFINITY", "POSITIVE_INFINITY", "isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat", "parseInt"])],
  ["Object", new Set(["entries", "freeze", "fromEntries", "hasOwn", "is", "keys", "values"])],
  ["Promise", new Set(["all", "allSettled"])],
  ["String", new Set(["fromCharCode", "fromCodePoint", "raw"])],
  ["RegExp", new Set(["escape"])]
]);

const BANNED_IDENTIFIERS = new Set([
  "$effect",
  "$state",
  "$derived",
  "$props",
  "$bindable",
  "$inspect",
  "$host",
  "Atomics",
  "FinalizationRegistry",
  "Function",
  "Proxy",
  "Reflect",
  "SharedArrayBuffer",
  "WeakRef",
  "WebAssembly",
  "alert",
  "cancelAnimationFrame",
  "clearInterval",
  "clearTimeout",
  "console",
  "crypto",
  "document",
  "eval",
  "fetch",
  "getComputedStyle",
  "globalThis",
  "importScripts",
  "localStorage",
  "navigator",
  "performance",
  "process",
  "queueMicrotask",
  "requestAnimationFrame",
  "require",
  "sessionStorage",
  "setInterval",
  "setTimeout",
  "window"
]);

const LOCALE_MEMBERS = new Set([
  "localeCompare",
  "toLocaleDateString",
  "toLocaleLowerCase",
  "toLocaleString",
  "toLocaleTimeString",
  "toLocaleUpperCase"
]);

const SUPPRESSION = /@ts-(?:ignore|expect-error|nocheck)|(?:eslint|biome)-disable|c8 ignore|istanbul ignore|architecture[- ](?:ignore|exempt|disable)/i;

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const declarationIdentifier = (node) => {
  const parent = node.parent;
  if (!parent) return false;
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isTypeParameterDeclaration(parent) ||
      ts.isImportClause(parent) ||
      ts.isNamespaceImport(parent) ||
      ts.isImportSpecifier(parent)) &&
    parent.name === node
  ) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) &&
    parent.name === node
  ) return true;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  ) return true;
  if (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) {
    return parent.label === node;
  }
  return false;
};

const inTypePosition = (node) => {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isTypeNode(current)) return true;
    if (ts.isExpression(current) || ts.isStatement(current)) return false;
    current = current.parent;
  }
  return false;
};

const inImportOrExport = (node) => {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true;
    current = current.parent;
  }
  return false;
};

const bindingIdentifiers = (name, found = []) => {
  if (ts.isIdentifier(name)) found.push(name);
  else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindingIdentifiers(element.name, found);
  return found;
};

const safeModuleInitializer = (node) => {
  if (!node) return false;
  const value = unwrapExpression(node);
  if (isPrimitiveLiteral(value) || isDeeplyFrozenLiteral(value)) return true;
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return true;
  if (ts.isRegularExpressionLiteral(value)) {
    const flags = value.text.slice(value.text.lastIndexOf("/") + 1);
    return !/[gy]/.test(flags);
  }
  return false;
};

const moduleBindings = (compiler, source) => {
  const found = new Map();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const declaration of statement.declarationList.declarations) {
        const safe = constant && safeModuleInitializer(declaration.initializer);
        for (const identifier of bindingIdentifiers(declaration.name)) {
          const symbol = compiler.checker.getSymbolAtLocation(identifier);
          if (symbol) found.set(symbol, { identifier, safe, kind: constant ? "const" : "mutable binding" });
        }
      }
    }
  }
  return found;
};

const rawSymbol = (compiler, node) => compiler.checker.getSymbolAtLocation(node) ?? null;

const importedAlias = (compiler, node) => {
  const symbol = rawSymbol(compiler, node);
  return Boolean(symbol && (symbol.flags & ts.SymbolFlags.Alias));
};

const declaredOutsideProgramSource = (compiler, symbol, tree) => {
  const declarations = symbol?.declarations ?? [];
  return declarations.length > 0 && declarations.every((declaration) => {
    const source = declaration.getSourceFile();
    return source.isDeclarationFile || !tree.within(tree.src, source.fileName);
  });
};

const hasLocalRuntimeDeclaration = (symbol, tree) =>
  (symbol?.declarations ?? []).some((declaration) => {
    const source = declaration.getSourceFile();
    return !source.isDeclarationFile && tree.within(tree.src, source.fileName);
  });

const allowedAmbientUse = (node) => {
  const name = node.text;
  const parent = node.parent;
  if (ALLOWED_GLOBAL_VALUES.has(name)) return true;
  if (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.expression === node
  ) {
    return ts.isNewExpression(parent)
      ? ALLOWED_CONSTRUCTORS.has(name)
      : ALLOWED_GLOBAL_CALLS.has(name) || ALLOWED_CONSTRUCTORS.has(name);
  }
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return ALLOWED_STATIC_MEMBERS.get(name)?.has(parent.name.text) ?? false;
  }
  return false;
};

const rootIdentifier = (node) => {
  let current = unwrapExpression(node);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(current.expression);
  }
  return ts.isIdentifier(current) ? current : null;
};

const mutatedExpression = (node) => {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) return node.left;
  if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
  ) return node.operand;
  if (ts.isDeleteExpression(node)) return node.expression;
  return null;
};

const typeContainsCallable = (compiler, type, seen = new Set(), depth = 0) => {
  if (!type || depth > 3 || seen.has(type)) return false;
  seen.add(type);
  if (type.getCallSignatures().length > 0) return true;
  const declarationPaths = type.symbol ? compiler.declarationPaths(type.symbol) : [];
  if (declarationPaths.some((path) => path.includes("/node_modules/typescript/lib/"))) return false;
  return type.getProperties().some((property) => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) return false;
    return typeContainsCallable(
      compiler,
      compiler.checker.getTypeOfSymbolAtLocation(property, declaration),
      seen,
      depth + 1
    );
  });
};

const parameterSymbols = (compiler, node) => {
  const found = new Set();
  for (const parameter of node.parameters ?? []) {
    for (const identifier of bindingIdentifiers(parameter.name)) {
      const symbol = rawSymbol(compiler, identifier);
      if (symbol) found.add(symbol);
    }
  }
  return found;
};

const broadTypeNode = (node, typeParameters) => {
  if (!node) return false;
  if (
    node.kind === ts.SyntaxKind.AnyKeyword ||
    node.kind === ts.SyntaxKind.UnknownKeyword ||
    node.kind === ts.SyntaxKind.ObjectKeyword
  ) return true;
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    if (name === "Function" || typeParameters.has(name)) return true;
  }
  if (ts.isIndexSignatureDeclaration(node)) return true;
  let broad = false;
  node.forEachChild((child) => {
    if (broadTypeNode(child, typeParameters)) broad = true;
  });
  return broad;
};

const admissionPath = (path) =>
  basename(path).startsWith("admit-") || path.split(/[\\/]/).includes("admission");

const functionAncestor = (node) => {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
};

const declarationWithin = (declaration, owner) => {
  let current = declaration;
  while (current && !ts.isSourceFile(current)) {
    if (current === owner) return true;
    current = current.parent;
  }
  return false;
};

const explicitAsyncOrigin = (compiler, island, expression, owner, seen = new Set()) => {
  const value = unwrapExpression(expression);
  if (seen.has(value)) return false;
  seen.add(value);
  if (ts.isConditionalExpression(value)) {
    return (
      explicitAsyncOrigin(compiler, island, value.whenTrue, owner, seen) &&
      explicitAsyncOrigin(compiler, island, value.whenFalse, owner, seen)
    );
  }
  if (ts.isIdentifier(value)) {
    const symbol = rawSymbol(compiler, value);
    const declaration = symbol?.valueDeclaration;
    return Boolean(
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      declarationWithin(declaration, owner) &&
      explicitAsyncOrigin(compiler, island, declaration.initializer, owner, seen)
    );
  }
  if (!ts.isCallExpression(value)) return false;
  const callee = unwrapExpression(value.expression);
  if (ts.isIdentifier(callee)) {
    const symbol = rawSymbol(compiler, callee);
    if (!symbol) return false;
    if ([...(symbol.declarations ?? [])].some((declaration) => ts.isParameter(declaration) && declarationWithin(declaration, owner))) {
      return true;
    }
    return compiler.declarationPaths(compiler.symbolAt(callee)).some((path) => island.allows(path));
  }
  if (ts.isPropertyAccessExpression(callee)) {
    if (
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === "Promise" &&
      (callee.name.text === "all" || callee.name.text === "allSettled")
    ) {
      const [argument] = value.arguments;
      return Boolean(
        argument &&
        ts.isArrayLiteralExpression(unwrapExpression(argument)) &&
        unwrapExpression(argument).elements.every((element) =>
          explicitAsyncOrigin(compiler, island, element, owner, new Set(seen))
        )
      );
    }
    const root = rootIdentifier(callee.expression);
    const symbol = root ? rawSymbol(compiler, root) : null;
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    return Boolean(declaration && declarationWithin(declaration, owner));
  }
  return false;
};

const promiseProducing = (compiler, node) => {
  try {
    const type = compiler.checker.getTypeAtLocation(node);
    return Boolean(compiler.checker.getPromisedTypeOfPromise(type));
  } catch {
    return false;
  }
};

const escapingFunction = (node) => {
  let current = node.parent;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current))) current = current.parent;
  return Boolean(
    current &&
    (ts.isReturnStatement(current) ||
      (ts.isArrowFunction(current) && current.body === node) ||
      (ts.isCallExpression(current) && current.arguments.includes(node)) ||
      (ts.isPropertyAssignment(current) && current.initializer === node))
  );
};

export default check({
  name: "pure-island-has-no-ambient-authority",
  baseline: false,
  says: "Pure-island runtime values come only from explicit inputs, invocation-local allocations, or in-island pure functions.",
  subjects: {
    "ambient-authority": "ambient globals and unresolved runtime authority are forbidden",
    "module-state": "pure islands retain no mutable or effectful module state",
    "attached-behavior": "pure-island behavior is expressed as free functions without this, classes, accessors or indirection",
    "dynamic-evaluation": "dynamic loading and evaluation are forbidden",
    "unsafe-narrowing": "pure-island boundaries cannot be bypassed with assertions or suppression pragmas",
    "broad-authority": "function contracts cannot accept generic or unbounded authority containers",
    "detached-work": "every asynchronous operation remains inside the invocation lifetime",
    "await-origin": "awaited work originates in an explicit port or local pure call",
    "port-introspection": "ports expose only statically named direct calls, not reflective authority"
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
      const closure = islandDependencyClosure(tree, island);
      for (const path of closure.keys()) {
        if (!isOrdinaryTypeScript(path)) continue;
        const source = compiler.source(path);
        const moduleState = moduleBindings(compiler, source);

        if (SUPPRESSION.test(source.text)) {
          const offset = source.text.search(SUPPRESSION);
          remember({
            subject: "unsafe-narrowing",
            path,
            line: source.getLineAndCharacterOfPosition(Math.max(0, offset)).line + 1,
            fingerprint: "suppression",
            message: `checker/type/lint suppression syntax is forbidden in ${islandLabel(island)}`
          });
        }

        for (const { identifier, safe, kind } of moduleState.values()) {
          if (safe) continue;
          remember({
            subject: "module-state",
            path,
            line: lineOf(source, identifier),
            fingerprint: `module:${identifier.text}`,
            message: `${kind} ${identifier.text} retains mutable or effectful state between invocations`
          });
        }

        for (const statement of source.statements) {
          if (!ts.isExpressionStatement(statement) || ts.isStringLiteral(statement.expression)) continue;
          remember({
            subject: "module-state",
            path,
            line: lineOf(source, statement),
            fingerprint: "module-expression",
            message: "module-load executable work is outside every pure invocation"
          });
        }

        const functions = [];
        const visit = (node) => {
          const enteredFunction = ts.isFunctionLike(node);
          if (enteredFunction) functions.push({ node, parameters: parameterSymbols(compiler, node) });
          const currentFunction = functions.at(-1)?.node ?? null;

          if (enteredFunction) {
            const unconstrained = new Set(
              (node.typeParameters ?? [])
                .filter((parameter) => !parameter.constraint || broadTypeNode(parameter.constraint, new Set()))
                .map((parameter) => parameter.name.text)
            );
            for (const parameter of node.parameters ?? []) {
              const admittedUnknown =
                admissionPath(path) && parameter.type?.kind === ts.SyntaxKind.UnknownKeyword;
              if (admittedUnknown) continue;
              if (!broadTypeNode(parameter.type, unconstrained)) continue;
              remember({
                subject: "broad-authority",
                path,
                line: lineOf(source, parameter),
                fingerprint: `parameter:${parameter.name.getText(source)}`,
                message: `${parameter.name.getText(source)} can carry unknown, object-wide, indexed, or unconstrained generic authority`
              });
            }
            if (broadTypeNode(node.type, unconstrained)) {
              remember({
                subject: "broad-authority",
                path,
                line: lineOf(source, node.type),
                fingerprint: "result",
                message: "the function result can expose an unknown, object-wide, indexed, or unconstrained generic value"
              });
            }
          }

          if (node.kind === ts.SyntaxKind.ThisKeyword) {
            remember({
              subject: "attached-behavior",
              path,
              line: lineOf(source, node),
              fingerprint: "this",
              message: "reads behavior through this instead of an explicit input"
            });
          }
          if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isMethodDeclaration(node)) {
            remember({
              subject: "attached-behavior",
              path,
              line: lineOf(source, node),
              fingerprint: `runtime-${ts.SyntaxKind[node.kind]}`,
              message: "runtime classes and attached methods are forbidden; use free functions"
            });
          }
          if (ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
            remember({
              subject: "module-state",
              path,
              line: lineOf(source, node),
              fingerprint: `runtime-${ts.SyntaxKind[node.kind]}`,
              message: "runtime enum/namespace objects retain a module-level authority surface"
            });
          }
          if (ts.canHaveDecorators(node) && (ts.getDecorators(node) ?? []).length > 0) {
            remember({
              subject: "attached-behavior",
              path,
              line: lineOf(source, node),
              fingerprint: "decorator",
              message: "decorators execute hidden behavior outside the free-function call surface"
            });
          }
          if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
            remember({
              subject: "attached-behavior",
              path,
              line: lineOf(source, node),
              fingerprint: `accessor:${node.name.getText(source)}`,
              message: "getters and setters hide behavior behind field syntax"
            });
          }
          if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
            remember({
              subject: "dynamic-evaluation",
              path,
              line: lineOf(source, node),
              fingerprint: "import.meta",
              message: "import.meta exposes ambient module/runtime state"
            });
          }
          if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) && ["require", "eval", "Function"].includes(node.expression.text)))
          ) {
            const name = node.expression.kind === ts.SyntaxKind.ImportKeyword ? "import()" : node.expression.getText(source);
            remember({
              subject: "dynamic-evaluation",
              path,
              line: lineOf(source, node),
              fingerprint: name,
              message: `${name} dynamically acquires code or authority`
            });
          }
          if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
            const allowed = ts.isAsExpression(node) && node.type.getText(source) === "const";
            if (!allowed) {
              remember({
                subject: "unsafe-narrowing",
                path,
                line: lineOf(source, node),
                fingerprint: "type-assertion",
                message: "type assertions can conceal a wider authority surface"
              });
            }
          }
          if (ts.isNonNullExpression(node)) {
            remember({
              subject: "unsafe-narrowing",
              path,
              line: lineOf(source, node),
              fingerprint: "non-null-assertion",
              message: "non-null assertions are not permitted at pure boundaries"
            });
          }

          if (
            ts.isIdentifier(node) &&
            !declarationIdentifier(node) &&
            !inTypePosition(node) &&
            !inImportOrExport(node)
          ) {
            const raw = rawSymbol(compiler, node);
            const held = raw ? moduleState.get(raw) : null;
            if (held && !held.safe) {
              remember({
                subject: "module-state",
                path,
                line: lineOf(source, node),
                fingerprint: `read:${node.text}`,
                message: `${node.text} reads invocation-external module state`
              });
            }

            const resolved = compiler.symbolAt(node);
            const ambient = resolved && !importedAlias(compiler, node) && declaredOutsideProgramSource(compiler, resolved, tree);
            const explicitBan =
              BANNED_IDENTIFIERS.has(node.text) &&
              (!resolved || !hasLocalRuntimeDeclaration(resolved, tree));
            if ((explicitBan || ambient) && !allowedAmbientUse(node)) {
              remember({
                subject: "ambient-authority",
                path,
                line: lineOf(source, node),
                fingerprint: `ambient:${node.text}`,
                message: `${node.text} resolves to ambient runtime authority instead of an explicit input`
              });
            }
          }

          const mutation = mutatedExpression(node);
          if (mutation) {
            const root = rootIdentifier(mutation);
            const symbol = root ? rawSymbol(compiler, root) : null;
            if (root && symbol && (importedAlias(compiler, root) || moduleState.has(symbol))) {
              remember({
                subject: "module-state",
                path,
                line: lineOf(source, node),
                fingerprint: `mutation:${root.text}`,
                message: `${root.text} mutates an imported or invocation-external module value`
              });
            }
          }

          if (
            ts.isPropertyAccessExpression(node) &&
            LOCALE_MEMBERS.has(node.name.text) &&
            ts.isCallExpression(node.parent) &&
            node.parent.expression === node
          ) {
            remember({
              subject: "ambient-authority",
              path,
              line: lineOf(source, node),
              fingerprint: `locale:${node.name.text}`,
              message: `${node.name.text} reads process locale state; receive deterministic formatting data explicitly`
            });
          }

          if (ts.isAwaitExpression(node) && currentFunction) {
            if (!explicitAsyncOrigin(compiler, island, node.expression, currentFunction)) {
              remember({
                subject: "await-origin",
                path,
                line: lineOf(source, node),
                fingerprint: `await:${node.expression.getText(source).slice(0, 80)}`,
                message: "awaited work is not rooted in an explicit port or an in-island pure function"
              });
            }
          }

          if (ts.isCallExpression(node) && promiseProducing(compiler, node)) {
            const outer = node.parent;
            if (ts.isExpressionStatement(outer) || ts.isVoidExpression(outer)) {
              remember({
                subject: "detached-work",
                path,
                line: lineOf(source, node),
                fingerprint: `floating:${node.expression.getText(source).slice(0, 80)}`,
                message: "promise-producing work is neither awaited nor returned"
              });
            }
          }

          if (
            (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
            node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) &&
            ts.isCallExpression(node.parent) &&
            node.parent.arguments.includes(node)
          ) {
            remember({
              subject: "detached-work",
              path,
              line: lineOf(source, node),
              fingerprint: "async-callback",
              message: "an async callback is passed beyond the current invocation's controlled await chain"
            });
          }

          if (
            (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
            functions.length > 1 &&
            escapingFunction(node)
          ) {
            const outerParameters = new Set(functions.slice(0, -1).flatMap(({ parameters }) => [...parameters]));
            let captures = false;
            const inspect = (child) => {
              if (ts.isIdentifier(child) && outerParameters.has(rawSymbol(compiler, child))) captures = true;
              child.forEachChild(inspect);
            };
            node.forEachChild(inspect);
            if (captures) {
              remember({
                subject: "detached-work",
                path,
                line: lineOf(source, node),
                fingerprint: "escaping-closure",
                message: "a returned/passed closure captures invocation authority beyond the call boundary"
              });
            }
          }

          if (ts.isElementAccessExpression(node)) {
            const root = rootIdentifier(node.expression);
            const symbol = root ? rawSymbol(compiler, root) : null;
            const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
            const type = declaration ? compiler.checker.getTypeOfSymbolAtLocation(symbol, declaration) : null;
            if (typeContainsCallable(compiler, type)) {
              remember({
                subject: "port-introspection",
                path,
                line: lineOf(source, node),
                fingerprint: `computed:${root?.text ?? "port"}`,
                message: "computed property access can select undeclared port authority"
              });
            }
          }
          if (ts.isForInStatement(node)) {
            const root = rootIdentifier(node.expression);
            const symbol = root ? rawSymbol(compiler, root) : null;
            const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
            const type = declaration ? compiler.checker.getTypeOfSymbolAtLocation(symbol, declaration) : null;
            if (typeContainsCallable(compiler, type)) {
              remember({
                subject: "port-introspection",
                path,
                line: lineOf(source, node),
                fingerprint: `enumerate:${root?.text ?? "port"}`,
                message: "enumerating a port reveals authority outside its declared calls"
              });
            }
          }
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            ["Object", "Reflect"].includes(node.expression.expression.text) &&
            [
              "entries",
              "getOwnPropertyDescriptor",
              "getOwnPropertyDescriptors",
              "getOwnPropertyNames",
              "getOwnPropertySymbols",
              "getPrototypeOf",
              "keys",
              "ownKeys",
              "values"
            ].includes(node.expression.name.text)
          ) {
            for (const argument of node.arguments) {
              const root = rootIdentifier(argument);
              const symbol = root ? rawSymbol(compiler, root) : null;
              const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
              const type = declaration ? compiler.checker.getTypeOfSymbolAtLocation(symbol, declaration) : null;
              if (!typeContainsCallable(compiler, type)) continue;
              remember({
                subject: "port-introspection",
                path,
                line: lineOf(source, node),
                fingerprint: `reflect:${node.expression.name.text}:${root?.text ?? "port"}`,
                message: `${node.expression.getText(source)} enumerates or inspects a callable port`
              });
            }
          }
          if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) {
            const root = rootIdentifier(node.expression);
            const symbol = root ? rawSymbol(compiler, root) : null;
            const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
            const type = declaration ? compiler.checker.getTypeOfSymbolAtLocation(symbol, declaration) : null;
            if (typeContainsCallable(compiler, type)) {
              remember({
                subject: "port-introspection",
                path,
                line: lineOf(source, node),
                fingerprint: `spread:${root?.text ?? "port"}`,
                message: "spreading a port copies authority beyond its declared member calls"
              });
            }
          }
          if (
            ts.isPropertyAccessExpression(node) &&
            ["apply", "bind", "call", "constructor", "prototype", "toString"].includes(node.name.text)
          ) {
            const type = compiler.checker.getTypeAtLocation(node.expression);
            if (type.getCallSignatures().length > 0) {
              remember({
                subject: "port-introspection",
                path,
                line: lineOf(source, node),
                fingerprint: `function-member:${node.name.text}`,
                message: `${node.name.text} introspects or rebinds a callable port member`
              });
            }
          }

          node.forEachChild(visit);
          if (enteredFunction) functions.pop();
        };
        source.forEachChild(visit);

        for (const edge of moduleEdges(tree, path)) {
          if (edge.staticEdge) continue;
          remember({
            subject: "dynamic-evaluation",
            path,
            line: edge.line,
            fingerprint: `${edge.kind}:${edge.specifier ?? "computed"}`,
            message: `${edge.kind} is a dynamic authority/load boundary`
          });
        }
      }
    }
    return found;
  }
});
