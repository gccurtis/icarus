/**
 * The view standard, machine-checked.
 *
 * See docs/view-directory/view-directory.md, whose Lint table these rules
 * implement rule for rule, and docs/view-directory/reviewing-a-view.md, whose
 * "Structure" items are the same list written for a human. What is checked here
 * is what a reviewer never has to read for.
 *
 * Exported as functions over a scope rather than run directly, so the rules can
 * be tested against deliberately-broken fixture trees. A rule with a typo'd
 * condition never fires, and a linter that never fires reports success forever.
 *
 * **Rules are named, not numbered.** A failure reads
 * `path  rule-name: message`, and the name says what was checked. The model
 * linter carried numbered codes for a while and dropped them for the same
 * reason: an identifier that is a counter tells a reader nothing, and sends them
 * to a table to find out what they broke.
 *
 * A scope is `{ views, source, base, aliases }`: the view tree, the source tree
 * that imports it, what failure paths are reported relative to, and the alias
 * map the bundler and compiler share. Fixtures supply their own, which is why
 * the rules take one instead of finding the package themselves.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import ts from "typescript";
import { parse as parseSvelte } from "svelte/compiler";

/** The five concern directories, and the extension each one's entries carry. */
const CONCERNS = {
  components: ".svelte",
  interactions: ".ts",
  effects: ".svelte.ts",
  procedures: ".ts",
  shared: null
};
/** Concerns whose entries form a tree the concern document must carry. */
const TREE_CONCERNS = ["components", "interactions", "effects", "procedures"];
const ROOT_DIRS = new Set([...Object.keys(CONCERNS), "docs", "test"]);
const TEST_DIRS = new Set(["unit", "regression", "non-functional"]);

/**
 * Names that mean a decision was avoided rather than made.
 *
 * `utils`/`helpers`/`common`/`lib` are the drawer `procedures/` exists to
 * prevent; `handlers` names events where `interactions/` names intent; `stores`,
 * `store.ts`, and `state.svelte.ts` are state with no declared lifetime. The
 * last two are required filenames in the model directory, so either one here is
 * an object with a real lifetime written inside a surface that cannot hold one.
 */
const BANNED = new Map([
  ["utils", "a named procedure belongs in procedures/"],
  ["helpers", "a named procedure belongs in procedures/"],
  ["common", "a named procedure belongs in procedures/"],
  ["lib", "a named procedure belongs in procedures/"],
  ["handlers", "interactions/ names intent, not events"],
  ["containers", "a component is a component"],
  ["stores", "state declares a lifetime — a component, shared/, or $model/client"],
  ["store.ts", "state declares a lifetime — a component, shared/, or $model/client"],
  ["state.svelte.ts", "state declares a lifetime — a component, shared/, or $model/client"],
  ["index.ts", "a view has one entry and <view>.svelte already names it"],
  ["definition.ts", "a definition is a model object; a view holds no lifetime"],
  ["constructor.ts", "a constructor is a model object; a view holds no lifetime"]
]);

