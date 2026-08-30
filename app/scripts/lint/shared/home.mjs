/**
 * Which process a module belongs to, decided from where it sits and what it is
 * called — never from what it imports, because what it imports is the thing the
 * checks built on this are trying to decide.
 *
 * Two rules in order. A framework suffix decides first: SvelteKit already
 * refuses to send `*.server.ts` to a browser, so agreeing with the toolchain
 * costs nothing and disagreeing with it would be a second opinion. Otherwise the
 * tree decides. A module neither rule reaches has no stated home, which is a
 * finding of its own — every boundary check assumes every module has one.
 *
 * `shared` is the interesting one. A shared module is one either process may
 * load, which is only true if what it loads is also shared.
 */
import { sep } from "node:path";

export const CLIENT = "client";
export const SERVER = "server";
export const SHARED = "shared";
/** Runs under the test runner and ships nowhere, so the boundary rules pass over it. */
export const TEST = "test";

const SERVER_FILENAMES = [/\.server\.(ts|js)$/, /^\+server\.(ts|js)$/, /^hooks\.server\.ts$/];
const CLIENT_FILENAMES = [/\.svelte$/, /\.svelte\.(ts|js)$/, /^hooks\.client\.ts$/];

/** Where a tree sits, for anything the filename did not already decide. */
const BY_TREE = [
  [["components"], CLIENT],
  [["views"], CLIENT],
  [["model", "client"], CLIENT],
  [["model", "server"], SERVER],
  [["runtime", "client"], CLIENT],
  [["runtime", "server"], SERVER],
  [["representation"], SHARED]
];

const startsWith = (segments, prefix) => prefix.every((part, index) => segments[index] === part);

/**
 * A capability is the one tree whose files do not share a home. Its index is
 * `shared` — that is what makes it the crossing — and everything a procedure is
 * built from is the server's.
 */
const capabilityHome = (segments) => {
  if (segments[0] !== "capabilities") return null;
  if (segments.length === 2) return SHARED; // capabilities.md, cast.ts, and friends
  const inside = segments.slice(2);
  if (inside[0] === "api") return SERVER;
  if (inside[0] === "test") return TEST;
  return SHARED; // the index, its types, its errors
};

/** Routes take the framework's own rules; nothing here is ours to decide. */
const routeHome = (name) => {
  if (/^\+(page|layout)\.(ts|js)$/.test(name)) return SHARED;
  return null;
};

/**
 * @returns {{ home: string|null, by: "filename"|"tree"|null }}
 */
export const homeOf = (tree, path) => {
  const name = path.split(sep).at(-1);
  if (!/\.(ts|js|mjs|svelte)$/.test(name)) return { home: null, by: null };

  if (SERVER_FILENAMES.some((pattern) => pattern.test(name))) return { home: SERVER, by: "filename" };
  if (CLIENT_FILENAMES.some((pattern) => pattern.test(name))) return { home: CLIENT, by: "filename" };

  if (tree.within(tree.routes, path)) {
    const home = routeHome(name);
    return home ? { home, by: "filename" } : { home: null, by: null };
  }

  // A test runs under the test runner and ships nowhere, wherever it sits.
  const inSrc = tree.rel(path).split("/").slice(1);
  if (inSrc.includes("test") || /\.test\.(ts|js)$/.test(name)) return { home: TEST, by: "tree" };

  if (!tree.within(tree.lib, path)) return { home: null, by: null };

  const segments = tree.rel(path).split("/").slice(2); // past src/lib

  const capability = capabilityHome(segments);
  if (capability) return { home: capability, by: "tree" };

  for (const [prefix, home] of BY_TREE) {
    if (startsWith(segments, prefix)) return { home, by: "tree" };
  }
  return { home: null, by: null };
};

/** Every module in `src/`, with its home. Files with no home are included, home null. */
export const homes = (tree) => {
  const found = new Map();
  for (const path of tree.files) {
    if (!/\.(ts|js|mjs|svelte)$/.test(path)) continue;
    if (path.endsWith(".d.ts")) continue;
    found.set(path, homeOf(tree, path));
  }
  return found;
};
