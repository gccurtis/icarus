#!/usr/bin/env node
/**
 * The alias block in `svelte.config.js`, read off the tree.
 *
 *     pnpm aliases
 *     pnpm aliases -- --check
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { invocation, libRoot, packageRoot, usage } from "../shared/cli.mjs";

const { positional, flags } = invocation();
if (positional.length > 0) usage("pnpm aliases [-- --check]");

const base = packageRoot(import.meta.url);
const lib = libRoot(import.meta.url);
const config = join(base, "svelte.config.js");

/** Trees whose subdirectories hold the variety; the alias names the subdirectory. */
const SPLIT = { components: (name) => `$${name}-components` };

const subdirectories = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const wanted = new Map();
const groups = [];

for (const tree of subdirectories(lib)) {
  const split = SPLIT[tree];
  if (!split) {
    wanted.set(`$${tree}`, `src/lib/${tree}`);
    continue;
  }
  const group = [];
  for (const name of subdirectories(join(lib, tree))) {
    wanted.set(split(name), `src/lib/${tree}/${name}`);
    group.push(split(name));
  }
  groups.push(group);
}

const line = (alias) => `      "${alias}": "${wanted.get(alias)}",`;
const plain = [...wanted.keys()].filter((alias) => !groups.flat().includes(alias));

const block = [
  ...plain.sort().map(line),
  ...groups.flatMap((group) => ["", ...group.map(line)])
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
