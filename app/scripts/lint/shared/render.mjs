/**
 * Rendering components the way the application would.
 *
 * "Renders alone" is a claim about behaviour, so nothing short of running it
 * settles it. Vite's own pipeline — aliases, TypeScript in script blocks, the
 * Svelte transform — rather than a second one that could disagree with it, and
 * `svelte/server` runs in Node with no DOM to stand up.
 *
 * The render happens in a child process rooted at the tree, because SvelteKit's
 * vite plugin overrides `root` with the working directory: a server configured
 * to point elsewhere silently renders the files beside the script instead, and
 * reports every file the caller actually meant as missing.
 *
 * Effects do not run on the server, so an effect that reached for `window` is
 * not covered. That is the same limit the render has always had.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const worker = fileURLToPath(new URL("./render-worker.mjs", import.meta.url));

/** @returns {Array<{ path: string, message: string }>} — absolute paths, as given. */
export const renderAll = (tree, paths, props) => {
  if (paths.length === 0) return [];

  const output = execFileSync(process.execPath, [worker], {
    cwd: tree.base,
    input: JSON.stringify({ paths: paths.map((path) => tree.rel(path)), props }),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });

  const found = new Map(paths.map((path) => [tree.rel(path), path]));
  return JSON.parse(output).map(({ path, message }) => ({ path: found.get(path) ?? path, message }));
};
