#!/usr/bin/env node
/**
 * Every check, run against `src/`.
 *
 * A check is a file under `scripts/lint/<tree>/`, named for the invariant it
 * holds. Adding a check is adding a file — there is no register to update, so a
 * check cannot exist and be unrun.
 *
 *     pnpm lint                    everything
 *     pnpm lint surfaces views     one tree, or several
 *     pnpm lint surface-imports    one check, wherever it lives
 *     pnpm lint --all              name the clean checks too
 *
 * Exit is 1 when anything failed, so this is the same command in CI.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadTree } from "./lint/shared/tree.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const lintRoot = join(here, "lint");

/** Reading order: the definitional trees, then what runs, then what crosses them all. */
const TREES = [
  "capabilities",
  "components",
  "model",
  "representation",
  "runtime",
  "styles",
  "surfaces",
  "views",
  "across"
];

const argv = process.argv.slice(2);
const showAll = argv.includes("--all");
const filters = argv.filter((argument) => !argument.startsWith("--"));

const loadChecks = async (tree) => {
  const dir = join(lintRoot, tree);
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  const loaded = [];
  for (const name of names) {
    const module = await import(pathToFileURL(join(dir, name)).href);
    const definition = module.default;
    if (!definition?.name) throw new Error(`${tree}/${name}: no check exported`);
    if (definition.name !== name.replace(/\.mjs$/, "")) {
      throw new Error(`${tree}/${name}: is named "${definition.name}"`);
    }
    loaded.push(definition);
  }
  return loaded;
};

const matches = (tree, definition) =>
  filters.length === 0 || filters.includes(tree) || filters.includes(definition.name);

const tree = await loadTree();

let checked = 0;
let clean = 0;
let findings = 0;
const broken = [];

for (const treeName of TREES) {
  const checks = (await loadChecks(treeName)).filter((definition) => matches(treeName, definition));
  if (checks.length === 0) continue;

  const lines = [];
  for (const definition of checks) {
    checked += 1;
    let found;
    try {
      found = await definition.run(tree);
    } catch (error) {
      broken.push(`${treeName}/${definition.name}: ${error.message}`);
      continue;
    }

    if (found.length === 0) {
      clean += 1;
      if (showAll) lines.push(`  ok   ${definition.name}`);
      continue;
    }

    findings += found.length;
    const bySubject = new Map();
    for (const failure of found) {
      const key = failure.subject ?? "";
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key).push(failure);
    }

    for (const [subject, group] of bySubject) {
      const title = subject ? `${definition.name} · ${subject}` : definition.name;
      lines.push(`  FAIL ${title}  (${group.length})`);
      for (const failure of group) {
        const where = tree.rel(failure.path) + (failure.line ? `:${failure.line}` : "");
        lines.push(`         ${where}  ${failure.message}`);
      }
    }
  }

  if (lines.length > 0) {
    console.log(`\n${treeName}`);
    for (const line of lines) console.log(line);
  }
}

if (broken.length > 0) {
  console.error("\nchecks that could not run:");
  for (const line of broken) console.error(`  ${line}`);
}

const failed = checked - clean - broken.length;
console.log(
  `\n${checked} check${checked === 1 ? "" : "s"} · ${clean} clean · ${failed} with findings · ` +
    `${findings} finding${findings === 1 ? "" : "s"}`
);

process.exit(findings > 0 || broken.length > 0 ? 1 : 0);
