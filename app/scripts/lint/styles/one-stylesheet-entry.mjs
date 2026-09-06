import { dirname, join, resolve } from "node:path";

import { check } from "../shared/check.mjs";
import { importsIn } from "../shared/css.mjs";

const LAYOUT = "src/routes/+layout.svelte";
const LAYOUT_IMPORT = '"$styles/app.css"';

const ORDER = [
  ["material", "ramps.css"],
  ["material", "helios", "helios.css"],
  ["material", "selene", "selene.css"],
  ["material", "slots.css"],
  ["tokens", "color.css"],
  ["tokens", "typography.css"],
  ["tokens", "space.css"],
  ["tokens", "shape.css"],
  ["tokens", "motion.css"],
  ["surfaces", "surfaces.css"],
  ["integrations", "tailwind", "tailwind.css"],
  ["integrations", "shadcn", "variants.css"],
  ["integrations", "shadcn", "bridge.css"]
];

const stylesRoot = (tree) => tree.path("styles");
const appCss = (tree) => join(stylesRoot(tree), "app.css");
const generatedCss = (tree) => join(stylesRoot(tree), "integrations", "shadcn", "generated.css");
const expectedOrder = (tree) => ORDER.map((parts) => join(stylesRoot(tree), ...parts));

const authored = (tree) =>
  tree
    .under(stylesRoot(tree))
    .filter((path) => path.endsWith(".css"))
    .filter((path) => path !== appCss(tree) && path !== generatedCss(tree));

export default check({
  name: "one-stylesheet-entry",
  says: "Two entry points is two cascade orders, and which one wins depends on load order.",
  subjects: {
    "single-entry": "the root layout imports app.css once, and nothing else imports a stylesheet",
    "every-file-reachable": "every authored stylesheet is imported by app.css exactly once",
    "import-order":
      "imports are contiguous and in cascade order: material, slots, tokens, surfaces, adapters"
  },
  run(tree) {
    const found = [];
    const app = appCss(tree);
    if (!tree.isFile(app)) {
      return [{ subject: "single-entry", path: app, message: "there is no app.css" }];
    }

    const taken = importsIn(tree.read(app), app)
      .filter(({ relative }) => relative)
      .map(({ target }) => resolve(dirname(app), target));
    const expected = expectedOrder(tree);

    if (taken.length !== expected.length || taken.some((path, index) => path !== expected[index])) {
      found.push({
        subject: "import-order",
        path: app,
        message: "the imports are not the cascade in order"
      });
    }

    const counts = new Map();
    for (const path of taken) counts.set(path, (counts.get(path) ?? 0) + 1);
    for (const path of new Set([...expected, ...authored(tree)])) {
      const count = counts.get(path) ?? 0;
      if (count === 1) continue;
      found.push({
        subject: "every-file-reachable",
        path,
        message: count === 0 ? "is never imported, so it is silently absent" : `is imported ${count} times`
      });
    }

    for (const path of authored(tree)) {
      for (const { target, relative, line } of importsIn(tree.read(path), path)) {
        if (!relative) continue;
        found.push({ subject: "single-entry", path, line, message: `hides an import of ${target}` });
      }
    }

    const layout = join(tree.base, ...LAYOUT.split("/"));
    const times = tree.exists(layout) ? tree.read(layout).split(LAYOUT_IMPORT).length - 1 : 0;
    if (times !== 1) {
      found.push({
        subject: "single-entry",
        path: layout,
        message: `imports app.css ${times} times, not once`
      });
    }

    for (const path of tree.files) {
      if (!/\.(svelte|ts|js|css)$/.test(path)) continue;
      if (path === layout || tree.within(stylesRoot(tree), path)) continue;
      const match = tree.read(path).match(/\$(?:lib\/)?styles\/[^"']+\.css/);
      if (!match) continue;
      found.push({ subject: "single-entry", path, message: `imports ${match[0]} rather than app.css` });
    }
    return found;
  }
});
