import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";
import { objects } from "../shared/trees.mjs";

export default check({
  id: "DATA-03",
  pillar: "authoritative-data",
  finding: "ARCH-04",
  name: "constructed-subject-runtime-is-reachable",
  says: "Every subject runtime register has a production workspace/view consumer outside runtime and its own object.",
  run(tree) {
    const found = [];
    const sources = productionSources(tree);
    for (const runtime of objects(tree).filter(
      (object) => object.environment === "client" && object.name.endsWith("-runtimes")
    )) {
      const specifier = `$model/client/${runtime.name}`;
      const consumers = sources.filter((path) => {
        if (tree.within(runtime.path, path) || tree.within(tree.path("runtime"), path)) return false;
        return tree.imports(path).some(
          (record) => record.specifier === specifier || record.specifier.startsWith(`${specifier}/`)
        );
      });
      if (consumers.length > 0) continue;
      found.push({
        path: runtime.path,
        fingerprint: runtime.name,
        message: `${runtime.name} is constructed but cannot reach any production workspace or editor consumer`
      });
    }
    return found;
  }
});
