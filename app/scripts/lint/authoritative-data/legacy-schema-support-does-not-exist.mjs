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
  says: "Production source has one current schema, contains no executable legacy branch marker, cannot re-admit a registered retired field, cannot make or absence-repair a registered required current field, rejects non-plain records, accessors, undefined values, and hidden or symbolic own fields at the shared represented-value gates, admits Document, Presentation, Variable, Research, and Agent commands through exact own-key, nominal-id, discriminated-value, and coherence contracts, admits only complete authored error-free messages, ready semantic materials with only their optional degradation error, and fresh formula snapshots without retired work/error fields or FormulaBlock.resolvedAt, requires explicit text and facet-dependent provenance discriminators on semantic citations, gives Derived Outputs exact none/authored/generated value ownership and exact output/job lifecycle arms, gives every prompt block exactly one definition owner and one complete unlinked-idle or linked lifecycle arm, enforces exact Research-turn and Agent-task lifecycle arms, gives running Agent tasks an explicit executor without plan-text inference, project-bounds Agent name projections, requires every slide set operation to name one closed target, keeps exact resource kinds and nominal resource references closed, binds private Resource Sets to an exact nominal ResourceRef rather than a bare id, admits only exact native-storage references and claims, and routes Store load, replacement, commit, and recovery through one exhaustive recursive admission registry.",
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
