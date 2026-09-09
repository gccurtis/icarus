import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";

const FIXTURE_PATH = /\/(?:development-views|test|tests|fixtures|mocks)(?:\/|$)/;

export default check({
  id: "DATA-02",
  pillar: "authoritative-data",
  finding: "ARCH-07",
  name: "development-fixtures-stay-in-development",
  says: "Fixture modules live under development/test and cannot enter a production route, view, surface, model, or capability.",
  run(tree) {
    const found = [];
    for (const path of productionSources(tree)) {
      const relative = tree.rel(path);
      const demoRoute = relative.startsWith("src/routes/demo/");
      if (!demoRoute && /\/(?:fixtures|mocks)\//.test(relative)) {
        found.push({
          path,
          fingerprint: "fixture-home",
          message: "fixture/mock module sits in a production source home"
        });
      }
      if (demoRoute) continue;
      for (const record of tree.imports(path)) {
        const resolved = tree.resolve(record.specifier, path);
        const target = resolved ? tree.rel(resolved) : record.specifier;
        if (!FIXTURE_PATH.test(`/${target}`)) continue;
        found.push({
          path,
          line: record.line,
          fingerprint: record.specifier,
          message: `production code imports fixture/development source ${record.specifier}`
        });
      }
    }
    return found;
  }
});
