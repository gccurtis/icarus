#!/usr/bin/env node
/**
 * Generates the category vocabulary from the workspace tree itself.
 *
 *     pnpm category-keys
 *     pnpm category-keys -- --check
 *
 * A category is a directory and a subscreen is a file:
 * `workspaces/agents/workspace-persona.svelte` is the `agents` category's
 * `"persona"`. Nothing outside the tree gets a vote, so `--check`, which exits
 * non-zero when a written file and the tree disagree, is the part of this
 * script worth putting in CI.
 *
 * Two files, because `representation/` splits on what a file emits: the unions
 * belong under `data/types/`, which compiles to nothing, and the lists, the
 * table and the guard belong under `data/behavior/`, which is where a runtime
 * value over them is allowed to live.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const libRoot = join(packageRoot, "src", "lib");

const targets = {
  types: join(libRoot, "representation", "data", "types", "workspace", "categories.ts"),
  behavior: join(libRoot, "representation", "data", "behavior", "workspace", "categories.ts")
};

/** How a generated file tells a reader who rewrites it, and how CI checks it. */
const COMMAND = "pnpm category-keys";

/**
 * The arguments this command was invoked with, minus the separator pnpm leaves
 * behind.
 *
 * Every standard documents its generator as `pnpm <script> -- <args>`, and pnpm
 * forwards that `--` to the script rather than consuming it. Reading `argv`
 * directly therefore makes `pnpm category-keys -- --check` fail on its first
 * word — the one invocation anybody will copy.
 */
const commandArgs = () =>
  process.argv.slice(2).filter((argument, index) => !(index === 0 && argument === "--"));

// -------------------------------------------------------------- reporting ----

const problems = [];
const fail = (path, message) => problems.push(`${path}  ${message}`);
const at = (absolute) => relative(packageRoot, absolute) || ".";

