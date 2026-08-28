/**
 * Paths a markdown document names, and whether they are still there.
 *
 * Only what is decidable. A link target and a multi-segment path resolve against
 * the document's own directory and can be checked; a bare `constructor.ts` in a
 * drawn tree names a file relative to a directory the drawing implies rather
 * than states, so it is left alone. Guessing there would report the tree's shape
 * as broken every time somebody indented a diagram differently.
 */
import { dirname, resolve } from "node:path";

const LINK = /\]\(([^)\s#]+)(?:\s+"[^"]*")?\)/g;
/** A path with at least one separator and a file extension we own. */
const PATH = /(?<![\w./-])((?:\.{1,2}\/)?(?:[\w-]+\/)+[\w-]+\.(?:svelte\.ts|svelte|ts|css|md))(?![\w/-])/g;

const isExternal = (target) => /^(https?:|mailto:|#|\$)/.test(target);

/** @returns {Array<{ target: string, line: number }>} */
export const pathsNamedIn = (text) => {
  const found = new Map();
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const [, target] of line.matchAll(LINK)) {
      if (isExternal(target)) continue;
      if (!found.has(target)) found.set(target, index + 1);
    }
    for (const [, target] of line.matchAll(PATH)) {
      if (isExternal(target)) continue;
      if (!found.has(target)) found.set(target, index + 1);
    }
  }
  return [...found].map(([target, line]) => ({ target, line }));
};

/**
 * The named paths a document gets wrong.
 *
 * Tried against the document's own directory first, then each ancestor up to the
 * tree root, then the package root — because a document one level down often
 * names a path the way the unit's root would (`methods/open/open.ts` read from
 * inside `methods/`), and a document that names itself does it from the
 * repository. Which base was meant is not written down, so a path that resolves
 * against any of them names something real, and only one that resolves against
 * none of them is a finding.
 */
export const unresolvedPathsIn = (tree, document, directory, root = tree.lib) => {
  const bases = [];
  for (let at = directory; tree.within(root, at); at = dirname(at)) bases.push(at);
  // The tree root, and the package root beneath it: a document that names itself
  // as `src/lib/views/app/app.md` is naming a real path, from the one place that
  // spelling resolves.
  bases.push(root, tree.base);

  return pathsNamedIn(tree.read(document)).filter(
    ({ target }) => !bases.some((base) => tree.exists(resolve(base, decodeURI(target))))
  );
};
