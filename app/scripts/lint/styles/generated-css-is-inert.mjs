import { dirname, join, resolve } from "node:path";

import { check } from "../shared/check.mjs";
import { importsIn } from "../shared/css.mjs";
import { appCss, generatedCss } from "../shared/styles.mjs";

const QUARANTINE = "Quarantine file";

export default check({
  name: "generated-css-is-inert",
  says: "The shadcn output is the exact components.json target, carries its quarantine header, and is imported by nothing.",
  run(tree) {
    const found = [];
    const generated = generatedCss(tree);
    const config = join(tree.base, "components.json");

    const target = tree.exists(config) ? JSON.parse(tree.read(config)).tailwind?.css : null;
    if (!target || resolve(tree.base, target) !== resolve(generated)) {
      found.push({
        path: config,
        message: `tailwind.css is ${target ?? "absent"}; the quarantine is ${tree.rel(generated)}`
      });
    }

    if (!tree.isFile(generated)) {
      found.push({ path: generated, message: "the quarantine file is not there" });
    } else if (!tree.read(generated).includes(QUARANTINE)) {
      found.push({ path: generated, message: `does not carry its "${QUARANTINE}" header` });
    }

    const app = appCss(tree);
    if (tree.isFile(app)) {
      const taken = importsIn(tree.read(app), app)
        .filter(({ relative }) => relative)
        .map(({ target: spec }) => resolve(dirname(app), spec));
      if (taken.includes(resolve(generated))) {
        found.push({ path: app, message: "imports the quarantined stylesheet, so it executes" });
      }
    }
    return found;
  }
});
