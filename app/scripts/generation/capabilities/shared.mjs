/**
 * What the capability generators have in common. No dependencies — just Node.
 *
 * Two rules shape almost every decision here:
 *
 * 1. **Everything written already passes `pnpm lint:capabilities`.** A generator
 *    whose output fails the standard teaches people that the standard is
 *    optional. This is why `new-api` appends to the doors rather than printing
 *    a reminder: the surface rule requires the door and `api/` to agree, so a
 *    directory with no export is red the moment it exists.
 *
 * 2. **Nothing is ever overwritten.** Every target is checked before anything is
 *    written, so a name collision costs a message rather than someone's work.
 *
 * A third rule follows from the standard rather than from taste: no empty
 * directory is created. The standard says an absent directory means the
 * capability has nothing for it, and a generator scattering placeholders would
 * train people to read that as noise.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The package these generators write into.
 *
 * Derived from this file's own location, so the scripts work from any working
 * directory. `ICARUS_PACKAGE_ROOT` overrides it, which is what lets the tests
 * generate into a throwaway tree and lint the result — the only check that
 * proves the generators' central claim, that what they write already passes.
 */
export const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ??
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
export const capabilitiesRoot = join(packageRoot, "src", "lib", "capabilities");
const templatesRoot = join(packageRoot, "docs", "capability-directory", "templates");

// ---------------------------------------------------------------- naming ----

export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const CAMEL = /^[a-z][A-Za-z0-9]*$/;

export const pascal = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
export const camel = (kebab) => {
  const name = pascal(kebab);
  return name.charAt(0).toLowerCase() + name.slice(1);
};
export const title = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
export const kebabOf = (camelName) =>
  camelName.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// -------------------------------------------------------------- reporting ----

const problems = [];
export const fail = (path, message) => problems.push(`${path}  ${message}`);

/** Reports in the same `path  message` format lint uses, then stops. */
export const stopIfFailed = (name) => {
  if (problems.length === 0) return;
  console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee docs/capability-directory/capability-directory.md.");
  process.exit(1);
};

export const at = (absolute) => relative(packageRoot, absolute);

// ----------------------------------------------------------------- alias ----

/**
 * The alias declared for a capability, looked up rather than derived.
 *
 * Derived would be wrong often enough to matter: a capability at
 * `data/name-manager` is `$name-manager`, not `$data-name-manager`, and a
 * guessed alias produces imports that resolve to nothing.
 *
 * The generator refuses rather than editing `svelte.config.js` itself. That
 * file is a JS module with comments and nested objects; a regex edit of it is
 * the kind of thing that works until it silently does not, and declaring an
 * alias is a one-line paste.
 */
export const aliasFor = async (capabilityPath) => {
  const configUrl = pathToFileURL(join(packageRoot, "svelte.config.js")).href;
  const config = await import(configUrl);
  const aliases = config.default?.kit?.alias ?? {};
  const target = `src/lib/capabilities/${capabilityPath}`;

  for (const [alias, declared] of Object.entries(aliases)) {
    if (declared === target || declared === `${target}/`) return alias;
  }

  const suggestion = `$${capabilityPath.split("/").pop()}`;
  fail(
    "svelte.config.js",
    `no alias points at ${target} — add it to kit.alias, then run this again:\n` +
      `\n    alias: {\n      "${suggestion}": "${target}",\n    }\n`
  );
  return suggestion;
};

// ------------------------------------------------------------- templates ----

const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/**
 * What an unsubstituted placeholder becomes.
 *
 * A one-word placeholder keeps its shape — `TODO-function-name`, not
 * `TODO: function-name` — because it usually stands in for part of a path or a
 * link target, and a space there turns a dangling link into a malformed one.
 * Prose reads better as a sentence. Both start with TODO, so one grep finds
 * every decision a generated document is still waiting on.
 */
const todo = (inner) => {
  const text = inner.replace(/`/g, "").trim();
  if (/\s/.test(text)) return `TODO: ${text}`;
  return text.startsWith("/") ? `/TODO-${text.slice(1)}` : `TODO-${text}`;
};

/** Renders a template, substituting what is known and marking what is not. */
export const render = (templateName, substitutions) => {
  const source = readFileSync(join(templatesRoot, templateName), "utf8");
  return source.replace(PLACEHOLDER, (_, inner) => {
    const key = inner.trim();
    return Object.hasOwn(substitutions, key) ? substitutions[key] : todo(inner);
  });
};

// ---------------------------------------------------------------- writing ----

/**
 * Collects writes, refuses if any target exists, then commits them together.
 *
 * Checking every target before writing any is what makes a collision cost a
 * message rather than half a scaffold on disk beside someone's work.
 */
export const planner = () => {
  const planned = [];
  return {
    add(path, contents) {
      if (existsSync(path)) fail(at(path), "already exists — nothing was written");
      planned.push({ path, contents });
    },
    commit() {
      for (const { path, contents } of planned) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, contents);
      }
      return planned.map(({ path }) => at(path));
    }
  };
};

/**
 * Appends an export line to a door, keeping the file's lines sorted.
 *
 * A door is a flat list of export lines, so this is safe in a way editing
 * `svelte.config.js` is not. Sorting keeps a growing barrel readable and makes
 * two generators run in different orders produce the same file.
 */
export const appendExport = (doorPath, line) => {
  const existing = existsSync(doorPath) ? readFileSync(doorPath, "utf8") : "";
  if (existing.includes(line)) return false;

  const lines = existing.split("\n");
  const firstExport = lines.findIndex((text) => text.startsWith("export "));

  if (firstExport === -1) {
    writeFileSync(doorPath, `${existing.trimEnd()}\n\n${line}\n`.trimStart());
    return true;
  }

  const header = lines.slice(0, firstExport);
  const exports = [...lines.slice(firstExport).filter((text) => text.trim() !== ""), line];
  exports.sort();
  writeFileSync(doorPath, [...header, ...exports, ""].join("\n"));
  return true;
};
