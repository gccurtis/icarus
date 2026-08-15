/**
 * What the two view generators have in common. No dependencies beyond the lint
 * rules they check their own output against.
 *
 * Three rules shape every decision here, and the first two are inherited from
 * the capability generators:
 *
 * 1. **Everything written already passes `pnpm lint:views`.** A generator whose
 *    output fails the standard teaches people that the standard is optional.
 *    This is why creating an entry also maintains its concern inventory: the
 *    documented-paths rule requires the two to agree, so an entry no document
 *    names is red the moment it exists.
 *
 * 2. **Nothing is ever overwritten.** Every target is checked before anything is
 *    written, so a name collision costs a message rather than someone's work.
 *
 * 3. **A failed write leaves nothing behind.** Writes are planned, committed
 *    together, and rolled back to their original bytes if the result does not
 *    lint — because a half-scaffolded view that fails lint is worse than no view
 *    at all, and the person who runs into it did not cause it.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RULES } from "../../lint/views/rules.mjs";

export const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
export const viewsRoot = join(packageRoot, "src", "lib", "views");
const templatesRoot = join(packageRoot, "docs", "view-directory", "templates");

/** The concerns a view can own, and the extension each one's entries carry. */
export const CONCERNS = {
  components: ".svelte",
  interactions: ".ts",
  effects: ".svelte.ts",
  procedures: ".ts",
  shared: null
};

export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const title = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

// -------------------------------------------------------------- reporting ----

const problems = [];
export const fail = (path, message) => problems.push(`${path}  ${message}`);
export const at = (absolute) => relative(packageRoot, absolute) || ".";

/** Reports in the same `path  message` format lint uses, then stops. */
export const stopIfFailed = (name) => {
  if (problems.length === 0) return;
  console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee apps/frontend/docs/view-directory/view-directory.md.");
  process.exit(1);
};

// -------------------------------------------------------------- templates ----

const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/**
 * What an unsubstituted placeholder becomes.
 *
 * A one-word placeholder keeps its shape — `TODO-name`, not `TODO: name` —
 * because it usually stands in for part of a path or a link target, and a space
 * there turns a dangling link into a malformed one. Both forms start with TODO,
 * so one grep finds every decision a generated document is still waiting on.
 */
const todo = (inner) => {
  const text = inner.replace(/`/g, "").trim();
  return /\s/.test(text) ? `TODO: ${text}` : `TODO-${text}`;
};

export const render = (templateName, view) => {
  const source = readFileSync(join(templatesRoot, templateName), "utf8");
  const substitutions = { "View Name": title(view), "view-name": view };
  return source.replace(PLACEHOLDER, (_, inner) => {
    const key = inner.trim();
    return Object.hasOwn(substitutions, key) ? substitutions[key] : todo(inner);
  });
};

// ------------------------------------------------------------- inventories ----

const START = "<!-- generated:inventory:start -->";
const END = "<!-- generated:inventory:end -->";

/**
 * Adds one entry to a concern document's generated inventory, keeping it sorted.
 *
 * Only the bounded block is rewritten, so the contracts a person wrote around it
 * are never reformatted by a generator. Sorting means two commands run in
 * different orders produce the same document.
 */
export const withInventoryEntry = (document, entryPath) => {
  const start = document.indexOf(START);
  const end = document.indexOf(END);
  if (start === -1 || end === -1) {
    return `${document.trimEnd()}\n\n## Inventory\n\n${START}\n- [\`${entryPath}\`](${entryPath})\n${END}\n`;
  }

  const line = `- [\`${entryPath}\`](${entryPath})`;
  const block = document.slice(start + START.length, end);
  const lines = block.split("\n").map((text) => text.trim()).filter((text) => text.startsWith("- "));
  if (!lines.includes(line)) lines.push(line);
  lines.sort();

  return `${document.slice(0, start + START.length)}\n${lines.join("\n")}\n${document.slice(end)}`;
};

// ---------------------------------------------------------------- writing ----

/**
 * Collects creates and edits, refuses if a created target exists, then commits
 * them together — and can put the tree back exactly as it was.
 *
 * Rollback restores edited files to their original bytes and removes both the
 * files and the directories this run brought into being. Directories are removed
 * deepest-first so a nested scaffold unwinds completely.
 */
export const planner = () => {
  const planned = [];

  return {
    create(path, contents) {
      if (existsSync(path)) fail(at(path), "already exists — nothing was written");
      planned.push({ path, contents, existed: false });
    },
    edit(path, contents) {
      planned.push({ path, contents, existed: existsSync(path), original: existsSync(path) ? readFileSync(path, "utf8") : null });
    },
    commit() {
      const madeDirs = [];
      for (const entry of planned) {
        for (let dir = dirname(entry.path); !existsSync(dir); dir = dirname(dir)) madeDirs.unshift(dir);
        mkdirSync(dirname(entry.path), { recursive: true });
        writeFileSync(entry.path, entry.contents);
      }
      this.madeDirs = madeDirs;
      return planned.map(({ path }) => at(path));
    },
    rollback() {
      for (const { path, existed, original } of planned) {
        if (existed) writeFileSync(path, original);
        else rmSync(path, { force: true });
      }
      for (const dir of [...(this.madeDirs ?? [])].reverse()) rmSync(dir, { recursive: true, force: true });
    }
  };
};

// ------------------------------------------------------------------- lint ----

/**
 * Runs the real view rules against the tree this generator just wrote.
 *
 * The rules are imported rather than shelled out to, so a fixture package is
 * checked the same way production is. This is the only check that proves the
 * generators' central claim: that what they write already passes.
 */
export const lintViews = async () => {
  let aliases = { $lib: "src/lib", $views: "src/lib/views" };
  const configPath = join(packageRoot, "svelte.config.js");
  if (existsSync(configPath)) {
    const config = await import(pathToFileURL(configPath).href);
    aliases = { ...aliases, ...(config.default?.kit?.alias ?? {}) };
  }
  const scope = { views: viewsRoot, source: join(packageRoot, "src"), base: packageRoot, aliases };
  return RULES.flatMap((rule) => rule(scope));
};

/** Commits a plan, then puts everything back if the result does not lint. */
export const commitIfClean = async (plan, name) => {
  stopIfFailed(name);
  const written = plan.commit();

  const failures = await lintViews();
  if (failures.length > 0) {
    plan.rollback();
    console.error(`${name}: the result would not pass view lint, so nothing was written\n`);
    for (const { path, message } of failures) console.error(`  ${path}  ${message}`);
    process.exit(1);
  }

  console.log(`${name}: ${written.length} file${written.length === 1 ? "" : "s"}\n`);
  for (const path of written) console.log(`  ${path}`);
  return written;
};

/** The view a command was pointed at, refused before anything is planned. */
export const requireView = (view) => {
  if (!view || !KEBAB.test(view)) {
    fail("<view>", `'${view ?? ""}' is not a kebab-case view name`);
    stopIfFailed("new-view-part");
  }
  const root = join(viewsRoot, view);
  if (!existsSync(root)) {
    fail(at(root), "no such view — run 'pnpm new-view -- <view>' first");
    stopIfFailed("new-view-part");
  }
  return root;
};
