import { join } from "node:path";

import { parse } from "yaml";

import { check } from "../shared/check.mjs";
import { categories } from "../shared/trees.mjs";

const VALID = new Set(["live", "prototype", "unavailable"]);

export default check({
  id: "DATA-05",
  pillar: "authoritative-data",
  finding: "ARCH-07",
  name: "unsupported-subject-is-explicit",
  says: "Every category declares readiness, and a non-live production center visibly renders that status.",
  subjects: {
    "readiness-is-declared": "every category has one recognized readiness state",
    "non-live-is-visible": "prototype/unavailable views cannot impersonate durable live data"
  },
  run(tree) {
    const config = join(tree.base, "configuration", "category-readiness.yaml");
    let declared = {};
    try {
      declared = parse(tree.read(config))?.categories ?? {};
    } catch {
      declared = {};
    }
    const found = [];
    const available = categories(tree);
    const names = new Set(available.map(({ name }) => name));
    for (const name of Object.keys(declared).filter((name) => !names.has(name)).sort()) {
      found.push({
        subject: "readiness-is-declared",
        path: config,
        fingerprint: `stale:${name}`,
        message: `readiness manifest retains removed category ${name}`
      });
    }
    for (const category of available) {
      const status = declared[category.name];
      if (!VALID.has(status)) {
        found.push({
          subject: "readiness-is-declared",
          path: tree.isFile(config) ? config : category.path,
          fingerprint: category.name,
          message: `${category.name} has no live/prototype/unavailable readiness declaration`
        });
        continue;
      }
      if (status === "live") continue;
      const content = join(category.path, "content");
      const text = tree.under(content).map((path) => tree.read(path)).join("\n");
      if (text.includes(`data-category-readiness="${status}"`)) continue;
      found.push({
        subject: "non-live-is-visible",
        path: content,
        fingerprint: `${category.name}:${status}`,
        message: `${category.name} is ${status} but its production content does not visibly declare that state`
      });
    }
    return found;
  }
});
