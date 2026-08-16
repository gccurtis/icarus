/**
 * What the model generator needs beyond Node: the package's paths, the names
 * derived from one kebab-case object name, template rendering, the AST reads that
 * make editing an environment root safe, and a plan that either lands whole or
 * leaves the tree exactly as it found it.
 *
 * Four rules shape it. The first two are the capability generators' and are
 * repeated here because they are the reason both tools are trusted:
 *
 * 1. **Everything written already passes `pnpm lint:model`.** A generator whose
 *    output fails the standard teaches people that the standard is optional. This
 *    is why the object is added to the aggregate type and to the root's builder
 *    rather than being announced as a reminder: an object with no aggregate field
 *    is unreachable, and `graph` says so the moment it exists.
 *
 * 2. **Nothing is ever overwritten.** Every created target is checked before
 *    anything is written, so a name collision costs a message rather than
 *    someone's work.
 *
 * 3. **An existing file is edited through its AST.** Three files already on disk
 *    have to change, and two of them are TypeScript someone wrote by hand. A regex
 *    over another author's constructor is the kind of thing that works until it
 *    silently does not — so positions come from the compiler, and the text spliced
 *    at them is a line.
 *
 * 4. **The plan is proven before it is applied.** The whole result is staged into
 *    a copy of `src/` and the real rules are run over it. Only failures the tree
 *    did not already have are the generator's, which keeps the tool usable while
 *    the model directory is still being moved into place.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { RULES, discoverObjects, importsOf, resolveSpecifier, walkFiles } from "../../lint/model/rules.mjs";

/**
 * The package this generator writes into.
 *
 * Derived from this file's own location, so the script works from any working
 * directory. `ICARUS_PACKAGE_ROOT` overrides it, which is what lets the tests
 * generate into a throwaway tree and lint the result — the only check that proves
 * the generator's central claim, that what it writes already passes.
 */
export const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ??
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
export const sourceRoot = join(packageRoot, "src");
export const modelRoot = join(sourceRoot, "lib", "model");
const templatesRoot = join(packageRoot, "docs", "model-directory", "templates");

/** The environment-shaped facts, spelled the way the standard and the linter spell them. */
export const ENVIRONMENTS = ["client", "server"];
export const DOORS = { client: "index.ts", server: "index.server.ts" };
export const ROOT_CONSTRUCTORS = { client: "constructor.ts", server: "constructor.server.ts" };
export const AGGREGATES = { client: "ClientModel", server: "ServerModel" };
export const BUILDERS = { client: "buildClientModel", server: "buildServerModel" };
export const DOCUMENTS = { client: "client.md", server: "server.md" };

/** How an object is reached from outside itself. The server door carries its mark. */
export const doorSpecifier = (environment, name) =>
  environment === "server" ? `$model/server/${name}/index.server` : `$model/client/${name}`;

// -------------------------------------------------------------- arguments ----

/**
 * The arguments this command was invoked with, minus the separator pnpm leaves
 * behind.
 *
 * Every standard documents its generator as `pnpm <script> -- <args>`, and pnpm
 * forwards that `--` to the script rather than consuming it. Reading `argv`
 * directly therefore makes the one invocation anybody will copy fail on its
 * first word.
 *
 * Only a leading `--` goes. Anywhere else it is a real argument error and still
 * reported as one.
 */
export const commandArgs = () =>
  process.argv.slice(2).filter((argument, index) => !(index === 0 && argument === "--"));

// ---------------------------------------------------------------- naming ----

export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const pascal = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
export const camel = (kebab) => {
  const name = pascal(kebab);
  return name.charAt(0).toLowerCase() + name.slice(1);
};
export const title = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

// -------------------------------------------------------------- reporting ----

const problems = [];
export const fail = (path, message) => problems.push(`${path}  ${message}`);

/** Reports in the same `path  message` format lint uses, then stops. */
export const stopIfFailed = (name) => {
  if (problems.length === 0) return;
  console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee docs/model-directory/model-directory.md.");
  process.exit(1);
};

export const at = (absolute) => relative(packageRoot, absolute);

// ----------------------------------------------------------------- alias ----

/**
 * The alias map the compiler and the bundler share, and the one entry this
 * generator cannot work without.
 *
 * Every import it writes is spelled `$model/…`, matching the standard and the
 * linter's own resolution. Without the alias the scaffold neither compiles nor
 * resolves, so refusing is more useful than emitting it and letting the author
 * discover why. The generator does not edit `svelte.config.js` itself: that file
 * is a JS module with comments and nested objects, and declaring an alias is a
 * one-line paste.
 */