/** Reports in the same `path  message` format lint uses, then stops. */
const stopIfFailed = () => {
  if (problems.length === 0) return;
  console.error(`category-keys: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nRun `pnpm lint panels` for what the tree is expected to look like.");
  process.exit(1);
};

// ----------------------------------------------------------------- walking ----

const listing = (root) => (existsSync(root) ? readdirSync(root, { withFileTypes: true }) : []);

/**
 * Sorted by code unit rather than `localeCompare`, so the bytes this writes do
 * not depend on the locale the machine happens to run under.
 */
const sorted = (values) => [...values].sort();

const directories = (root) => sorted(listing(root).filter((entry) => entry.isDirectory()).map((entry) => entry.name));

const panels = (root) =>
  sorted(
    listing(root)
      .filter((entry) => entry.isFile() && entry.name.endsWith(".svelte"))
      .map((entry) => entry.name.slice(0, -".svelte".length))
  );

/** A tree the vocabulary is read from has to be there to read. */
const requireTree = (root) => {
  if (!existsSync(root)) fail(at(root), "no such tree — the vocabulary is generated from it");
  return root;
};

/** `workspace.svelte` and `workspace-<name>.svelte`, and nothing else. */
const WORKSPACE = /^workspace(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/;

/**
 * Each category and the subscreens it can show, keyed by directory name.
 *
 * A category with no workspace file has nothing to render, which is worth a
 * refusal here: it would otherwise generate an empty member of `SUBSCREENS` that
 * type checks and then fails at paint.
 */
const categorySubscreens = (root) => {
  const categories = new Map();

  for (const name of panels(root)) {
    fail(at(join(root, `${name}.svelte`)), "sits at the tree root, so it belongs to no category");
  }

  for (const category of directories(root)) {
    const categoryRoot = join(root, category);
    const subscreens = [];

    for (const name of panels(categoryRoot)) {
      const match = WORKSPACE.exec(name);
      if (match === null) {
        fail(at(join(categoryRoot, `${name}.svelte`)), "is not 'workspace' or 'workspace-<name>', so it names no subscreen");
        continue;
      }
      subscreens.push(match[1] ?? "workspace");
    }

    if (subscreens.length === 0) fail(at(categoryRoot), "has no workspace file, so the category has nothing to render");
    categories.set(category, sorted(subscreens));
  }

  return categories;
};

// --------------------------------------------------------------- rendering ----

const banner = () => `// Every category the workspace tree defines. Generated — do not edit.
//
//     ${COMMAND}
//
// \`${COMMAND} -- --check\` fails when a file and the tree disagree,
// which is what stops a category naming something that is not there.
`;

const union = (name, values) => `export type ${name} =
${values.map((value) => `  | "${value}"`).join("\n")};
`;

const typesFile = (categories) => {
  const subscreens = sorted(new Set([...categories.values()].flat()));
  return `${banner()}
${union("Category", [...categories.keys()])}
${union("Subscreen", subscreens)}`;
};

const behaviorFile = (categories) => {
  const members = [...categories.keys()].map((category) => `  "${category}"`).join(",\n");
  const table = [...categories]
    .map(([category, subscreens]) => `  "${category}": [${subscreens.map((name) => `"${name}"`).join(", ")}]`)
    .join(",\n");

  return `${banner()}import type { Category, Subscreen } from "$representation/data/types/workspace/categories";

export const CATEGORIES = [
${members}
] as const satisfies readonly Category[];

export const SUBSCREENS = {
${table}
} as const satisfies Record<Category, readonly Subscreen[]>;

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);
`;
};

// ------------------------------------------------------------------- drift ----

const DRIFT_SHOWN = 20;

/**
 * What a stale file and the trees disagree about, as lines.
 *
 * A line comparison rather than a parse of the file: it is one key per line, so
 * the difference between the two line sets *is* the drifted keys, and nothing
 * here has to understand TypeScript to name them.
 */
const drift = (wanted, written) => {
  const [want, have] = [wanted, written].map((text) => new Set(text.split("\n")));
  const only = (from, to, mark) =>
    [...from].filter((line) => line.trim() !== "" && !to.has(line)).map((line) => `${mark} ${line.trim()}`);

  const lines = [...only(want, have, "+"), ...only(have, want, "-")];
  return lines.length > DRIFT_SHOWN
    ? [...lines.slice(0, DRIFT_SHOWN), `… and ${lines.length - DRIFT_SHOWN} more`]
    : lines;
};

// ------------------------------------------------------------------- run ----

const [flag, ...rest] = commandArgs();
if ((flag !== undefined && flag !== "--check") || rest.length > 0) {
  fail("<options>", `'${[flag, ...rest].join(" ")}' is not understood — the only option is --check`);
  stopIfFailed();
}

const categories = categorySubscreens(requireTree(join(libRoot, "views", "workspaces")));
stopIfFailed();

const wanted = [
  { target: targets.types, contents: typesFile(categories) },
  { target: targets.behavior, contents: behaviorFile(categories) }
];

const subscreens = [...categories.values()];
const counts = [
  `${categories.size}  categories`,
  `${new Set(subscreens.flat()).size}  subscreens, over ${subscreens.flat().length} workspace files`
];

if (flag === "--check") {
  const stale = wanted.filter(
    ({ target, contents }) => (existsSync(target) ? readFileSync(target, "utf8") : null) !== contents
  );

  if (stale.length === 0) {
    console.log(`category-keys: ${wanted.map(({ target }) => at(target)).join(", ")} in step with the workspace tree\n`);
    for (const count of counts) console.log(`  ${count}`);
    process.exit(0);
  }

  console.error("category-keys:\n");
  for (const { target, contents } of stale) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    console.error(`  ${at(target)} ${current === null ? "has not been generated" : "has drifted from the workspace tree"}`);
    if (current !== null) for (const line of drift(contents, current)) console.error(`    ${line}`);
  }
  console.error(`\nRun '${COMMAND}' to rewrite it.`);
  process.exit(1);
}

const written = [];
for (const { target, contents } of wanted) {
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  written.push(`${current === contents ? "unchanged" : "wrote"} ${at(target)}`);
}

console.log(`category-keys: ${written.join(", ")}\n`);
for (const count of counts) console.log(`  ${count}`);
