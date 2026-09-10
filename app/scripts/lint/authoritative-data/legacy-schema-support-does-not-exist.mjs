import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";
import {
  hasLegacyPathPart,
  schemaMarkersIn
} from "./legacy-schema-support-does-not-exist/schema-markers.mjs";
import { storeGateFindings } from "./legacy-schema-support-does-not-exist/store-gates.mjs";

const currentSources = (tree) => [
  ...productionSources(tree),
  ...tree.under(join(tree.base, "scripts"))
    .filter((path) =>
      /\.(?:js|mjs|ts)$/.test(path) &&
      !tree.within(join(tree.base, "scripts", "lint"), path) &&
      !tree.within(join(tree.base, "scripts", "test"), path)
    )
];

export default check({
  id: "DATA-06",
  pillar: "authoritative-data",
  finding: "ARCH-07",
  name: "legacy-schema-support-does-not-exist",
  says: "Production source has one current schema, contains no executable legacy branch marker, cannot re-admit a registered retired field, cannot make or absence-repair a registered required current field, keeps exact resource kinds and nominal resource references closed, and routes Store load, replacement, commit, and recovery through one exhaustive recursive admission registry.",
  run(tree) {
    const found = storeGateFindings(tree);
    for (const path of currentSources(tree)) {
      const pathMarker = hasLegacyPathPart(tree.rel(path));
      const markers = schemaMarkersIn(tree, path);
      if (!pathMarker && markers.length === 0) continue;
      found.push({
        path,
        fingerprint: [...(pathMarker ? ["path"] : []), ...markers].join(","),
        message:
          "production code preserves an old-schema path" +
          `${pathMarker ? " in its source location" : ""}` +
          `${markers.length ? ` through: ${markers.join(", ")}` : ""}`
      });
    }
    return found;
  }
});