const RUNES = new Set(["$state", "$derived", "$effect", "$props", "$bindable", "$inspect"]);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const entries = (dir) => readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
const dirsIn = (dir) => (existsSync(dir) ? entries(dir).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const filesIn = (dir) => (existsSync(dir) ? entries(dir).filter((e) => e.isFile()).map((e) => e.name) : []);

/** Every file under `dir`, in a stable order so failures do not shuffle between runs. */
export const walkFiles = (dir, found = []) => {
  if (!existsSync(dir)) return found;
  for (const entry of entries(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, found);
    else found.push(path);
  }
  return found;
};

/**
 * A name without its extensions. Compound extensions are checked per segment, so
 * `create-shared.svelte.ts` is the kebab-case name `create-shared`.
 */
const stem = (name) => name.split(".")[0];

/** Views are the direct children of `views/`. Nothing else is one. */
export const discoverViews = ({ views }) =>
  existsSync(views) ? dirsIn(views).map((name) => ({ name, root: join(views, name) })) : [];

const failures = (base) => {
  const list = [];
  const at = (absolute) => relative(base, absolute) || ".";
  return {
    list,
    fail: (absolute, rule, message) => list.push({ path: at(absolute), message: `${rule}: ${message}` })
  };
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

const eachNode = (node, visit) => {
  visit(node);
  node.forEachChild((child) => eachNode(child, visit));
};

/**
 * Import specifiers a Svelte component reaches for, read from its script blocks.
 *
 * `svelte/compiler` rather than a regex over `<script>`: the parser knows which
 * text is script and which is markup. A file that does not parse reports nothing
 * — a syntax error is the build's finding, and duplicating it would only make
 * the same breakage report twice.
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
      found.push({ specifier: node.source.value, line: node.source.loc?.start?.line ?? 1 });
    }
  }
  return found;
};

/** Static and dynamic imports, and re-exports, which reach just as far. */
export const importsOf = (path) => {
  if (path.endsWith(".svelte")) return svelteImports(path);
  if (!path.endsWith(".ts")) return [];

  const file = sourceFileOf(path);
  const found = [];
  eachNode(file, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        found.push({ specifier: node.moduleSpecifier.text, line: lineOf(file, node) });
      }
      return;
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) {
        found.push({ specifier: argument.text, line: lineOf(file, node) });
      }
    }
  });
  return found;
};

/** Whether a module declares Svelte runes, which decides which concern owns it. */
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
  (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^(create|build|make)[A-Z]/.test(node.expression.text));

/** A specifier's file on disk, through the same alias map the bundler and compiler share. */
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

  const candidates = [target, `${target}.ts`, `${target}.svelte`, `${target}.svelte.ts`, join(target, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

// -------------------------------------------------------- require-view-shape ----

/**
 * A view is a directory named for the two files inside it, and every name below
 * is kebab-case.
 *
 * The matching-name rule is what lets a path carry meaning: `views/shell/` holds
 * `shell.svelte`, so an import names the view twice and a rename that misses one
 * of them fails here rather than at someone's next grep.
 */
export const requireViewShape = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);
  if (!existsSync(views)) return list;

  for (const stray of filesIn(views)) {
    fail(join(views, stray), "require-view-shape", "every entry beneath views/ is a view directory");
  }

  for (const { name, root } of discoverViews(scope)) {
    if (!KEBAB.test(name)) fail(root, "require-view-shape", "view name must be kebab-case");
    for (const required of [`${name}.md`, `${name}.svelte`]) {
      if (!filesIn(root).includes(required)) {
        fail(root, "require-view-shape", `missing '${required}' — a view is named for its root component and document`);
      }
    }

    const walk = (dir) => {
      for (const entry of entries(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!KEBAB.test(entry.name)) fail(path, "require-view-shape", "directory name must be kebab-case");
          walk(path);
        } else if (!KEBAB.test(stem(entry.name))) {
          fail(path, "require-view-shape", "file name must be kebab-case");
        }
      }
    };
    walk(root);
  }

  return list;
};

// ---------------------------------------------------- restrict-root-entries ----

/**
 * A view root holds its own files and the named concerns, and no name anywhere
 * in the view is one of the ones that mean a decision was avoided.
 *
 * The banned list is checked through the whole view rather than at the root
 * only. `components/editor/utils/` is the same drawer one level down, and the
 * level is exactly what would make it feel reasonable.
 */
export const restrictRootEntries = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { name, root } of discoverViews(scope)) {
    const allowed = new Set([`${name}.md`, `${name}.svelte`, "types.ts"]);
    for (const file of filesIn(root)) {
      if (!allowed.has(file)) {
        fail(join(root, file), "restrict-root-entries", "a view root holds its document, its root component, and types.ts");
      }
    }
    for (const dir of dirsIn(root)) {
      if (!ROOT_DIRS.has(dir)) {
        fail(join(root, dir), "restrict-root-entries", `'${dir}/' is not a view concern — expected one of ${[...ROOT_DIRS].sort().join(", ")}`);
      }
    }

    const walk = (dir) => {
      for (const entry of entries(dir)) {
        const path = join(dir, entry.name);
        const reason = BANNED.get(entry.name);
        if (reason) fail(path, "restrict-root-entries", `'${entry.name}' — ${reason}`);
        if (entry.isDirectory()) walk(path);
      }
    };
    walk(root);
  }

  return list;
};

