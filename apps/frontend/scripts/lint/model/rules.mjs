/**
 * The model standard, machine-checked.
 *
 * See docs/model-directory/model-directory.md, whose Enforcement table these
 * rules implement code for code, and docs/model-directory/reviewing-a-model-object.md,
 * whose "Structure" items are the same list written for a human. What is checked
 * here is what a reviewer never has to read for.
 *
 * **Eight rules, named for what they protect.** A finding leads with its rule
 * name, so the message says what was violated without a table to look it up in —
 * capability lint has never carried codes either, and there is no reason this
 * tree should be the one place a reviewer needs a dictionary.
 *
 * Exported as functions over a scope rather than run directly, so the rules can
 * be tested against deliberately-broken fixture trees. A rule with a typo'd
 * condition never fires, and a linter that never fires reports success forever.
 *
 * **Parsed rather than matched.** The capability linter reads its source with
 * regex; this one uses the TypeScript compiler API and `svelte/compiler`, both
 * already installed. Half of these rules are not regex-shaped at all — aggregate
 * fields against what a constructor returns, a route's import graph, a dependency
 * cycle — and the other half stop lying about strings and comments once there is
 * an AST.
 *
 * A scope is `{ model, source, base, aliases }`: the model tree, the source tree
 * that imports it, what failure paths are reported relative to, and the alias map
 * the bundler and compiler share. Fixtures supply their own, which is why the
 * rules take one instead of finding the package themselves.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import ts from "typescript";
import { parse as parseSvelte } from "svelte/compiler";

const ENVIRONMENTS = ["client", "server"];
/** Directories an environment root owns itself. Neither one is an object. */
const ROOT_DIRS = new Set(["test", "docs"]);
const OBJECT_DIRS = new Set(["methods", "test", "docs"]);
const OBJECT_TEST_DIRS = new Set(["unit", "regression", "non-functional"]);
const DOORS = { client: "index.ts", server: "index.server.ts" };
const ROOT_CONSTRUCTORS = { client: "constructor.ts", server: "constructor.server.ts" };
const AGGREGATES = { client: "ClientModel", server: "ServerModel" };
const BUILDERS = { client: "buildClientModel", server: "buildServerModel" };
const DEFINITIONS = ["definition.svelte.ts", "definition.ts"];
const RUNES = new Set(["$state", "$derived", "$effect", "$props", "$bindable"]);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A directory name is kebab-case and the names built from it are not: the object
 * `browser-storage` is constructed by `createBrowserStorage` and reaches its
 * consumers as the aggregate field `browserStorage`.
 */
const pascal = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

const entries = (dir) => readdirSync(dir, { withFileTypes: true });
const dirsIn = (dir) => (existsSync(dir) ? entries(dir).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const filesIn = (dir) => (existsSync(dir) ? entries(dir).filter((e) => e.isFile()).map((e) => e.name) : []);
const within = (parent, path) => path === parent || path.startsWith(parent + sep);

/** Every file under `dir`, in a stable order so failures do not shuffle between runs. */
export const walkFiles = (dir, found = []) => {
  if (!existsSync(dir)) return found;
  for (const entry of entries(dir).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, found);
    else found.push(path);
  }
  return found;
};

// ------------------------------------------------------------------ parsing ----

/**
 * One parse per file, reused by every rule that asks.
 *
 * The cache is keyed by path and never invalidated: a lint run is one pass over
 * a tree nobody is editing, and a fixture tree is rebuilt into a fresh directory.
 */
const parsed = new Map();

const sourceFileOf = (path) => {
  if (!parsed.has(path)) {
    parsed.set(
      path,
      ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    );
  }
  return parsed.get(path);
};

const lineOf = (file, node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

/** Depth-first over every node, including nested ones — dynamic imports hide anywhere. */
const eachNode = (node, visit) => {
  visit(node);
  node.forEachChild((child) => eachNode(child, visit));
};

/**
 * A function body is a later moment, not module load, so rules about what happens
 * when a module is imported stop at its boundary. Classes stop it too: a field
 * initializer runs at construction, which is the caller's business.
 */
const isDeferred = (node) =>
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isClassDeclaration(node) ||
  ts.isClassExpression(node);

const eachImmediate = (node, visit) => {
  node.forEachChild((child) => {
    if (isDeferred(child)) return;
    visit(child);
    eachImmediate(child, visit);
  });
};

/**
 * Import specifiers a Svelte component reaches for, read from its script blocks.
 *
 * `svelte/compiler` rather than a regex over `<script>`: the parser knows which
 * text is script and which is markup, and it returns an ESTree with line numbers
 * already attached. A file that does not parse reports nothing here — a syntax
 * error is the build's finding, not this linter's, and duplicating it would only
 * make the same breakage report twice.
 */
const svelteImports = (path) => {
  let ast;
  try {
    ast = parseSvelte(readFileSync(path, "utf8"), { modern: true });
  } catch {
    return [];
  }
  const found = [];
  for (const block of [ast.instance, ast.module]) {
    for (const node of block?.content?.body ?? []) {
      if (!node.source?.value) continue;
      found.push({
        specifier: node.source.value,
        line: node.source.loc?.start?.line ?? 1,
        names: (node.specifiers ?? []).map((s) => s.imported?.name ?? s.local?.name).filter(Boolean)
      });
    }
  }
  return found;
};

/**
 * Static and dynamic imports, and re-exports, which reach just as far. The bound
 * names come with them: which module a specifier names is one question, and which
 * of its exports the importer took is another.
 */
export const importsOf = (path) => {
  if (path.endsWith(".svelte")) return svelteImports(path);
  if (!path.endsWith(".ts") && !path.endsWith(".js")) return [];

  const file = sourceFileOf(path);
  const found = [];
  eachNode(file, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) return;
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : node.exportClause;
      const names =
        bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
          ? bindings.elements.map((element) => (element.propertyName ?? element.name).text)
          : [];
      found.push({ specifier: node.moduleSpecifier.text, line: lineOf(file, node), names });
      return;
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) {
        found.push({ specifier: argument.text, line: lineOf(file, node), names: [] });
      }
    }
  });
  return found;
};

