#!/usr/bin/env node
/**
 * Generates the view-state key vocabulary from the panel trees themselves.
 *
 *     pnpm view-state-keys
 *     pnpm view-state-keys -- --check
 *
 * A key is a path. `context/project/variables.svelte` is `"project.variables"`,
 * and `workspaces/agents/workspace-persona.svelte` is the `agents`
 * screen's `"persona"`. Nothing outside the trees gets a vote, which is what
 * makes a key naming no file a compile error rather than a blank panel — so
 * `--check`, which exits non-zero when the written file and the trees disagree,
 * is the part of this script worth putting in CI.
 *
 * There is no shared module beside this one. Everything here is either about the
 * shape of a key or about the single file that holds them, and a second consumer
 * is the thing that would justify pulling it out.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const libRoot = join(packageRoot, "src", "lib");
// The vocabulary belongs to the model object that holds the state it names. It
// sits under `methods/shared/` rather than at the object root because the model
// standard admits only a document, an index, types, a definition and a constructor
// there — and `lint:model` enforces it. Three methods and the definition read
// these, which is exactly what `shared/` is for.
const target = join(libRoot, "model", "client", "view-state", "methods", "shared", "keys.ts");

/** How the generated file tells a reader who rewrites it, and how CI checks it. */
const COMMAND = "pnpm view-state-keys";

/**
 * The arguments this command was invoked with, minus the separator pnpm leaves
 * behind.
 *
 * Every standard documents its generator as `pnpm <script> -- <args>`, and pnpm
 * forwards that `--` to the script rather than consuming it. Reading `argv`
 * directly therefore makes `pnpm view-state-keys -- --check` fail on its first
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
  console.error(`view-state-keys: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
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
  if (!existsSync(root)) fail(at(root), "no such panel tree — the vocabulary is generated from it");
  return root;
};

/**
 * Every `"<subject>.<name>"` under `context/` or `inspector/`.
 *
 * Exactly two levels, because that is what a key can express. A panel at the tree
 * root and a panel below a third directory both name nothing, so both are
 * reported rather than dropped — a file invisible to the vocabulary is the
 * failure this whole script exists to prevent.
 */
const panelKeys = (root) => {
  const keys = [];

  for (const name of panels(root)) {
    fail(at(join(root, `${name}.svelte`)), "sits at the tree root, so it names no key");
  }

  for (const subject of directories(root)) {
    const subjectRoot = join(root, subject);
    for (const nested of directories(subjectRoot)) {
      fail(at(join(subjectRoot, nested)), "is a third level, and a key is <subject>.<name>");
    }
    for (const name of panels(subjectRoot)) keys.push(`${subject}.${name}`);
  }

  return sorted(keys);
};

