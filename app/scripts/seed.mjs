#!/usr/bin/env node
/**
 * Copies the committed seed into the store the server actually reads.
 *
 *     pnpm seed
 *     pnpm seed -- --force
 *
 * Two directories because they answer to different owners. `seed/` is checked in
 * and never written to; `data/` is git-ignored and is written on every create,
 * update and remove the application performs. Pointing the store at the committed
 * copy would mean opening a tab dirties the working tree.
 *
 * A table already in `data/` is left alone unless `--force` says otherwise, so
 * re-running this never silently discards what somebody has been doing.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(packageRoot, "seed");
const to = join(packageRoot, "data");

const force = process.argv.slice(2).some((argument) => argument === "--force");

if (!existsSync(from)) {
  console.error(`seed: no ${from} to copy`);
  process.exit(1);
}

mkdirSync(to, { recursive: true });

const written = [];
const kept = [];

for (const file of readdirSync(from).sort()) {
  if (!file.endsWith(".json")) continue;
  const target = join(to, file);
  if (existsSync(target) && !force) {
    kept.push(file);
    continue;
  }
  copyFileSync(join(from, file), target);
  written.push(file);
}

console.log(`seed: wrote ${written.length} table(s) into data/`);
for (const file of written) console.log(`  ${file.slice(0, -".json".length)}`);

if (kept.length > 0) {
  console.log(`\n  ${kept.length} already there, left alone. 'pnpm seed -- --force' overwrites.`);
}
