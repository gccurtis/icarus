import { join } from "node:path";

import { check } from "../shared/check.mjs";

export default check({
  name: "vendor-keeps-its-own-spelling",
  says: "A vendored file's import spelling comes from the tool, and the next regeneration overwrites anything else.",
  subjects: {
    "import-spelling": "a vendored import is relative or $vendored-components/…, which is what the CLI writes",
    "matches-components-json": "that path is aliases.ui, so the CLI and the check cannot disagree about where the tree is"
  },
  run(tree) {
    const found = [];
    const configPath = join(tree.base, "components.json");
    const config = tree.exists(configPath) ? JSON.parse(tree.read(configPath)) : null;
    const declared = config?.aliases?.ui ?? null;
    const expected = "$vendored-components";

    if (declared !== expected) {
      found.push({
        subject: "matches-components-json",
        path: configPath,
        message: `aliases.ui is ${declared ?? "absent"}, so the CLI writes a spelling this check does not expect`
      });
    }

    const prefix = declared ?? expected;
    for (const path of tree.under(tree.path("components", "vendored"))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      for (const record of tree.imports(path)) {
        const { specifier } = record;
        const resolved = tree.resolve(specifier, path);
        if (!resolved || !tree.within(tree.path("components", "vendored"), resolved)) continue;
        // The CLI reaches within its own tree relatively and names the tree
        // itself through `aliases.ui`. Both are its spelling. A first-party
        // alias is not — it is a line somebody typed, and the next regeneration
        // eats it.
        if (specifier.startsWith(".")) continue;
        if (specifier === prefix || specifier.startsWith(`${prefix}/`)) continue;
        found.push({
          subject: "import-spelling",
          path,
          line: record.line,
          message: `spelled ${specifier}, not ${prefix}/… or a relative path`
        });
      }
    }
    return found;
  }
});