/** Value and type names a module offers. Types are kept: `lifetime` asks about both. */
export const exportsOf = (path) => {
  const names = new Set();
  if (!path.endsWith(".ts")) return names;
  const file = sourceFileOf(path);

  for (const statement of file.statements) {
    const exported = ts
      .canHaveModifiers(statement)
      ? (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      : false;

    if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
    if (exported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))) {
      if (statement.name) names.add(statement.name.text);
    }
    if (exported && (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))) {
      names.add(statement.name.text);
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text);
    }
  }
  return names;
};

/** Whether a module declares Svelte runes, which decides its extension. */
export const declaresRunes = (path) => {
  if (!path.endsWith(".ts")) return false;
  let found = false;
  eachNode(sourceFileOf(path), (node) => {
    if (ts.isIdentifier(node) && RUNES.has(node.text)) found = true;
  });
  return found;
};

const isConstruction = (node) =>
  ts.isNewExpression(node) ||
  (ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    /^(create|build)[A-Z]/.test(node.expression.text));

// --------------------------------------------------------------- resolution ----

/**
 * A specifier's file on disk, through the same alias map the bundler and compiler
 * share. Extensions are added rather than assumed: `$model/client/x/definition.svelte`
 * is a `.svelte.ts` module, and `$model/client` is a directory door.
 */
