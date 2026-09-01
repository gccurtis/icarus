/**
 * What each tree's units are, found by position on disk.
 *
 * The filesystem is the registry everywhere here — a list beside it would be a
 * second answer to what exists, and the two would disagree the first time
 * somebody added a directory without editing it.
 */
import { join } from "node:path";

export const TEST_KINDS = ["unit", "regression", "non-functional"];
export const CONCERNS = ["components", "effects", "interactions", "procedures", "shared"];
export const ENVIRONMENTS = ["client", "server"];
export const PANEL_TREES = ["context", "inspector"];

/** Directories an environment root owns itself; neither one is an object. */
const NOT_AN_OBJECT = new Set(["test", "docs"]);

/** The three trees that hold a rendered view, wherever a rule is about all of them. */
export const VIEW_TREES = ["surfaces", "app-views", "development-views"];

const named = (tree, dir) => tree.dirsIn(dir).map((name) => ({ name, path: join(dir, name) }));

/** `capabilities/<capability>/`. */
export const capabilities = (tree) => named(tree, tree.path("capabilities"));

/** `model/<environment>/<object>/`, with which environment it belongs to. */
export const objects = (tree) => {
  const found = [];
  for (const environment of ENVIRONMENTS) {
    for (const { name, path } of named(tree, tree.path("model", environment))) {
      if (NOT_AN_OBJECT.has(name)) continue;
      found.push({ name, path, environment, id: `${environment}/${name}` });
    }
  }
  return found;
};

/** `components/authored/<vocabulary>/`. */
export const vocabularies = (tree) => named(tree, tree.path("components", "authored"));

/** `components/vendored/<component>/`. */
export const vendored = (tree) => named(tree, tree.path("components", "vendored"));

/** `representation/data/types/<domain>/`, and the behaviour directories beside them. */
export const domains = (tree) => ({
  types: named(tree, tree.path("representation", "data", "types")),
  behavior: named(tree, tree.path("representation", "data", "behavior"))
});

/** `surfaces/<surface>/` and `development-views/<surface>/`. */
export const surfaces = (tree) => [
  ...named(tree, tree.path("surfaces")).map((surface) => ({ ...surface, development: false })),
  ...named(tree, tree.path("development-views")).map((surface) => ({ ...surface, development: true }))
];

/** `app-views/panels/{context,inspector}/<subject>/<key>.svelte`. */
export const panelLeaves = (tree) => {
  const found = [];
  for (const stack of PANEL_TREES) {
    const root = tree.path("app-views", "panels", stack);
    for (const { name: subject, path } of named(tree, root)) {
      for (const file of tree.filesIn(path)) {
        found.push({ stack, subject, file, path: join(path, file) });
      }
    }
  }
  return found;
};

/** `app-views/workspaces/<category>/workspace[-<subscreen>].svelte`. */
export const workspaceFiles = (tree) => {
  const found = [];
  for (const { name: category, path } of named(tree, tree.path("app-views", "workspaces"))) {
    for (const file of tree.filesIn(path)) {
      if (!file.endsWith(".svelte")) continue;
      const match = file.match(/^workspace(?:-(.+))?\.svelte$/);
      found.push({
        category,
        file,
        path: join(path, file),
        subscreen: match ? (match[1] ?? null) : undefined
      });
    }
  }
  return found;
};

/** `styles/chromatic-themes/<theme>/<theme>.css`. */
export const themes = (tree) =>
  named(tree, tree.path("styles", "chromatic-themes")).map(({ name, path }) => ({
    name,
    path,
    css: join(path, `${name}.css`)
  }));

/** `styles/x-integrations/<target>/`. */
export const integrations = (tree) => named(tree, tree.path("styles", "x-integrations"));

/** The unit a path belongs to, or null. Used wherever "outside this unit" is the question. */
/** Every `api/<procedure>/…/<entry>.ts`. A directory's entry is named for it. */
export const procedureEntries = (tree) => {
  const found = [];
  const walk = (dir) => {
    for (const name of tree.dirsIn(dir)) {
      if (name === "shared") continue;
      const child = join(dir, name);
      const entry = join(child, `${name}.ts`);
      if (tree.isFile(entry)) found.push(entry);
      walk(child);
    }
  };
  for (const { path } of capabilities(tree)) {
    const api = join(path, "api");
    if (tree.exists(api)) walk(api);
  }
  return found;
};

export const unitOf = (tree, units, path) =>
  units.find((unit) => tree.within(unit.path, path)) ?? null;