// -------------------------------------------------------- match-entry-names ----

/**
 * A directory that owns a subtree contains an entry named for it.
 *
 * The one asymmetry: procedure directories do not recurse. A capability function
 * and a model method are the execution flow behind a contract someone depends
 * on, so they earn depth; a view procedure is a display helper, and depth is how
 * it grows into the drawer `procedures/` exists to prevent.
 */
export const matchEntryNames = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    const components = join(root, "components");
    const walkComponents = (dir) => {
      for (const child of dirsIn(dir)) {
        const path = join(dir, child);
        if (child === "components") {
          walkComponents(path);
          continue;
        }
        if (!filesIn(path).includes(`${child}.svelte`)) {
          fail(path, "match-entry-names", `missing '${child}.svelte' — a component directory is named for its entry`);
        }
        for (const grandchild of dirsIn(path)) {
          if (grandchild !== "components") {
            fail(join(path, grandchild), "match-entry-names", "a component's children live beneath its components/");
          }
        }
        walkComponents(path);
      }
    };
    if (existsSync(components)) walkComponents(components);

    for (const concern of ["interactions", "effects", "procedures"]) {
      const dir = join(root, concern);
      if (!existsSync(dir)) continue;
      const extension = CONCERNS[concern];

      const walk = (parent, depth) => {
        for (const child of dirsIn(parent)) {
          const path = join(parent, child);
          if (!filesIn(path).includes(`${child}${extension}`)) {
            fail(path, "match-entry-names", `missing '${child}${extension}' — a ${concern.slice(0, -1)} directory is named for its entry`);
          }
          if (concern === "procedures" && depth >= 1) {
            fail(path, "match-entry-names", "procedure directories do not recurse — a helper with its own complexity becomes a sibling beneath procedures/");
            continue;
          }
          walk(path, depth + 1);
        }
      };
      walk(dir, 0);
    }
  }

  return list;
};

// ------------------------------------------------------- require-effect-runes ----

/**
 * The extension identifies the concern, so a reader knows which of the three a
 * file is before opening it.
 *
 * An effect owns a reactive trigger, `$effect` is a rune, and runes do not
 * compile in a plain `.ts` — so the extension is not a choice. A file under
 * `effects/` with no runes is not an effect; it is the mechanism an effect
 * drives, and it belongs in `procedures/` where the effect calls it.
 */
export const requireEffectRunes = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    for (const path of walkFiles(join(root, "effects"))) {
      if (path.endsWith(".md") || path.endsWith(".svelte.ts")) continue;
      fail(path, "require-effect-runes", "every entry beneath effects/ is '.svelte.ts' — a file with no runes is a procedure the effect calls");
    }

    for (const concern of ["interactions", "procedures"]) {
      for (const path of walkFiles(join(root, concern))) {
        if (path.endsWith(".md")) continue;
        if (path.endsWith(".svelte.ts")) {
          fail(path, "require-effect-runes", `${concern}/ holds no runes — a reactive trigger is an effect`);
          continue;
        }
        if (path.endsWith(".ts") && declaresRunes(path)) {
          fail(path, "require-effect-runes", `declares a rune — a reactive trigger belongs in effects/, not ${concern}/`);
        }
      }
    }
  }

  return list;
};

// -------------------------------------------------- require-concern-document ----

/**
 * A present concern directory explains itself, and a nested one does not repeat
 * the explanation.
 *
 * One document per concern rather than one per directory: the concern document
 * carries the complete tree, so a document per subtree would fragment the map
 * that makes the tree reviewable.
 */