export const resolveSpecifier = (specifier, from, { base, aliases = {} }) => {
  let target = null;
  if (specifier.startsWith(".")) target = resolve(dirname(from), specifier);
  else {
    for (const [alias, mapped] of Object.entries(aliases)) {
      if (specifier === alias) target = resolve(base, mapped);
      else if (specifier.startsWith(`${alias}/`)) target = resolve(base, mapped, specifier.slice(alias.length + 1));
      if (target) break;
    }
  }
  if (!target) return null;

  const candidates = [
    target,
    `${target}.ts`,
    `${target}.svelte`,
    `${target}.svelte.ts`,
    target.endsWith(".js") ? `${target.slice(0, -3)}.ts` : null,
    join(target, "index.ts"),
    join(target, "index.server.ts")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

/**
 * Where inside the model tree a specifier points, as path segments.
 *
 * Read from the specifier first and from disk second. The alias spelling is the
 * one every import in the standard uses, and reading it directly means the door
 * rules still fire even where resolution would find nothing.
 */
const modelSegmentsOf = (specifier, from, scope) => {
  const text = specifier.replace(/^\$lib\//, "");
  const alias = text.match(/^\$?model(?:\/(.*))?$/);
  if (alias) return alias[1] ? alias[1].split("/") : [];

  const resolved = resolveSpecifier(specifier, from, scope);
  if (resolved && within(scope.model, resolved)) return relative(scope.model, resolved).split(sep);
  return null;
};

/** `client/workbench` for anything inside that object, otherwise null. */
const objectOf = (scope, path) => {
  if (!within(scope.model, path)) return null;
  const segments = relative(scope.model, path).split(sep);
  if (segments.length < 3 || !ENVIRONMENTS.includes(segments[0])) return null;
  if (ROOT_DIRS.has(segments[1])) return null;
  return `${segments[0]}/${segments[1]}`;
};

/**
 * The two files allowed to hold an instance, and the only two allowed to reach
 * `$app/*`. Everything else beneath `model/` is a leaf that borrows what it needs.
 */
const environmentDoors = ({ model }) => [
  join(model, "client", DOORS.client),
  join(model, "server", DOORS.server)
];

/**
 * Objects are the directories one level inside `client/` and `server/`.
 *
 * Position rather than shape, and that is the last structural item on the review
 * checklist: the environment roots hold their own files — `index.ts`, `types.ts`,
 * `scope.server.ts` — and are roots, not malformed objects. A missing model tree
 * returns nothing, which is what makes the linter runnable before the tree it
 * governs exists.
 */
export const discoverObjects = ({ model }) => {
  const found = [];
  for (const environment of ENVIRONMENTS) {
    for (const name of dirsIn(join(model, environment))) {
      if (ROOT_DIRS.has(name)) continue;
      found.push(`${environment}/${name}`);
    }
  }
  return found;
};

/**
 * A module SvelteKit will never send to a browser.
 *
 * `.server.` and `src/lib/server/` are SvelteKit's own marks; the whole of
 * `model/server/` is this standard's. A `.remote.ts` file is server code with a
 * client-callable name, so it may reach the server tree like any other.
 */
const isServerModule = (scope, path) => {
  const name = basename(path);
  return (
    name.includes(".server.") ||
    name.endsWith(".remote.ts") ||
    within(join(scope.source, "lib", "server"), path) ||
    within(join(scope.model, "server"), path)
  );
};

const isTestModule = (path) => /\.test\.[a-z.]*ts$/.test(basename(path));

/**
 * Test code, which the boundary rules leave alone.
 *
 * A test proves what a door hides — that two instances stay independent, that a
 * constructor releases what it acquired — so it reaches for internals on purpose,
 * and its fixtures and stubs do the same without being named `.test.ts`. Holding
 * them to the exposure rules would make the rules read as advice.
 */
const isTestCode = (path) => isTestModule(path) || path.split(sep).includes("test");

/**
 * A rule's findings, reported relative to `base` — the package root from the CLI,
 * the fixture directory from a test. `failAt` adds the line, which is only worth
 * having when the finding is about one import rather than about a whole file.
 */
const failures = (base) => {
  const at = (absolute) => relative(base, absolute) || ".";
  const list = [];
  return {
    list,
    fail: (absolute, message) => list.push({ path: at(absolute), message }),
    failAt: (absolute, line, message) => list.push({ path: `${at(absolute)}:${line}`, message })
  };
};

// ------------------------------------------------------------------- layout ----

/**
 * The documented shapes exist and nothing else does.
 *
 * Required parts, permitted directories **and files**, kebab-case names, and the
 * one extension that carries meaning: runes do not compile in a plain `.ts`, so a
 * definition declaring one must be `definition.svelte.ts`. The converse is not a
 * compile error but is the same lie — `.svelte.ts` on a definition with no
 * reactive state claims a cost the object does not pay — and a client object
 * owning no reactive state is legitimate, so the extension is required by the
 * runes and never by the environment.
 *
 * The file allowlist is what makes the first sentence true. An object root holds
 * what the object *is*: its document, its door, its types, its state, and its
 * constructor. Everything it *does* belongs in `methods/`, and anything else at
 * the root is a module nobody decided the home of.
 */
export const checkLayout = (scope) => {
  const { model, base = model } = scope;
  const { list, fail } = failures(base);
  if (!existsSync(model)) return list;

  if (!filesIn(model).includes("model.md")) {
    fail(model, "layout missing 'model.md' — the tree explains itself before its halves do");
  }

  for (const environment of ENVIRONMENTS) {
    const root = join(model, environment);
    if (!existsSync(root)) continue;
    const present = filesIn(root);
    for (const required of [`${environment}.md`, DOORS[environment], "types.ts", ROOT_CONSTRUCTORS[environment]]) {
      if (!present.includes(required)) {
        fail(root, `layout environment root is missing '${required}'`);
      }
    }
  }

  for (const object of discoverObjects(scope)) {
    const [environment, name] = object.split("/");
    const dir = join(model, object);
    const present = filesIn(dir);

    if (!present.includes(`${name}.md`)) {
      fail(dir, `layout missing document '${name}.md' — an object states its ownership and surface`);
    }
    if (!present.includes("types.ts")) {
      fail(dir, "layout missing 'types.ts' — the interface a consumer is allowed to depend on");
    }
    if (!present.includes("constructor.ts")) {
      fail(dir, `layout missing 'constructor.ts' — create${pascal(name)}() returns a fresh object`);
    }

    // The wrong door and no door are the same absence to a consumer, but only one
    // of them is worth two messages. A door named for the other environment is
    // reported as the misplacement it is, not as a missing file.
    const door = DOORS[environment];
    const other = door === "index.ts" ? "index.server.ts" : "index.ts";
    if (present.includes(other)) {
      fail(join(dir, other), `layout a ${environment} object opens through '${door}', not '${other}'`);
    } else if (!present.includes(door)) {
      fail(dir, `layout missing '${door}' — the door is the only way in from outside the object`);
    }

    const definitions = DEFINITIONS.filter((file) => present.includes(file));
    if (definitions.length === 0) {
      fail(dir, "layout missing a definition — 'definition.ts' or 'definition.svelte.ts' holds the state");
    }
    for (const file of definitions) {
      const path = join(dir, file);
      const reactive = declaresRunes(path);
      if (environment === "server" && (reactive || file === "definition.svelte.ts")) {
        fail(path, "layout a server object holds no reactive state — runes and '.svelte.ts' are client-side");
      } else if (environment === "client" && reactive && file !== "definition.svelte.ts") {
        fail(path, "layout declares runes but is named 'definition.ts' — runes do not compile in a plain .ts");
      } else if (environment === "client" && !reactive && file === "definition.svelte.ts") {
        fail(path, "layout declares no runes — a definition without reactive state is 'definition.ts'");
      }
    }

    // Both doors are permitted here so the misplacement above stays one finding.
    const allowed = new Set([`${name}.md`, "types.ts", "constructor.ts", ...DEFINITIONS, ...Object.values(DOORS)]);
    for (const file of present) {
      if (allowed.has(file)) continue;
      fail(
        join(dir, file),
        `layout unknown file '${file}' — an object root holds its document, door, types, definition, and constructor; everything it does lives in methods/`
      );
    }

    for (const child of dirsIn(dir)) {
      if (OBJECT_DIRS.has(child)) continue;
      fail(join(dir, child), `layout unknown directory '${child}' — an object root holds methods/, test/, and docs/ only`);
    }

    const methods = join(dir, "methods");
    if (existsSync(methods) && !filesIn(methods).includes("methods.md")) {
      fail(methods, "layout missing 'methods.md' — the method inventory");
    }
    const shared = join(methods, "shared");
    if (existsSync(shared) && !filesIn(shared).includes("shared.md")) {
      fail(shared, "layout missing 'shared.md' — a promoted method names the invariant it preserves");
    }
  }

  // Names are checked over the whole tree rather than per object: nothing has to
  // move for a name to be wrong. Compound extensions are checked segment by
  // segment, so `scope.server.ts` passes and `scopeServer.ts` does not.
  for (const path of walkFiles(model)) {
    const name = basename(path);
    if (!/\.(ts|md|svelte)$/.test(name)) continue;
    const segments = name.replace(/\.(ts|md|svelte)$/, "").split(".");
    if (!segments.every((segment) => KEBAB.test(segment))) {
      fail(path, "layout file name must be kebab-case");
    }
  }
  const walkDirs = (dir) => {
    for (const child of dirsIn(dir)) {
      if (!KEBAB.test(child)) fail(join(dir, child), "layout directory name must be kebab-case");
      walkDirs(join(dir, child));
    }
  };
  walkDirs(model);

  return list;
};

// -------------------------------------------------------------------- graph ----

/** The members of `interface X` or `type X = { … }`, in source order. */
const aggregateFields = (path, name) => {
  if (!existsSync(path)) return null;
  const file = sourceFileOf(path);
  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement.members.filter((m) => m.name).map((m) => m.name.getText(file));
    }
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === name &&
      ts.isTypeLiteralNode(statement.type)
    ) {
      return statement.type.members.filter((m) => m.name).map((m) => m.name.getText(file));
    }
  }
  return null;
};

