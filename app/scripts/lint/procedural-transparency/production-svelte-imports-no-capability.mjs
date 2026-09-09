import { check } from "../shared/check.mjs";
import { productionSvelte } from "../shared/production.mjs";

export default check({
  id: "BEH-01",
  pillar: "procedural-transparency",
  finding: "ARCH-09",
  name: "production-svelte-imports-no-capability",
  says: "A production Svelte component renders and delegates; executable capability calls live in its procedure tree.",
  run(tree) {
    const found = [];
    for (const path of productionSvelte(tree)) {
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (record.type || target?.tree !== "capabilities") continue;
        found.push({
          path,
          line: record.line,
          fingerprint: record.specifier,
          message: `component imports executable capability ${record.specifier}; move the remote command to a named procedure`
        });
      }
    }
    return found;
  }
});