export const requireConcernDocument = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    for (const concern of Object.keys(CONCERNS)) {
      const dir = join(root, concern);
      if (!existsSync(dir)) continue;

      if (!filesIn(dir).includes(`${concern}.md`)) {
        fail(dir, "require-concern-document", `missing '${concern}.md' — every concern directory explains itself`);
      }

      const walk = (parent) => {
        for (const child of dirsIn(parent)) {
          const path = join(parent, child);
          for (const file of filesIn(path)) {
            if (file.endsWith(".md")) {
              fail(join(path, file), "require-concern-document", `nested directories carry no document — ${concern}/${concern}.md owns the complete tree`);
            }
          }
          walk(path);
        }
      };
      walk(dir);
    }
  }

  return list;
};

// -------------------------------------------------- resolve-documented-paths ----

/**
 * Paths a document names exist, and files that exist are named.
 *
 * This is the rule that keeps the documents honest. A tree naming real paths
 * makes a rename that misses the document a detectable defect rather than a
 * stale comment, and the reverse direction catches the more common rot: a file
 * added by hand that no inventory ever mentions.
 *
 * Placeholders are skipped. A generated document is born full of `TODO`, and a
 * scaffold that fails the moment it is created teaches people the standard is
 * something to work around.
 */
/**
 * A path must begin with a name, optionally behind `./` or `../`, and must not
 * continue one. Without both ends pinned, prose naming an extension reads as a
 * filename: the sentence "every entry here is `.svelte.ts`" offered up
 * `svelte.ts`, and the rule then demanded a file nobody had ever mentioned.
 */
const PATH = /(?<![\w.])((?:\.{1,2}\/)*[\w-][\w./-]*\.(?:svelte\.ts|svelte|ts))\b/g;

export const documentedPaths = (source) => {
  const found = new Set();
  for (const [, path] of source.matchAll(PATH)) {
    if (path.includes("{{") || path.includes("TODO")) continue;
    found.add(path);
  }
  return [...found];
};

export const resolveDocumentedPaths = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    for (const concern of TREE_CONCERNS) {
      const dir = join(root, concern);
      const document = join(dir, `${concern}.md`);
      if (!existsSync(document)) continue;

      const source = readFileSync(document, "utf8");
      for (const path of documentedPaths(source)) {
        // Resolved from the concern directory and from the view root, because a
        // tree legitimately names both: `../procedures/x.ts` reaches a sibling
        // concern, while the tree's own first line is the view's root component.
        // Naming a real file either way is the property worth checking.
        if (existsSync(resolve(dir, path)) || existsSync(resolve(root, path))) continue;
        fail(document, "resolve-documented-paths", `names '${path}', which does not exist`);
      }

      for (const path of walkFiles(dir)) {
        if (path.endsWith(".md")) continue;
        if (source.includes(basename(path))) continue;
        fail(document, "resolve-documented-paths", `does not name '${relative(dir, path).split(sep).join("/")}' — every authored entry appears in its inventory`);
      }
    }
  }

  return list;
};

// ---------------------------------------------------------- restrict-imports ----

/**
 * What a view is allowed to reach.
 *
 * The root-only rule for other views is what makes "review one view" true, and
 * it matters more because views compose: without it a nested view's tree becomes
 * part of its parent's contract by accident, and neither can be changed alone.
 *
 * Relative imports are refused for the same reason the rest of the application
 * refuses them. A component subtree mirrors the rendered tree, so it moves when
 * the rendering changes — which is exactly when a relative path that still
 * resolves is worse than a loud break.
 */