/** `build<Environment>Model`, however it was declared. */
const builderOf = (path, name) => {
  if (!existsSync(path)) return null;
  const file = sourceFileOf(path);
  let node = null;
  eachNode(file, (candidate) => {
    if (node) return;
    if (ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name) {
      node = candidate.initializer ?? null;
    } else if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === name) {
      node = candidate;
    }
  });
  return node ? { file, node } : null;
};

/** Every leaf constructor the builder calls, at any depth of the expression. */
const builderCalls = (path, name) => {
  const builder = builderOf(path, name);
  if (!builder) return [];
  const calls = [];
  eachNode(builder.node, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^create[A-Z]/.test(node.expression.text)) {
      calls.push({ name: node.expression.text, line: lineOf(builder.file, node) });
    }
  });
  return calls;
};

/** The object literal `build<Environment>Model` returns, as fields and their calls. */
const builtFields = (path, name) => {
  const builder = builderOf(path, name);
  if (!builder) return null;
  const { file, node } = builder;
  let literal = null;

  // Two shapes are equally readable and both appear in the standard: an arrow
  // returning a literal, and a block that names its intermediates first.
  const body = ts.isFunctionDeclaration(node) ? node.body : (node.body ?? node);
  const unwrapped = body && ts.isParenthesizedExpression(body) ? body.expression : body;
  if (unwrapped && ts.isObjectLiteralExpression(unwrapped)) literal = unwrapped;
  else if (unwrapped && ts.isBlock(unwrapped)) {
    for (const statement of unwrapped.statements) {
      if (!ts.isReturnStatement(statement) || !statement.expression) continue;
      const returned = ts.isParenthesizedExpression(statement.expression)
        ? statement.expression.expression
        : statement.expression;
      if (ts.isObjectLiteralExpression(returned)) literal = returned;
    }
  }

  if (!literal) return null;
  return literal.properties
    .filter((property) => property.name)
    .map((property) => ({ name: property.name.getText(file), line: lineOf(file, property) }));
};

/** Which objects an object depends on, read from the doors its files import. */
const objectDependencies = (scope) => {
  const graph = new Map(discoverObjects(scope).map((object) => [object, new Set()]));
  for (const [object] of graph) {
    for (const path of walkFiles(join(scope.model, object))) {
      if (!/\.ts$/.test(path)) continue;
      for (const { specifier } of importsOf(path)) {
        const segments = modelSegmentsOf(specifier, path, scope);
        if (!segments || segments.length < 2) continue;
        const target = `${segments[0]}/${segments[1]}`;
        if (target !== object && graph.has(target)) graph.get(object).add(target);
      }
    }
  }
  return graph;
};

/**
 * The graph the root declares is the graph it builds, and it has an order.
 *
 * A field in the type that the builder never assigns is a promise nothing keeps;
 * a field the builder returns that the type does not name is invisible to every
 * consumer. Both survive typechecking when the aggregate is inferred somewhere
 * along the way, and both are found by reading two files at once — which is
 * exactly what a reviewer does not do.
 *
 * Order and cycles belong here for the same reason: a constructor receives what
 * it depends on, so assembling out of order passes whatever was in scope — usually
 * `undefined`, and only at runtime — and a cycle has no assembly order at all.
 */
export const checkGraph = (scope) => {
  const { model, base = model } = scope;
  const { list, fail, failAt } = failures(base);
  if (!existsSync(model)) return list;

  for (const environment of ENVIRONMENTS) {
    const root = join(model, environment);
    if (!existsSync(root)) continue;

    const typesPath = join(root, "types.ts");
    const constructorPath = join(root, ROOT_CONSTRUCTORS[environment]);
    const declared = aggregateFields(typesPath, AGGREGATES[environment]);
    const built = builtFields(constructorPath, BUILDERS[environment]);

    if (declared === null) {
      if (existsSync(typesPath)) {
        fail(typesPath, `graph no '${AGGREGATES[environment]}' declared — the aggregate is the contract consumers name`);
      }
      continue;
    }
    if (built === null) {
      if (existsSync(constructorPath)) {
        fail(
          constructorPath,
          `graph '${BUILDERS[environment]}' returns no object literal — the graph must be readable as a list of fields`
        );
      }
      continue;
    }

    const names = built.map((field) => field.name);
    for (const field of declared) {
      if (!names.includes(field)) {
        fail(constructorPath, `graph '${AGGREGATES[environment]}' declares '${field}', which ${BUILDERS[environment]} never assigns`);
      }
    }
    for (const field of names) {
      if (!declared.includes(field)) {
        fail(typesPath, `graph ${BUILDERS[environment]} assigns '${field}', which '${AGGREGATES[environment]}' does not declare`);
      }
    }

    const seen = new Set();
    for (const field of built) {
      if (seen.has(field.name)) {
        fail(constructorPath, `graph '${field.name}' is assigned twice — one field, one instance`);
      }
      seen.add(field.name);
    }

    // Counted over the whole builder rather than field by field: the second call
    // is rarely a second field, it is an argument — `createWorkbench(createStorage(id))`
    // beside a `storage` field, and now two objects hold one key.
    const calls = builderCalls(constructorPath, BUILDERS[environment]);
    for (const name of new Set(calls.map((call) => call.name))) {
      const repeated = calls.filter((call) => call.name === name);
      if (repeated.length > 1) {
        failAt(
          constructorPath,
          repeated[1].line,
          `graph '${name}()' is called more than once — a second call is a second instance`
        );
      }
    }

    // An object with no aggregate field is unreachable: consumers receive the
    // aggregate and select from it, so nothing can ever ask for it.
    for (const object of discoverObjects(scope)) {
      const [objectEnvironment, name] = object.split("/");
      if (objectEnvironment !== environment) continue;
      if (!declared.includes(camel(name))) {
        fail(
          join(model, object),
          `graph no '${AGGREGATES[environment]}' field named '${camel(name)}' — the object is unreachable`
        );
      }
    }
  }

  const dependencies = objectDependencies(scope);
  const state = new Map();
  const cycle = (object, trail) => {
    if (state.get(object) === "done") return;
    if (state.get(object) === "open") {
      fail(join(model, object), `graph dependency cycle: ${[...trail, object].join(" → ")}`);
      return;
    }
    state.set(object, "open");
    for (const dependency of dependencies.get(object)) cycle(dependency, [...trail, object]);
    state.set(object, "done");
  };
  for (const object of dependencies.keys()) cycle(object, []);

  for (const environment of ENVIRONMENTS) {
    const constructorPath = join(model, environment, ROOT_CONSTRUCTORS[environment]);
    const built = builtFields(constructorPath, BUILDERS[environment]);
    if (!built) continue;
    const position = new Map(built.map((field, index) => [field.name, index]));

    for (const [object, needs] of dependencies) {
      const [objectEnvironment, name] = object.split("/");
      if (objectEnvironment !== environment) continue;
      const field = camel(name);
      if (!position.has(field)) continue;

      for (const dependency of needs) {
        const dependencyField = camel(dependency.split("/")[1]);
        if (!position.has(dependencyField)) continue;
        if (position.get(dependencyField) < position.get(field)) continue;
        failAt(
          constructorPath,
          built[position.get(field)].line,
          `graph '${field}' is built before '${dependencyField}', which it depends on`
        );
      }
    }
  }

  return list;
};

