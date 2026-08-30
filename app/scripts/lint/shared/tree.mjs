/**
 * The source tree, read once and handed to every check.
 *
 * Parses and directory listings are cached on the instance: a run is one pass
 * over a tree nobody is editing, and sixty-seven checks asking the same file
 * the same question should pay for the answer once.
 *
 * Aliases come from `svelte.config.js` because that is the single map —
 * SvelteKit generates the TypeScript paths from it, so the compiler and the
 * bundler cannot disagree about where a tree is.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import { parse as parseSvelte } from "svelte/compiler";

const here = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(here, "..", "..", "..");

const RUNES = new Set(["$state", "$derived", "$effect", "$props", "$bindable", "$inspect", "$host"]);

const entriesIn = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);

/** Every file under `dir`, in a stable order so findings do not shuffle between runs. */
const walk = (dir, found = []) => {
  for (const entry of entriesIn(dir).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
};

/**
 * Import specifiers a Svelte component reaches for, read from its script blocks.
 *
 * The parser knows which text is script and which is markup, and returns line
 * numbers with it. A file that does not parse reports nothing: a syntax error is
 * the build's finding, and duplicating it makes one breakage report twice.
 */
const svelteImports = (text) => {
  let ast;
  try {
    ast = parseSvelte(text, { modern: true });
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
        names: (node.specifiers ?? []).map((s) => s.imported?.name ?? s.local?.name).filter(Boolean),
        type: node.importKind === "type"
      });
    }
  }
  return found;
};

export class Tree {
  constructor({ base, aliases }) {
    this.base = base;
    this.src = join(base, "src");
    this.lib = join(base, "src", "lib");
    this.routes = join(base, "src", "routes");
    this.aliases = aliases;
    this._text = new Map();
    this._parsed = new Map();
    this._imports = new Map();
    this._walk = new Map();
  }

  // ------------------------------------------------------------ the filesystem ----

  path(...segments) {
    return join(this.lib, ...segments);
  }

  /** Every file under a directory, absolute, sorted. */
  under(dir) {
    if (!this._walk.has(dir)) this._walk.set(dir, walk(dir));
    return this._walk.get(dir);
  }

  /** Every file under `src/`. The widest scope any check takes. */
  get files() {
    return this.under(this.src);
  }

  dirsIn(dir) {
    return entriesIn(dir)
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }

  filesIn(dir) {
    return entriesIn(dir)
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  }

  exists(path) {
    return existsSync(path);
  }

  isFile(path) {
    return existsSync(path) && statSync(path).isFile();
  }

  /** How a finding names a file: repository-relative, forward slashes, everywhere. */
  rel(path) {
    return relative(this.base, path).split(sep).join("/");
  }

  /** Whether `path` is `parent` or sits beneath it. String prefixes alone match siblings. */
  within(parent, path) {
    return path === parent || path.startsWith(parent + sep);
  }

  read(path) {
    if (!this._text.has(path)) this._text.set(path, existsSync(path) ? readFileSync(path, "utf8") : "");
    return this._text.get(path);
  }

  // ------------------------------------------------------------------ parsing ----

  /** A TypeScript source file, parsed with position information for line numbers. */
  source(path) {
    if (!this._parsed.has(path)) {
      this._parsed.set(
        path,
        ts.createSourceFile(path, this.read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      );
    }
    return this._parsed.get(path);
  }

  lineOf(path, node) {
    const file = this.source(path);
    return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  }

  /** Depth-first over every node, including nested ones — a dynamic import hides anywhere. */
  eachNode(path, visit) {
    const step = (node) => {
      visit(node);
      node.forEachChild(step);
    };
    step(this.source(path));
  }

  /**
   * Only what runs when the module is imported.
   *
   * A function body is a later moment, so a rule about module load stops at its
   * boundary. A class stops it too: a field initializer runs at construction,
   * which is the caller's business.
   */
  eachImmediate(path, visit) {
    const deferred = (node) =>
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node);
    const step = (node) =>
      node.forEachChild((child) => {
        if (deferred(child)) return;
        visit(child);
        step(child);
      });
    step(this.source(path));
  }