export const restrictImports = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  const viewOf = (path) => discoverViews(scope).find(({ root }) => path === root || path.startsWith(root + sep));

  for (const { name, root } of discoverViews(scope)) {
    for (const path of walkFiles(root)) {
      if (!path.endsWith(".ts") && !path.endsWith(".svelte")) continue;
      if (path.includes(`${sep}test${sep}`)) continue;

      for (const { specifier } of importsOf(path)) {
        // Route-generated state is checked before relative paths, because its
        // canonical form `./$types` is both and "route-generated" names the
        // actual mistake — the fix is a prop, not a different specifier.
        if (/(^|\/)\$types$/.test(specifier) || specifier.includes("/routes/")) {
          fail(path, "restrict-imports", `'${specifier}' is route-generated — a route passes data through the view's public contract`);
          continue;
        }
        if (specifier.startsWith(".")) {
          fail(path, "restrict-imports", `relative import '${specifier}' — reach through $views, $model, $lib, or a capability alias`);
          continue;
        }
        if (specifier.includes(".server") || specifier.startsWith("$lib/server")) {
          fail(path, "restrict-imports", `'${specifier}' is server-only — a view reaches the browser door`);
          continue;
        }

        const target = resolveSpecifier(specifier, path, scope);
        if (!target) continue;
        const owner = viewOf(target);
        if (!owner || owner.name === name) continue;

        const permitted = [join(owner.root, `${owner.name}.svelte`), join(owner.root, "types.ts")];
        if (permitted.includes(target)) continue;
        fail(path, "restrict-imports", `reaches inside view '${owner.name}' — compose through '${owner.name}.svelte' or its types.ts`);
      }
    }
  }

  return list;
};

// ---------------------------------------------------- reject-shared-singleton ----

/**
 * `shared/` exports constructors or context accessors, never an instance.
 *
 * This is the one rule here that catches a runtime bug rather than a tidiness
 * problem. A view is a component and can be mounted more than once — a document
 * editor per open document — so an instance built at module scope is shared by
 * mounts that must not see each other. The failure is invisible until two are
 * open at once, which is why it is worth a rule instead of a review note.
 */
export const rejectSharedSingleton = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    for (const path of walkFiles(join(root, "shared"))) {
      if (!path.endsWith(".ts")) continue;
      const file = sourceFileOf(path);

      for (const statement of file.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (!declaration.initializer) continue;
          if (!isConstruction(declaration.initializer)) continue;
          const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "a value";
          fail(
            path,
            "reject-shared-singleton",
            `'${name}' is constructed at module load — shared/ exports a constructor the root calls once per mount`
          );
        }
      }
    }
  }

  return list;
};

// -------------------------------------------------------------- confine-tests ----

/** A view's tests live under its own `test/`, in one of the three categories. */
export const confineTests = (scope) => {
  const { views, base = views } = scope;
  const { list, fail } = failures(base);

  for (const { root } of discoverViews(scope)) {
    for (const path of walkFiles(root)) {
      if (!/\.(test|spec)\.[jt]s$/.test(basename(path))) continue;
      const segments = relative(root, path).split(sep);
      if (segments[0] === "test" && TEST_DIRS.has(segments[1])) continue;
      fail(path, "confine-tests", `a view's tests live in test/${[...TEST_DIRS].join(", test/")}`);
    }

    const testRoot = join(root, "test");
    if (!existsSync(testRoot)) continue;
    for (const child of dirsIn(testRoot)) {
      if (!TEST_DIRS.has(child)) {
        fail(join(testRoot, child), "confine-tests", `'${child}/' is not a test category — expected ${[...TEST_DIRS].join(", ")}`);
      }
    }
    for (const file of filesIn(testRoot)) {
      fail(join(testRoot, file), "confine-tests", "tests sit in a category directory, not beside it");
    }
  }

  return list;
};

/**
 * The rule names, in the order the standard lists them.
 *
 * Exported so the contract test can hold this list, the `fail` calls below, and
 * the table in view-directory.md to each other. A linter whose names have
 * drifted from its own documentation is worse than one with no names at all.
 */
export const RULE_NAMES = [
  "require-view-shape",
  "restrict-root-entries",
  "match-entry-names",
  "require-effect-runes",
  "require-concern-document",
  "resolve-documented-paths",
  "restrict-imports",
  "reject-shared-singleton",
  "confine-tests"
];

/** Every rule, in the order the standard lists them, so a caller cannot forget one. */
export const RULES = [
  requireViewShape,
  restrictRootEntries,
  matchEntryNames,
  requireEffectRunes,
  requireConcernDocument,
  resolveDocumentedPaths,
  restrictImports,
  rejectSharedSingleton,
  confineTests
];