// ----------------------------------------------------------------- lifetime ----

/**
 * One place builds each graph, one place holds it, and nothing else has a
 * lifetime of its own.
 *
 * Three failures, all of which typecheck and all of which behave perfectly with
 * one user:
 *
 * - **Construction at module load.** A module is imported on the server whether
 *   or not SSR is on — SvelteKit loads a route's component modules to link their
 *   CSS even when it renders only a shell — so a module-level instance is built
 *   once per process and shared by every request in it.
 * - **A second holder.** Only an environment door holds an instance, so a mutable
 *   module-scope binding anywhere else beneath `model/` is the beginning of a
 *   second graph even before anything is assigned to it. The doors are named
 *   explicitly rather than "any root file", because a `let` in `constructor.ts`
 *   is exactly the convenience cache this rule exists to stop.
 * - **A door that hands back `undefined`.** Both accessors throw, and the client
 *   one guards on `browser` first: reaching a tab's graph from the server is a
 *   different mistake from reaching it too early, and one message cannot name
 *   both.
 *
 * `$app/*` stops at the client door for the same reason the guard lives there. A
 * leaf reaching for `browser`, `page`, or `navigating` is taking its identity from
 * ambient routing rather than from the argument its constructor was handed.
 */
export const checkLifetime = (scope) => {
  const { model, source, base = model } = scope;
  const { list, fail, failAt } = failures(base);
  if (!existsSync(model)) return list;

  const doors = environmentDoors(scope);
  const clientDoor = join(model, "client", DOORS.client);

  for (const path of walkFiles(model)) {
    if (!path.endsWith(".ts") || isTestCode(path)) continue;
    const file = sourceFileOf(path);

    for (const { specifier, line } of importsOf(path)) {
      if (!/^\$app(\/|$)/.test(specifier)) continue;
      if (path === clientDoor) continue;
      failAt(
        path,
        line,
        `lifetime "${specifier}" — only the client door reaches the framework; a model object takes what it needs as a constructor argument`
      );
    }

    for (const statement of file.statements) {
      if (ts.isExpressionStatement(statement) && isConstruction(statement.expression)) {
        failAt(path, lineOf(file, statement), "lifetime constructs at module load — the environment root builds the graph");
        continue;
      }
      if (!ts.isVariableStatement(statement)) continue;

      const mutable = !(statement.declarationList.flags & ts.NodeFlags.Const);
      if (mutable && !doors.includes(path)) {
        failAt(
          path,
          lineOf(file, statement),
          "lifetime module-scope 'let'/'var' — only an environment door holds an instance"
        );
      }
      for (const declaration of statement.declarationList.declarations) {
        // A factory is a value, not a construction: `const create = () => new X()`
        // has not called anything yet, and that is the shape the standard asks for.
        if (!declaration.initializer || isDeferred(declaration.initializer)) continue;
        let constructs = isConstruction(declaration.initializer);
        eachImmediate(declaration.initializer, (node) => {
          if (isConstruction(node)) constructs = true;
        });
        if (constructs) {
          failAt(
            path,
            lineOf(file, statement),
            "lifetime constructs at module load — an object built here is shared by every request on the server"
          );
        }
      }
    }
  }

  if (!existsSync(clientDoor)) return list;

  const exported = exportsOf(clientDoor);
  for (const name of ["initClientModel", "clientModel"]) {
    if (!exported.has(name)) fail(clientDoor, `lifetime client/index.ts does not export '${name}'`);
  }

  for (const path of walkFiles(model)) {
    if (path === clientDoor || !path.endsWith(".ts")) continue;
    if (exportsOf(path).has("initClientModel")) {
      fail(path, "lifetime exports 'initClientModel' — the initializer belongs to client/index.ts alone");
    }
  }

  const file = sourceFileOf(clientDoor);
  let accessor = null;
  eachNode(file, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "clientModel") {
      accessor = node.initializer ?? null;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "clientModel") accessor = node;
  });
  if (accessor) {
    let throws = false;
    let guards = false;
    eachNode(accessor, (node) => {
      if (ts.isThrowStatement(node)) throws = true;
      if (ts.isIdentifier(node) && node.text === "browser") guards = true;
    });
    if (!throws) {
      fail(clientDoor, "lifetime clientModel() cannot throw — an uninitialized model must be reported where it is asked for");
    }
    if (!guards) {
      fail(
        clientDoor,
        "lifetime clientModel() does not guard on 'browser' — a tab's graph is unreachable from the server, and should say so"
      );
    }
  }

  for (const path of walkFiles(source ?? model)) {
    if (!/\.(ts|svelte)$/.test(path)) continue;
    if (within(model, path) || isTestCode(path) || basename(path) === "+layout.svelte") continue;
    for (const { specifier, line, names } of importsOf(path)) {
      if (!names.includes("initClientModel")) continue;
      if (modelSegmentsOf(specifier, path, scope) === null) continue;
      failAt(
        path,
        line,
        "lifetime imports initClientModel — only the layout that owns the client instance initializes it"
      );
    }
  }

  return list;
};

