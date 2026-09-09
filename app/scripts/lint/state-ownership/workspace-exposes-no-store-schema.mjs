import { check } from "../shared/check.mjs";

const RAW_VOCABULARY = /\b(?:TableName|StoreQuery|StoreReader|readStore|TABLE_NAMES)\b/;

export default check({
  id: "OWN-04",
  pillar: "state-ownership",
  finding: "ARCH-08",
  name: "workspace-exposes-no-store-schema",
  says: "WorkspaceState coordinates tabs and views; its source and public surface never expose raw persistence-table vocabulary.",
  run(tree) {
    const root = tree.path("model", "client", "workspace-state");
    const found = [];
    for (const path of tree.under(root).filter((file) => /\.(?:ts|svelte\.ts)$/.test(file))) {
      const importsStore = tree.imports(path).some((record) =>
        /\$(?:representation\/store|model\/server\/store)/.test(record.specifier)
      );
      const match = tree.read(path).match(RAW_VOCABULARY);
      if (!importsStore && !match) continue;
      found.push({
        path,
        line: match ? tree.read(path).slice(0, match.index).split("\n").length : 1,
        fingerprint: "raw-store-vocabulary",
        message: "workspace state exposes persistence-table vocabulary instead of typed subject projections"
      });
    }
    return found;
  }
});
