import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";

const LEGACY = /legacy|deprecated|compatibility|migration|migrate/i;

const markersIn = (tree, path) => {
  const found = new Set();
  for (const script of tree.scripts(path)) {
    const visit = (node) => {
      if (
        (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        LEGACY.test(node.text)
      ) found.add(node.text);
      node.forEachChild(visit);
    };
    visit(script.source);
  }
  return [...found].sort();
};

export default check({
  id: "DATA-06",
  pillar: "authoritative-data",
  finding: "ARCH-07",
  name: "legacy-schema-support-does-not-exist",
  says: "Production source has one current schema and contains no executable legacy, compatibility, deprecated, or migration branch marker.",
  run(tree) {
    const found = [];
    for (const path of productionSources(tree)) {
      const relative = tree.rel(path);
      const pathMarker = relative.split("/").some((part) => LEGACY.test(part));
      const markers = markersIn(tree, path);
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