// -------------------------------------------------------------- environment ----

/** Every module a file reaches, transitively, through resolvable specifiers. */
const reachableFrom = (entry, scope, seen = new Set()) => {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const { specifier } of importsOf(entry)) {
    const resolved = resolveSpecifier(specifier, entry, scope);
    if (resolved && !seen.has(resolved)) reachableFrom(resolved, scope, seen);
  }
  return seen;
};

const reachesClientModel = (entry, scope) => {
  const clientRoot = join(scope.model, "client");
  for (const path of reachableFrom(entry, scope)) {
    if (within(clientRoot, path)) return true;
    // An unresolvable `$model/client` still says where it was headed, which keeps
    // the rule alive while the alias is being introduced.
    for (const { specifier } of importsOf(path)) {
      const segments = modelSegmentsOf(specifier, path, scope);
      if (segments && segments[0] === "client") return true;
    }
  }
  return false;
};

const declaresNoSsr = (path) => {
  if (!existsSync(path)) return false;
  const file = sourceFileOf(path);
  let found = false;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "ssr") continue;
      if (declaration.initializer?.kind === ts.SyntaxKind.FalseKeyword) found = true;
    }
  }
  return found;
};

/**
 * Nothing a browser can load reaches `model/server`, and nothing on the server
 * reaches `model/client`.
 *
 * Reachability rather than file naming, because naming answers the wrong
 * question. A capability's `api/get/get.ts` is server code with an ordinary name —
 * nothing in the client bundle reaches it, because the only paths to it stop at a
 * `.remote.ts` or a `.server.ts` — and a rule keyed on the name would report every
 * one of those files while missing a component that reaches the server tree
 * through two innocent-looking hops.
 *
 * The client half is the same question from the other side. The graph belongs to
 * one browser tab, so a route rendering it on the server would serve markup from
 * a model nothing initialized. `ssr = false` on an ancestor layout makes the whole
 * subtree browser-only, so the rule walks up rather than reading the route alone —
 * the reach is almost never in the route file itself, it is three components down
 * in something that looked like a leaf.
 */
const browserReachable = (scope) => {
  const reached = new Set();
  const visit = (path) => {
    if (reached.has(path)) return;
    reached.add(path);
    for (const { specifier } of importsOf(path)) {
      const resolved = resolveSpecifier(specifier, path, scope);
      if (resolved && !isServerModule(scope, resolved)) visit(resolved);
    }
  };

  for (const path of walkFiles(scope.source)) {
    const isEntry = path.endsWith(".svelte") || /^\+(page|layout|error)\.(ts|js)$/.test(basename(path));
    if (isEntry && !isServerModule(scope, path) && !isTestCode(path)) visit(path);
  }
  return reached;
};

export const checkEnvironment = (scope) => {
  const { model, source, base = model } = scope;
  const { list, fail, failAt } = failures(base);
  if (!existsSync(model)) return list;

  for (const path of browserReachable(scope)) {
    for (const { specifier, line } of importsOf(path)) {
      const segments = modelSegmentsOf(specifier, path, scope);
      if (!segments || segments[0] !== "server") continue;
      failAt(
        path,
        line,
        `environment "${specifier}" — model/server is server-only, and this module is not server-marked`
      );
    }
  }

  const routes = join(source, "routes");
  if (existsSync(routes)) {
    for (const path of walkFiles(routes)) {
      const name = basename(path);
      if (!/^\+(page|layout|error)\.(svelte|ts|js)$/.test(name)) continue;
      if (!reachesClientModel(path, scope)) continue;

      let directory = dirname(path);
      let guarded = false;
      while (within(routes, directory)) {
        if (["+layout.ts", "+layout.js"].some((file) => declaresNoSsr(join(directory, file)))) {
          guarded = true;
          break;
        }
        directory = dirname(directory);
      }
      if (!guarded) {
        fail(path, "environment reaches $model/client with no ancestor layout exporting ssr = false");
      }
    }
  }

  for (const path of walkFiles(source)) {
    if (!path.endsWith(".ts") || !isServerModule(scope, path) || isTestCode(path)) continue;
    if (within(join(model, "client"), path)) continue;
    if (reachesClientModel(path, scope)) {
      fail(path, "environment server module reaches the client model — the client graph belongs to one browser tab");
    }
  }

  return list;
};

// -------------------------------------------------------------------- doors ----

