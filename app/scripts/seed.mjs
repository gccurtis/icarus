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
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(packageRoot, "seed");
const to = join(packageRoot, "data");

export const seedStore = ({ from, to, force = false }) => {
  if (!existsSync(from)) throw new Error(`seed: no ${from} to copy`);
  mkdirSync(to, { recursive: true });

  const fixtures = readdirSync(from).filter((file) => file.endsWith(".json")).sort();
  const fixtureSet = new Set(fixtures);
  const removed = [];
  if (force) {
    for (const file of readdirSync(to).filter((name) => name.endsWith(".json")).sort()) {
      if (fixtureSet.has(file)) continue;
      unlinkSync(join(to, file));
      removed.push(file);
    }
  }

  const written = [];
  const kept = [];
  for (const file of fixtures) {
    const target = join(to, file);
    if (existsSync(target) && !force) kept.push(file);
    else {
      copyFileSync(join(from, file), target);
      written.push(file);
    }
  }
  return { written, kept, removed };
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.slice(2).some((argument) => argument === "--force");
  try {
    const result = seedStore({ from, to, force });
    console.log(`seed: wrote ${result.written.length} table(s) into data/`);
    for (const file of result.written) console.log(`  ${file.slice(0, -".json".length)}`);
    if (result.removed.length > 0) {
      console.log(`\n  ${result.removed.length} non-fixture table(s) cleared by the forced reset.`);
    }
    if (result.kept.length > 0) {
      console.log(`\n  ${result.kept.length} already there, left alone. 'pnpm seed -- --force' performs a complete reset.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
