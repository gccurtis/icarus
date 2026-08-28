/**
 * A copy of the package to break on purpose.
 *
 * The checks are pointed at a real tree rather than at a hand-built fixture,
 * because a fixture is a second opinion about what the tree looks like and it
 * drifts the first time the real one moves. One copy for the whole suite, and
 * every mutation is reverted, so what one test breaks the next test does not
 * inherit.
 *
 * `node_modules` is linked rather than copied: the render checks stand up a vite
 * server against it, and copying a few thousand packages to prove a linter fires
 * would be the slowest thing in the repository.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { Tree } from "../lint/shared/tree.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const COPIED = ["src", "configuration", "svelte.config.js", "components.json", "package.json", "vite.config.ts"];

export const sandbox = () => {
  const base = mkdtempSync(join(tmpdir(), "icarus-lint-"));
  for (const entry of COPIED) {
    const from = join(packageRoot, entry);
    if (existsSync(from)) cpSync(from, join(base, entry), { recursive: true });
  }
  symlinkSync(join(packageRoot, "node_modules"), join(base, "node_modules"), "dir");
  return base;
};

/** The alias map, read from the sandbox's own config rather than assumed. */
export const treeIn = async (base) => {
  const config = await import(`${join(base, "svelte.config.js")}?v=${base}`);
  const declared = config.default?.kit?.alias ?? {};
  return new Tree({ base, aliases: { $lib: "src/lib", ...declared } });
};

/**
 * Applies a set of changes, runs `body`, and puts everything back — including
 * when `body` throws, because a test that fails should not decide what the next
 * one sees.
 */
export const breaking = async (base, changes, body) => {
  const undo = [];

  for (const change of changes) {
    const path = join(base, change.path);
    if (change.write !== undefined) {
      const existed = existsSync(path);
      const before = existed ? readFileSync(path, "utf8") : null;
      undo.push(() => (existed ? writeFileSync(path, before) : rmSync(path, { force: true })));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, change.write);
      continue;
    }
    if (change.edit) {
      const before = readFileSync(path, "utf8");
      undo.push(() => writeFileSync(path, before));
      writeFileSync(path, change.edit(before));
      continue;
    }
    if (change.remove) {
      const before = existsSync(path) ? readFileSync(path, "utf8") : null;
      undo.push(() => (before === null ? undefined : writeFileSync(path, before)));
      rmSync(path, { force: true, recursive: true });
    }
  }

  try {
    // A fresh Tree, because the one the caller holds has the old tree cached.
    return await body(await treeIn(base));
  } finally {
    for (const step of undo.reverse()) step();
  }
};

export const discard = (base) => rmSync(base, { recursive: true, force: true });