/** `workspace.svelte` and `workspace-<name>.svelte`, and nothing else. */
const WORKSPACE = /^workspace(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/;

/**
 * Each screen and the subscreens it can show, keyed by directory name.
 *
 * A screen with no workspace file has nothing to render, which is worth a refusal
 * here: it would otherwise generate an empty member of `SUBSCREENS` that type
 * checks and then fails at paint.
 */
const screenSubscreens = (root) => {
  const screens = new Map();

  for (const name of panels(root)) {
    fail(at(join(root, `${name}.svelte`)), "sits at the tree root, so it belongs to no screen");
  }

  for (const screen of directories(root)) {
    const screenRoot = join(root, screen);
    const subscreens = [];

    for (const name of panels(screenRoot)) {
      const match = WORKSPACE.exec(name);
      if (match === null) {
        fail(at(join(screenRoot, `${name}.svelte`)), "is not 'workspace' or 'workspace-<name>', so it names no subscreen");
        continue;
      }
      subscreens.push(match[1] ?? "workspace");
    }

    if (subscreens.length === 0) fail(at(screenRoot), "has no workspace file, so the screen has nothing to render");
    screens.set(screen, sorted(subscreens));
  }

  return screens;
};

// --------------------------------------------------------------- rendering ----

const members = (values) => values.map((value) => `  "${value}"`).join(",\n");

const vocabulary = (constant, type, values) => `export const ${constant} = [
${members(values)}
] as const;

export type ${type} = (typeof ${constant})[number];
`;

const guard = (name, constant, type) => `export const ${name} = (value: string): value is ${type} =>
  (${constant} as readonly string[]).includes(value);
`;

const file = (contexts, inspections, screens) => {
  const table = [...screens]
    .map(([screen, subscreens]) => `  "${screen}": [${subscreens.map((name) => `"${name}"`).join(", ")}]`)
    .join(",\n");

  return `/**
 * Every key the panel trees define. Generated — do not edit.
 *
 *     ${COMMAND}
 *
 * A key is a path: \`context/project/variables.svelte\` is \`"project.variables"\`,
 * and \`workspaces/agents/workspace-persona.svelte\` is the \`agents\`
 * screen's \`"persona"\`.
 *
 * \`${COMMAND} -- --check\` fails when this file and the trees
 * disagree, which is what stops a key naming something that is not there.
 */

/** Every context-panel view: one id per file under \`context/\`. */
${vocabulary("CONTEXT_IDS", "ContextId", contexts)}
/**
 * Every inspector lens: one key per file under \`inspector/\`.
 *
 * \`"empty"\` is deliberately absent. Nothing being inspected is a state of the
 * model rather than a file in the tree, so it belongs to the hand-written type
 * that unions the two.
 */
${vocabulary("INSPECTION_KEYS", "InspectionKey", inspections)}
/** Every screen: one per directory under \`workspaces/\`. */
${vocabulary("SCREENS", "Screen", [...screens.keys()])}
/**
 * What each screen can show in its centre, with the prefix its files carry
 * stripped: \`workspace.svelte\` is \`"workspace"\` and
 * \`workspace-persona.svelte\` is \`"persona"\`.
 *
 * \`as const satisfies\` rather than a plain annotation, so the members stay
 * literal — \`Subscreen\` is read back off this table — while a screen missing
 * from it still fails to compile.
 */
export const SUBSCREENS = {
${table}
} as const satisfies Record<Screen, readonly string[]>;

export type Subscreen = (typeof SUBSCREENS)[Screen][number];

${guard("isContextId", "CONTEXT_IDS", "ContextId")}
${guard("isInspectionKey", "INSPECTION_KEYS", "InspectionKey")}
${guard("isScreen", "SCREENS", "Screen")}`;
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

const contexts = panelKeys(requireTree(join(libRoot, "views", "panels", "context")));
const inspections = panelKeys(requireTree(join(libRoot, "views", "panels", "inspector")));
const screens = screenSubscreens(requireTree(join(libRoot, "views", "workspaces")));
stopIfFailed();

const contents = file(contexts, inspections, screens);
const current = existsSync(target) ? readFileSync(target, "utf8") : null;

const subscreens = [...screens.values()];
const counts = [
  `${contexts.length}  context ids`,
  `${inspections.length}  inspection keys`,
  `${screens.size}  screens`,
  `${new Set(subscreens.flat()).size}  subscreens, over ${subscreens.flat().length} workspace files`
];

if (flag === "--check") {
  if (current === contents) {
    console.log(`view-state-keys: ${at(target)} is in step with the panel trees\n`);
    for (const count of counts) console.log(`  ${count}`);
    process.exit(0);
  }

  console.error(`view-state-keys: ${at(target)} ${current === null ? "has not been generated" : "has drifted from the panel trees"}\n`);
  if (current !== null) for (const line of drift(contents, current)) console.error(`  ${line}`);
  console.error(`\nRun '${COMMAND}' to rewrite it.`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, contents);

console.log(`view-state-keys: ${current === contents ? "unchanged" : "wrote"} ${at(target)}\n`);
for (const count of counts) console.log(`  ${count}`);
