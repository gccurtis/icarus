import { dirname, join, resolve } from "node:path";

import { check } from "../shared/check.mjs";
import { declarationsIn, importsIn } from "../shared/css.mjs";
import {
  TOKEN_FILES,
  TOKEN_STAGE,
  appCss,
  bindsRoot,
  selectorParts,
  generatedCss,
  slotsCss,
  stylesRoot,
  stylesheets
} from "../shared/styles.mjs";

const DOOR = "src/routes/+layout.svelte";
const DOOR_IMPORT = '"$styles/app.css"';

/** A theme binds `:root` when it is the default; the alternates bind their attribute only. */
const isDefault = (tree, path) =>
  declarationsIn(tree.read(path), path).some(({ selectors }) => bindsRoot(selectorParts(selectors)));

/**
 * The order the stages have to execute in: the default theme, then the
 * alternates, then slot resolution, then tokens, then the adapters. A stage that
 * reads a value declared after it resolves to nothing.
 */
const expectedOrder = (tree) => {
  const root = stylesRoot(tree);
  const themes = tree
    .dirsIn(join(root, "chromatic-themes"))
    .map((name) => join(root, "chromatic-themes", name, `${name}.css`))
    .filter((path) => tree.isFile(path));
  const defaults = themes.filter((path) => isDefault(tree, path));
  const alternates = themes.filter((path) => !defaults.includes(path)).sort();

  const named = [
    ...defaults,
    ...alternates,
    slotsCss(tree),
    ...TOKEN_FILES.map((name) => join(root, TOKEN_STAGE, name)),
    join(root, "x-integrations", "tailwind", "tailwind.css"),
    join(root, "x-integrations", "shadcn", "variants.css"),
    join(root, "x-integrations", "shadcn", "bridge.css")
  ];
  const known = new Set(named);
  const rest = tree
    .under(join(root, "x-integrations"))
    .filter((path) => path.endsWith(".css") && path !== generatedCss(tree) && !known.has(path))
    .sort();
  return [...named, ...rest].filter((path) => tree.isFile(path));
};

export default check({
  name: "one-stylesheet-door",
  says: "Two entry points is two cascade orders, and which one wins depends on load order.",
  subjects: {
    "single-entry": "the root layout imports app.css once, and nothing else imports a stylesheet",
    "every-file-reachable": "every authored stage file is imported by app.css exactly once",
    "import-order": "imports are contiguous and in stage order, default theme first, slots after every theme"
  },
  run(tree) {
    const found = [];
    const app = appCss(tree);
    if (!tree.isFile(app)) {
      return [{ subject: "single-entry", path: app, message: "there is no door" }];
    }

    const taken = importsIn(tree.read(app), app)
      .filter(({ relative }) => relative)
      .map(({ target }) => resolve(dirname(app), target));
    const expected = expectedOrder(tree);

    if (taken.length !== expected.length || taken.some((path, index) => path !== expected[index])) {
      found.push({ subject: "import-order", path: app, message: "the imports are not the stages in order" });
    }

    const counts = new Map();
    for (const path of taken) counts.set(path, (counts.get(path) ?? 0) + 1);
    for (const path of expected) {
      const count = counts.get(path) ?? 0;
      if (count === 1) continue;
      found.push({
        subject: "every-file-reachable",
        path,
        message: count === 0 ? "is never imported, so it is silently absent" : `is imported ${count} times`
      });
    }

    // A stage stylesheet that pulls in another is a second cascade order hidden
    // one level down, where the door's list does not show it.
    for (const path of stylesheets(tree)) {
      if (path === app) continue;
      for (const { target, relative, line } of importsIn(tree.read(path), path)) {
        if (!relative) continue;
        found.push({ subject: "single-entry", path, line, message: `hides an import of ${target}` });
      }
    }

    const door = join(tree.base, ...DOOR.split("/"));
    const times = tree.exists(door) ? tree.read(door).split(DOOR_IMPORT).length - 1 : 0;
    if (times !== 1) {
      found.push({
        subject: "single-entry",
        path: door,
        message: `imports the door ${times} times, not once`
      });
    }

    for (const path of tree.files) {
      if (!/\.(svelte|ts|js|css)$/.test(path)) continue;
      if (path === door || tree.within(stylesRoot(tree), path)) continue;
      const match = tree.read(path).match(/\$(?:lib\/)?styles\/[^"']+\.css/);
      if (!match) continue;
      found.push({ subject: "single-entry", path, message: `imports ${match[0]} rather than the door` });
    }
    return found;
  }
});