/**
 * Every boundary is crossed at its door, and a constructor is behind one.
 *
 * Outside the model tree there are three production doors — `$model/client`,
 * `$model/server/index.server`, and `$model/server/scope.server` — and they are
 * the whole of what the application is allowed to know. Inside it, an object
 * reaches another object the same way: past the door is a definition, a private
 * type, or a method, none of which the object agreed to keep stable.
 *
 * Constructors belong to this rule because reaching one is reaching around a
 * door. Application code calling `create<Object>()` builds a second instance of
 * something the aggregate already holds one of — two workbenches over one storage
 * key, and neither one wrong on its own.
 *
 * `scope.server` is a door rather than an internal file because it cannot be
 * folded behind `index.server`: it imports `serverModel` back out of the root,
 * so a value re-export would close an import cycle that `graph` then has to be
 * taught to ignore. It stays narrow — identity in, `Scope` out — and no process
 * object is reachable through it.
 *
 * An object's own files reach their own internals freely — that is what the alias
 * path is for.
 */
export const checkDoors = (scope) => {
  const { model, source, base = model } = scope;
  const { list, failAt } = failures(base);
  if (!existsSync(model)) return list;

  const objects = discoverObjects(scope);
  const doorTail = new Set(["index", "index.ts", "index.server", "index.server.ts"]);
  const scopeDoor = new Set(["scope.server", "scope.server.ts"]);

  for (const path of walkFiles(source ?? model)) {
    if (!/\.(ts|svelte)$/.test(path) || isTestCode(path)) continue;
    const importer = objectOf(scope, path);

    for (const { specifier, line } of importsOf(path)) {
      const segments = modelSegmentsOf(specifier, path, scope);
      if (segments === null) continue;

      const inside = within(model, path);
      const object = segments.length > 1 ? `${segments[0]}/${segments[1]}` : null;
      const last = segments[segments.length - 1];

      // An object's own door publishes its constructor, and the environment's
      // initializer is the only thing that may reach the builder. Everything else
      // naming one is reaching around the door that hides it.
      if (last === "constructor" || last === "constructor.server") {
        const owner = segments.length > 2 ? `${segments[0]}/${segments[1]}` : null;
        const ownedHere = owner ? importer === owner : within(join(model, segments[0]), path);
        if (!ownedHere) {
          failAt(path, line, `doors "${specifier}" — constructors are called by the environment root, not by consumers`);
          continue;
        }
      }

      if (object && objects.includes(object)) {
        if (importer === object) continue;
        const tail = segments.slice(2);
        if (tail.length === 0 || (tail.length === 1 && doorTail.has(tail[0]))) continue;
        failAt(path, line, `doors "${specifier}" reaches past the door of '${object}'`);
        continue;
      }

      // Below the model tree, an environment root's own files are ordinary
      // neighbours. Above it, only the production doors exist.
      if (inside) continue;
      const tail = segments.slice(1).join("/");
      const isProductionDoor =
        (segments[0] === "client" && (tail === "" || doorTail.has(tail))) ||
        (segments[0] === "server" && (doorTail.has(tail) || scopeDoor.has(tail)));
      if (!isProductionDoor) {
        failAt(
          path,
          line,
          `doors "${specifier}" — the production doors are $model/client, ` +
            `$model/server/index.server, and $model/server/scope.server`
        );
      }
    }
  }

  return list;
};

// ------------------------------------------------------------------ methods ----

/**
 * Paths named in a method document's tree.
 *
 * The tree is also the directory layout, so a rename that does not update the tree
 * is a detectable defect rather than a stale comment. Only tokens ending in `.ts`
 * are read as paths; prose and branch markers in the tree are ignored, and so are
 * both spellings of an undecided step — `{{placeholder}}` in a template and the
 * `TODO` a generator leaves. A step nobody has committed to is not a dangling
 * reference, and demanding a file for it would mean every scaffold is born
 * failing.
 *
 * The capability linter carries the same parser for its procedure trees, and the
 * two are deliberately kept apart: one linter breaking the other's tests is a
 * worse coupling than fifteen lines said twice. A document is text, so this is the
 * one place with no AST to read.
 */
