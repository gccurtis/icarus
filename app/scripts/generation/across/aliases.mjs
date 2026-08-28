#!/usr/bin/env node
/**
 * The alias block in `svelte.config.js`, read off the tree.
 *
 *     pnpm aliases
 *     pnpm aliases -- --check
 *
 * SvelteKit generates the TypeScript paths from that block, so it is the one map
 * the compiler and the bundler share. Writing it from the tree is what stops a
 * second map existing: an alias pointing at nothing, or a tree nothing can
 * name, both fail here rather than at the first import.
 *
 * `--check` exits non-zero when the block and the tree disagree, which is the
 * part of this worth putting in CI.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { invocation, libRoot, packageRoot, usage } from "../shared/cli.mjs";

const { positional, flags } = invocation();
if (positional.length > 0) usage("pnpm aliases [-- --check]");

const base = packageRoot(import.meta.url);
const lib = libRoot(import.meta.url);
const config = join(base, "svelte.config.js");

/**
 * Every tree gets one. `development/` is not a tree — it is a directory inside
 * `views/` and inside `components/` — so there is nothing here to leave out, and
 * an alias pointing at a development surface would be an invitation.
 */
const UNALIASED = new Set([]);

/**
 * Three trees inside `views/` are reached by name rather than through `$views`,
 * because a panel is not a view: it knows only its doors, which is what lets it
 * render in a gallery, in a test, or on a screen it was not written for.
 */
const NAMED_INSIDE_VIEWS = ["panels", "workspaces", "modals"];

const trees = readdirSync(lib, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !UNALIASED.has(entry.name))
  .map((entry) => entry.name)
  .sort();

const wanted = new Map();
for (const tree of trees) wanted.set(`$${tree}`, `src/lib/${tree}`);
for (const name of NAMED_INSIDE_VIEWS) {
  if (!existsSync(join(lib, "views", name))) continue;
  wanted.set(`$${name}`, `src/lib/views/${name}`);
}

/**
 * The block is written whole, comments included. Preserving hand-written ones
 * around generated lines would mean guessing which comment belongs to which
 * alias; carrying the reasoning here instead keeps it beside the rule that
 * produces it.
 */
const line = (alias, path) => `      ${alias}: "${path}",`;

const block = [
  "      // One alias per tree that code reaches across; `$lib` is built in.",
  "      // Generated from the tree by `pnpm aliases` — a second map is what this",
  "      // exists to prevent, and an edit here is overwritten rather than kept.",
  ...trees.map((tree) => line(`$${tree}`, `src/lib/${tree}`)),
  "",
  "      // Three trees inside views/ that are reached by name rather than through",
  "      // `$views`, because a panel is not a view: it knows only its doors, which",
  "      // is what lets it render in a gallery, in a test, or on a screen it was",
  "      // not written for.",
  ...NAMED_INSIDE_VIEWS.filter((name) => wanted.has(`$${name}`)).map((name) =>
    line(`$${name}`, `src/lib/views/${name}`)
  ),
  "",
  "      // No `$development`. It is a directory inside two trees rather than a",
  "      // tree of its own, and nothing shipped may import a development surface,",
  "      // so an alias pointing at one would be an invitation.",
  "      //",
  "      // No alias for the vendored components either: `components.json` points",
  "      // the shadcn CLI at `$lib/components/vendor`, and it rewrites those",
  "      // imports in its own files on every regeneration. That spelling is the",
  "      // one documented exception rather than a tree we forgot."
].join("\n");

const text = readFileSync(config, "utf8");
const found = text.match(/(\n {4}alias: \{\n)([\s\S]*?)(\n {4}\},)/);
if (!found) {
  console.error("aliases: no alias block in svelte.config.js to read or write");
  process.exit(1);
}

const rewritten = text.replace(found[0], `${found[1]}${block}${found[3]}`);

if (flags.has("check")) {
  if (rewritten === text) {
    console.log(`aliases: svelte.config.js names ${wanted.size} trees, and the tree agrees`);
    process.exit(0);
  }
  console.error("aliases: svelte.config.js has drifted from the tree\n");
  for (const [alias, path] of wanted) console.error(`  ${alias}  ${path}`);
  console.error("\nRun 'pnpm aliases' to rewrite it.");
  process.exit(1);
}

writeFileSync(config, rewritten);
console.log(`aliases: ${rewritten === text ? "unchanged" : "wrote"} svelte.config.js — ${wanted.size} aliases`);