export const modelAliases = async () => {
  const configPath = join(packageRoot, "svelte.config.js");
  if (!existsSync(configPath)) {
    fail("svelte.config.js", "no config here — the generator resolves its aliases from it");
    return {};
  }

  const config = await import(pathToFileURL(configPath).href);
  const aliases = config.default?.kit?.alias ?? {};
  const declared = aliases.$model;

  if (declared !== "src/lib/model" && declared !== "src/lib/model/") {
    fail(
      "svelte.config.js",
      "no $model alias points at src/lib/model — every import this writes is spelled through it, so add it to kit.alias and run this again:\n" +
        '\n    alias: {\n      "$model": "src/lib/model",\n    }\n'
    );
  }
  return aliases;
};

// ------------------------------------------------------------- templates ----

const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/**
 * A placeholder key, with its internal whitespace flattened.
 *
 * Prose placeholders in these templates wrap across lines, and a key that had to
 * be written with the template's own line break in it would be a substitution
 * nobody could read or maintain.
 */
const keyOf = (inner) => inner.replace(/\s+/g, " ").trim();

/**
 * What an unsubstituted placeholder becomes.
 *
 * A one-word placeholder keeps its shape — `TODO-method-name`, not
 * `TODO: method-name` — because it usually stands in for part of a path or a link
 * target, and a space there turns a dangling link into a malformed one. Prose
 * reads better as a sentence. Both start with TODO, so one grep finds every
 * decision a generated document is still waiting on.
 */