export const methodTreePaths = (source) => {
  const heading = source.search(/^##\s+Method Tree\b/m);
  if (heading === -1) return [];
  const fence = source.slice(heading).match(/```[a-z]*\n([\s\S]*?)```/);
  if (!fence) return [];
  const paths = [];
  for (const line of fence[1].split("\n")) {
    for (const [, path] of line.matchAll(/([\w./-]+\.ts)\b/g)) {
      if (path.includes("{{") || path.includes("TODO")) continue;
      paths.push(path);
    }
  }
  return paths;
};

/** The method a file belongs to: the first segment below `methods/`. */
const methodOf = (methods, path) => {
  const segments = relative(methods, path).split(sep);
  return segments[0].replace(/\.ts$/, "");
};

/**
 * A method directory is named for its entry, its documented tree resolves, and
 * its supporting flow belongs to it.
 *
 * `shared/` is the one directory with no entry file: it is a bag of promoted
 * methods, not a method. A document is required at the top level only — a
 * supporting directory deeper down is already named, path by path, in the tree
 * above it.
 *
 * One method directory importing another's internals makes a private step part of
 * a second method's contract, and the next change to it breaks a caller nobody
 * knew about. The escape is `methods/shared/`, and it is deliberately narrow:
 * promotion is a claim that a method preserves an object-wide invariant, so a
 * shared method with one caller is code that was moved away from its owner for
 * convenience.
 */
export const checkMethods = (scope) => {
  const { model, base = model } = scope;
  const { list, fail, failAt } = failures(base);

  const walk = (dir, depth) => {
    for (const name of dirsIn(dir)) {
      const child = join(dir, name);
      if (name !== "shared") {
        if (!filesIn(child).includes(`${name}.ts`)) {
          fail(child, `methods missing entry file '${name}.ts' — a method directory is named for its entry`);
        }
        if (depth === 0 && !filesIn(child).includes(`${name}.md`)) {
          fail(child, `methods missing document '${name}.md' — a method that earned a directory explains its flow`);
        }
      }
      walk(child, depth + 1);
    }

    for (const name of filesIn(dir)) {
      if (!name.endsWith(".md")) continue;
      const document = join(dir, name);
      for (const named of methodTreePaths(readFileSync(document, "utf8"))) {
        if (existsSync(resolve(dir, named))) continue;
        fail(document, `methods tree names '${named}', which does not exist`);
      }
    }
  };

  for (const object of discoverObjects(scope)) {
    const methods = join(model, object, "methods");
    if (!existsSync(methods)) continue;
    walk(methods, 0);

    const callers = new Map();
    for (const path of walkFiles(methods)) {
      if (!path.endsWith(".ts")) continue;
      const owner = methodOf(methods, path);

      for (const { specifier, line } of importsOf(path)) {
        // Only this object's own methods are in question here. A specifier naming
        // another object's internals is `doors`' finding, and reporting it twice
        // would make one defect look like two.
        const target = resolveSpecifier(specifier, path, scope);
        if (!target || !within(methods, target)) continue;

        const targetOwner = methodOf(methods, target);
        if (targetOwner === "shared") {
          if (owner === "shared") continue;
          if (!callers.has(target)) callers.set(target, new Set());
          callers.get(target).add(owner);
          continue;
        }
        if (targetOwner !== owner) {
          failAt(
            path,
            line,
            `methods imports '${targetOwner}' — a step two methods need moves to methods/shared/, it is not borrowed`
          );
        }
      }
    }

    const shared = join(methods, "shared");
    for (const path of walkFiles(shared)) {
      if (!path.endsWith(".ts")) continue;
      const found = callers.get(path)?.size ?? 0;
      if (found < 2) {
        fail(
          path,
          `methods promoted with ${found} caller${found === 1 ? "" : "s"} — shared/ holds invariants two methods share`
        );
      }
    }
  }

  return list;
};

// -------------------------------------------------------------------- tests ----

/**
 * A test sits under the `test/` of what it covers, and is named for what it needs.
 *
 * Beside the code, a test is invisible to a reviewer counting coverage of a method
 * tree and is swept up by the next move of the file it sits next to. Under an
 * object, the three directories are a claim about what kind of proof it is:
 * `unit/` mirrors methods, `regression/` holds one fixed defect per file, and
 * `non-functional/` covers the behaviour the object's documents promise.
 *
 * The extension carries the same meaning it does on a definition — a test file
 * declaring runes must be `.svelte.test.ts`, or the runes never compile.
 */
export const checkTests = (scope) => {
  const { model, base = model } = scope;
  const { list, fail } = failures(base);

  for (const path of walkFiles(model)) {
    if (!isTestModule(path)) continue;
    const segments = relative(model, path).split(sep);
    const index = segments.indexOf("test");

    if (index === -1) {
      fail(path, "tests a test belongs under the object's test/, not beside the code it covers");
      continue;
    }
    if (objectOf(scope, path) && !OBJECT_TEST_DIRS.has(segments[index + 1] ?? "")) {
      fail(path, "tests an object's tests are unit/, regression/, or non-functional/");
    }
    if (declaresRunes(path) && !basename(path).endsWith(".svelte.test.ts")) {
      fail(path, "tests declares runes but is not named '.svelte.test.ts' — runes do not compile in a plain .ts");
    }
  }

  return list;
};

// ---------------------------------------------------------------- view-keys ----

/**
 * No component reaches a model type.
 *
 * A component in the model points the dependency backwards: views are downstream
 * of the model, and a type naming a component can only be satisfied by importing
 * one — which drags the DOM into every test of the object that owns it. The model
 * exposes stable keys, and `src/lib/views/` resolves a key to a component.
 *
 * Three spellings, because the crude one is not the one that survives review: a
 * `.svelte` file in the tree, an import of a component, and a `Component` type
 * annotation on a field that looks like data.
 */
export const checkViewKeys = (scope) => {
  const { model, base = model } = scope;
  const { list, fail, failAt } = failures(base);

  for (const path of walkFiles(model)) {
    if (path.endsWith(".svelte")) {
      fail(path, "view-keys a component under model/ — objects expose keys, and views resolve them");
      continue;
    }
    if (!path.endsWith(".ts")) continue;

    for (const { specifier, line } of importsOf(path)) {
      // `…/definition.svelte` names a `.svelte.ts` module, not a component, and
      // the two are told apart by what the specifier actually resolves to. A
      // specifier resolving to nothing is the build's finding, not this one's.
      const resolved = resolveSpecifier(specifier, path, scope);
      if (resolved?.endsWith(".svelte")) {
        failAt(path, line, `view-keys "${specifier}" — a model module cannot import a component`);
      }
      if (specifier === "svelte") {
        const file = sourceFileOf(path);
        eachNode(file, (node) => {
          if (!ts.isImportSpecifier(node)) return;
          if (!["Component", "ComponentType", "SvelteComponent"].includes(node.propertyName?.text ?? node.name.text)) return;
          failAt(path, lineOf(file, node), "view-keys imports Svelte's Component type — a model type names keys, not components");
        });
      }
    }

    const file = sourceFileOf(path);
    eachNode(file, (node) => {
      if (!ts.isTypeReferenceNode(node)) return;
      const name = node.typeName.getText(file);
      if (!/^(Component|ComponentType|SvelteComponent)\b/.test(name)) return;
      failAt(path, lineOf(file, node), `view-keys type '${name}' in a model module — expose a stable key instead`);
    });
  }

  return list;
};

/** Every rule, in code order, so a caller cannot forget one. */
export const RULES = [
  checkLayout,
  checkGraph,
  checkLifetime,
  checkEnvironment,
  checkDoors,
  checkMethods,
  checkTests,
  checkViewKeys
];