  /**
   * Static imports, dynamic imports, and re-exports, which reach just as far.
   *
   * The bound names come with them: which module a specifier names is one
   * question, and which of its exports the importer took is another.
   */
  imports(path) {
    if (this._imports.has(path)) return this._imports.get(path);

    let found = [];
    if (path.endsWith(".svelte")) found = svelteImports(this.read(path));
    else if (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".mjs")) {
      this.eachNode(path, (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          if (!ts.isStringLiteral(node.moduleSpecifier)) return;
          const bindings = ts.isImportDeclaration(node)
            ? node.importClause?.namedBindings
            : node.exportClause;
          const names =
            bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
              ? bindings.elements.map((element) => (element.propertyName ?? element.name).text)
              : [];
          found.push({
            specifier: node.moduleSpecifier.text,
            line: this.lineOf(path, node),
            names,
            type: ts.isImportDeclaration(node)
              ? Boolean(node.importClause?.isTypeOnly)
              : /^export\s+type\b/.test(node.getText(this.source(path)))
          });
          return;
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const [argument] = node.arguments;
          if (argument && ts.isStringLiteral(argument)) {
            found.push({ specifier: argument.text, line: this.lineOf(path, node), names: [], type: false });
          }
        }
      });
    }

    this._imports.set(path, found);
    return found;
  }

  /** Value and type names a module offers. Types are kept — some checks ask about both. */
  exports(path) {
    const names = new Set();
    if (!path.endsWith(".ts")) return names;
    const exported = (statement) =>
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    for (const statement of this.source(path).statements) {
      if (exported(statement) && ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
        }
      }
      if (exported(statement) && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))) {
        if (statement.name) names.add(statement.name.text);
      }
      if (
        exported(statement) &&
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement))
      ) {
        names.add(statement.name.text);
      }
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.add(element.name.text);
      }
    }
    return names;
  }

  /** Whether a module names a Svelte rune, which is what decides its extension. */
  declaresRunes(path) {
    if (path.endsWith(".svelte")) return true;
    if (!path.endsWith(".ts")) return false;
    let found = false;
    this.eachNode(path, (node) => {
      if (ts.isIdentifier(node) && RUNES.has(node.text)) found = true;
    });
    return found;
  }

  // --------------------------------------------------------------- resolution ----

  /**
   * A specifier's file on disk, through the same alias map the bundler shares.
   *
   * Extensions are added rather than assumed: `.../definition.svelte` is a
   * `.svelte.ts` module, and a bare tree name is a directory index.
   */
  resolve(specifier, from) {
    let target = null;
    if (specifier.startsWith(".")) target = resolve(dirname(from), specifier);
    else {
      const named = Object.entries(this.aliases)
        .sort((a, b) => b[0].length - a[0].length)
        .find(([alias]) => specifier === alias || specifier.startsWith(`${alias}/`));
      if (!named) return null;
      const [alias, mapped] = named;
      target =
        specifier === alias
          ? resolve(this.base, mapped)
          : resolve(this.base, mapped, specifier.slice(alias.length + 1));
    }

    const candidates = [
      target,
      `${target}.ts`,
      `${target}.svelte`,
      `${target}.svelte.ts`,
      target.endsWith(".js") ? `${target.slice(0, -3)}.ts` : null,
      join(target, "index.ts"),
      join(target, "index.server.ts"),
      join(target, "index.remote.ts")
    ].filter(Boolean);

    for (const candidate of candidates) if (this.isFile(candidate)) return candidate;
    return null;
  }

  /**
   * The tree a specifier names, read from the alias rather than from disk.
   *
   * The spelling is what every import in the standard uses, so reading it
   * directly means the entry rules still fire where resolution finds nothing.
   * Returns `{ tree, rest }`, or null for anything outside `src/lib`.
   */
  aliasTarget(specifier) {
    const text = specifier.startsWith("$lib/") ? `$${specifier.slice(5)}` : specifier;
    const match = text.match(/^\$([a-z-]+)(?:\/(.*))?$/);
    if (!match) return null;
    const [, tree, rest = ""] = match;
    if (!Object.prototype.hasOwnProperty.call(this.aliases, `$${tree}`)) return null;
    return { tree, rest, segments: rest ? rest.split("/") : [] };
  }
}

export const loadTree = async (base = packageRoot) => {
  const config = await import(pathToFileURL(join(base, "svelte.config.js")).href);
  const declared = config.default?.kit?.alias ?? {};
  // `$lib` is built in and so is absent from `kit.alias`, but it still has to
  // resolve on disk — it is the alias the vendored tree is reached through.
  const aliases = { $lib: config.default?.kit?.files?.lib ?? "src/lib", ...declared };
  return new Tree({ base, aliases });
};