const todo = (inner) => {
  const text = keyOf(inner).replace(/`/g, "");
  if (/\s/.test(text)) return `TODO: ${text}`;
  return text.startsWith("/") ? `/TODO-${text.slice(1)}` : `TODO-${text}`;
};

/**
 * Repeats a line once per value when its placeholder stands for a list.
 *
 * A dependency table has one row per dependency and a substitution has one value,
 * so without this the generator would either name the first dependency and lose
 * the rest, or leave a row of TODOs beside facts it already knows. An empty list
 * removes the line, which is how an object that depends on nothing gets a table
 * with no rows rather than a row saying nothing.
 */
const expandRows = (source, substitutions) =>
  source
    .split("\n")
    .flatMap((line) => {
      const [key] = [...line.matchAll(PLACEHOLDER)]
        .map((match) => keyOf(match[1]))
        .filter((candidate) => Array.isArray(substitutions[candidate]));
      if (!key) return [line];
      return substitutions[key].map((value) =>
        line.replace(PLACEHOLDER, (whole, inner) => (keyOf(inner) === key ? value : whole))
      );
    })
    .join("\n");

/** Renders a template, substituting what is known and marking what is not. */
export const render = (templateName, substitutions) => {
  const source = readFileSync(join(templatesRoot, templateName), "utf8");
  return expandRows(source, substitutions).replace(PLACEHOLDER, (_, inner) => {
    const key = keyOf(inner);
    return Object.hasOwn(substitutions, key) ? substitutions[key] : todo(inner);
  });
};

// ------------------------------------------------------------------- AST ----

export const parseModule = (path, text) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/**
 * Splices text at positions the compiler found.
 *
 * Applied last position first, so every offset still describes the text it was
 * computed against — the alternative is tracking a drift that grows with each
 * edit and is wrong exactly once.
 */
export const applyEdits = (text, edits) => {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
};

/** The indentation of the line an offset falls on, so inserted lines match their neighbours. */
export const indentAt = (text, offset) => {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  return text.slice(start, offset).match(/^\s*/)[0];
};

/**
 * Where an import line goes: sorted among the imports already there.
 *
 * Sorting keeps a growing header readable and makes two runs in different orders
 * produce the same file.
 */
export const importEdit = (file, text, line, specifier) => {
  if (text.includes(line)) return null;
  const imports = file.statements.filter(ts.isImportDeclaration);
  if (imports.length === 0) return { start: 0, end: 0, text: `${line}\n` };

  const after = imports.find(
    (node) => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text > specifier
  );
  if (after) {
    const start = after.getStart(file);
    return { start, end: start, text: `${line}\n${indentAt(text, start)}` };
  }
  const end = imports.at(-1).getEnd();
  return { start: end, end, text: `\n${line}` };
};

/** The members of `interface X` or `type X = { … }`, whichever the root declared. */
export const aggregateMembers = (file, name) => {
  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return { container: statement, members: [...statement.members] };
    }
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === name &&
      ts.isTypeLiteralNode(statement.type)
    ) {
      return { container: statement.type, members: [...statement.type.members] };
    }
  }
  return null;
};

/** `build<Environment>Model`, however it was declared, with whether it awaits. */
export const builderOf = (file, name) => {
  let node = null;
  const visit = (candidate) => {
    if (node) return;
    if (
      ts.isVariableDeclaration(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === name
    ) {
      node = candidate.initializer ?? null;
    } else if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === name) {
      node = candidate;
    }
    candidate.forEachChild(visit);
  };
  visit(file);
  if (!node) return null;

  const asynchronous = (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
  );
  return { node, asynchronous };
};

/**
 * The object literal the builder returns, and the statement it is returned from.
 *
 * Two shapes are equally readable and both appear in the standard: an arrow
 * returning a literal, and a block that names its intermediates first. The second
 * is the only one a dependency can be hoisted into, which is why the statement
 * comes back with the literal.
 */
export const returnedLiteral = (builder) => {
  const body = ts.isFunctionDeclaration(builder.node) ? builder.node.body : (builder.node.body ?? builder.node);
  const unwrapped = body && ts.isParenthesizedExpression(body) ? body.expression : body;
  if (unwrapped && ts.isObjectLiteralExpression(unwrapped)) {
    return { literal: unwrapped, returnStatement: null };
  }
  if (unwrapped && ts.isBlock(unwrapped)) {
    for (const statement of unwrapped.statements) {
      if (!ts.isReturnStatement(statement) || !statement.expression) continue;
      const returned = ts.isParenthesizedExpression(statement.expression)
        ? statement.expression.expression
        : statement.expression;
      if (ts.isObjectLiteralExpression(returned)) return { literal: returned, returnStatement: statement };
    }
  }
  return null;
};

/** A literal's properties, by the field name each one assigns. */
export const propertiesOf = (literal, file) =>
  literal.properties
    .filter((property) => property.name)
    .map((property) => ({ name: property.name.getText(file), node: property }));

// ------------------------------------------------------------ dependencies ----

/** Where inside the model tree a specifier points, as path segments. */
const modelSegments = (specifier, from, scope) => {
  const alias = specifier.replace(/^\$lib\/model/, "$model").match(/^\$model(?:\/(.*))?$/);
  if (alias) return alias[1] ? alias[1].split("/") : [];

  const resolved = resolveSpecifier(specifier, from, scope);
  if (resolved && resolved.startsWith(scope.model + sep)) {
    return relative(scope.model, resolved).split(sep);
  }
  return null;
};

/**
 * Which objects each object depends on, read from the doors its files import.
 *
 * The same reading `graph` does, and it has to be: the generator refuses a cycle
 * the linter would have refused a moment later, and the two disagreeing about what
 * a dependency is would make one of them wrong.
 */
export const dependencyGraph = (scope) => {
  const graph = new Map(discoverObjects(scope).map((object) => [object, new Set()]));
  for (const [object] of graph) {
    for (const path of walkFiles(join(scope.model, object))) {
      if (!path.endsWith(".ts")) continue;
      for (const { specifier } of importsOf(path)) {
        const segments = modelSegments(specifier, path, scope);
        if (!segments || segments.length < 2) continue;
        const target = `${segments[0]}/${segments[1]}`;
        if (target !== object && graph.has(target)) graph.get(object).add(target);
      }
    }
  }
  return graph;
};

/** The first cycle reachable from `start`, as the path that closes it, or null. */
export const cycleFrom = (graph, start) => {
  const walk = (object, trail) => {
    if (trail.includes(object)) return [...trail.slice(trail.indexOf(object)), object];
    for (const dependency of graph.get(object) ?? []) {
      const found = walk(dependency, [...trail, object]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, []);
};

// ---------------------------------------------------------------- writing ----

/** Every ancestor of a path that does not exist yet, outermost first. */
const missingAncestors = (path) => {
  const missing = [];
  let directory = dirname(path);
  while (!existsSync(directory) && directory !== dirname(directory)) {
    missing.unshift(directory);
    directory = dirname(directory);
  }
  return missing;
};

/**
 * Collects creations and edits, refuses if a created target exists, then applies
 * them together — and puts the tree back if any single write fails.
 *
 * Checking every target before writing any is what makes a collision cost a
 * message rather than half a scaffold on disk beside someone's work. The rollback
 * covers the other half: this generator touches three files it did not write, and
 * a run that stopped between them would leave an aggregate naming an object with
 * no constructor call behind it.
 */
export const planner = () => {
  const creations = [];
  const edits = new Map();

  return {
    add(path, contents) {
      if (existsSync(path)) fail(at(path), "already exists — nothing was written");
      creations.push({ path, contents });
    },

    /**
     * Queues a change to a file already on disk. Successive edits to one file see
     * each other's output, so the caller may add an import in one pass and a field
     * in the next without either reading stale text.
     */
    edit(path, transform) {
      if (!existsSync(path)) {
        fail(at(path), "does not exist — this object joins a model tree that is already here");
        return;
      }
      const entry = edits.get(path) ?? { original: readFileSync(path, "utf8"), contents: null };
      entry.contents = transform(entry.contents ?? entry.original);
      edits.set(path, entry);
    },

    /** The whole planned result, which is what lint is run against. */
    files() {
      return [
        ...creations,
        ...[...edits].map(([path, { contents }]) => ({ path, contents }))
      ];
    },

    commit() {
      const undo = [];
      const madeDirectories = [];
      try {
        for (const { path, contents } of creations) {
          for (const directory of missingAncestors(path)) {
            mkdirSync(directory);
            madeDirectories.push(directory);
          }
          writeFileSync(path, contents);
          undo.push(() => rmSync(path, { force: true }));
        }
        for (const [path, { original, contents }] of edits) {
          writeFileSync(path, contents);
          undo.push(() => writeFileSync(path, original));
        }
      } catch (error) {
        for (const restore of undo.reverse()) {
          try {
            restore();
          } catch {
            // A rollback step that cannot run must not hide the ones that can.
          }
        }
        for (const directory of madeDirectories.reverse()) {
          try {
            rmdirSync(directory);
          } catch {
            // Only directories this run created and left empty are removed.
          }
        }
        console.error(
          `new-model-object: a write failed and every byte was put back\n\n  ${error.message}`
        );
        process.exit(1);
      }
      return {
        created: creations.map(({ path }) => at(path)),
        edited: [...edits.keys()].map((path) => at(path))
      };
    }
  };
};

// ------------------------------------------------------------------- lint ----

/** Stages `src/` plus a plan into a throwaway tree, so the rules can read a result. */
const stage = (plan) => {
  const root = mkdtempSync(join(tmpdir(), "model-generation-"));
  cpSync(sourceRoot, join(root, "src"), { recursive: true });

  for (const { path, contents } of plan) {
    const target = join(root, "src", relative(sourceRoot, path));
    mkdirSync(dirname(target), { recursive: true });
    // The copy inherits modes from the tree it came from, and a read-only target
    // is the real tree's business rather than the preview's.
    rmSync(target, { force: true });
    writeFileSync(target, contents);
  }
  return root;
};

/**
 * Runs the real model rules over the planned result, and reports only what the
 * plan introduced.
 *
 * The tree is compared against itself first because the model directory is still
 * being moved into place: a generator that refused to run whenever the tree it is
 * joining had an unrelated failure would be unusable on exactly the days it is
 * most needed. Two separate staged copies rather than one edited twice — the
 * rules cache a parse per path, and a path whose contents changed under it would
 * be linted as it used to be.
 */
export const newLintFailures = (plan, aliases) => {
  const before = stage([]);
  const after = stage(plan);

  const run = (root) =>
    RULES.flatMap((rule) =>
      rule({
        model: join(root, "src", "lib", "model"),
        source: join(root, "src"),
        base: root,
        aliases: { $lib: "src/lib", $model: "src/lib/model", ...aliases }
      })
    ).map(({ path, message }) => `${path}  ${message}`);

  try {
    const existing = new Set(run(before));
    return run(after).filter((failure) => !existing.has(failure));
  } finally {
    rmSync(before, { recursive: true, force: true });
    rmSync(after, { recursive: true, force: true });
  }
};

/** Directory names directly inside an environment root, for a refusal that lists them. */
export const objectNames = (environment) => {
  const root = join(modelRoot, environment);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "test" && entry.name !== "docs")
    .map((entry) => entry.name)
    .sort();
};
