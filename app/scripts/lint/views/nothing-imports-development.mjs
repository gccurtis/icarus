import { join } from "node:path";

import { check } from "../shared/check.mjs";

/** A development surface is reached from `/demo`, and from nowhere in the application. */
const DEMO_ROUTES = ["routes", "demo"];

export default check({
  name: "nothing-imports-development",
  says: "It may import anything; the trade only holds in one direction.",
  subjects: {
    "no-inbound-import": "nothing outside development/ imports a development surface",
    "has-a-demo-route": "every development surface is reachable from a /demo route, so an unreachable one is a failure rather than a leftover"
  },
  run(tree) {
    const development = tree.path("views", "development");
    const found = [];

    for (const path of tree.files) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      if (tree.within(development, path)) continue;
      if (tree.within(join(tree.src, ...DEMO_ROUTES), path)) continue;

      for (const record of tree.imports(path)) {
        const resolved = tree.resolve(record.specifier, path);
        if (!resolved || !tree.within(development, resolved)) continue;
        found.push({
          subject: "no-inbound-import",
          path,
          line: record.line,
          message: `imports a development surface: ${record.specifier}`
        });
      }
    }

    // Which surfaces the demo routes actually reach, read off their imports.
    const reached = new Set();
    for (const path of tree.under(join(tree.src, ...DEMO_ROUTES))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const resolved = tree.resolve(record.specifier, path);
        if (resolved && tree.within(development, resolved)) reached.add(tree.rel(resolved));
      }
    }

    for (const name of tree.dirsIn(development)) {
      const surface = join(development, name);
      const entry = join(surface, `${name}.svelte`);
      if (reached.has(tree.rel(entry))) continue;
      const anyReached = tree.under(surface).some((path) => reached.has(tree.rel(path)));
      if (anyReached) continue;
      found.push({ subject: "has-a-demo-route", path: surface, message: "no /demo route reaches it" });
    }
    return found;
  }
});
