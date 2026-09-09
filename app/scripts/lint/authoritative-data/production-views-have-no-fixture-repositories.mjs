import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";

const FAKE_READ = /type\s+Read\s*<[^>]+>[\s\S]{0,400}loading\s*:\s*false[\s\S]{0,600}refresh\s*:\s*(?:async|\(.*?\)\s*=>)/;
const NOOP_REFRESH = /refresh\s*:\s*async\s*\([^)]*\)\s*=>\s*\{\s*\}/;
const INVENTED_IDS = /\bid\s*:\s*["'](?:r|th|mock|fixture)-[a-z0-9-]+["']/g;
const REPOSITORY_NAME = /^(?:agents|analyses|cells|comments|decks|documents|records|resources|rows|spreadsheets|styles|templates|threads)$/i;

const unwrap = (node) => {
  let value = node;
  while (
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isParenthesizedExpression(value)
  ) value = value.expression;
  return value;
};

const hasId = (object) =>
  object.properties.some((property) => {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return false;
    const name = property.name;
    return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text === "id" : false;
  });

const localRepositories = (tree, path) => {
  const found = [];
  for (const { source } of tree.scripts(path)) {
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !REPOSITORY_NAME.test(declaration.name.text)) continue;
        const initializer = declaration.initializer && unwrap(declaration.initializer);
        if (!initializer || !ts.isArrayLiteralExpression(initializer)) continue;
        const objects = initializer.elements
          .map(unwrap)
          .filter((element) => ts.isObjectLiteralExpression(element));
        if (objects.length >= 2 && objects.every(hasId)) found.push(declaration.name.text);
      }
    }
  }
  return found.sort();
};

export default check({
  id: "DATA-01",
  pillar: "authoritative-data",
  finding: "ARCH-07",
  name: "production-views-have-no-fixture-repositories",
  says: "Production app views do not implement query-shaped repositories over canned persistent-looking records.",
  run(tree) {
    const root = tree.path("app-views");
    const found = [];
    for (const path of productionSources(tree).filter(
      (file) => tree.within(root, file) && /\.(?:ts|svelte)$/.test(file)
    )) {
      const text = tree.read(path);
      const fakeRead = FAKE_READ.test(text) && NOOP_REFRESH.test(text);
      const invented = [...text.matchAll(INVENTED_IDS)];
      const repositories = localRepositories(tree, path);
      if (!fakeRead && invented.length < 3 && repositories.length === 0) continue;
      found.push({
        path,
        fingerprint:
          `${fakeRead ? "fake-read" : ""}:` +
          `${invented.map((match) => match[0]).sort().join(",")}:` +
          repositories.join(","),
        message:
          `production view acts as a fixture repository${fakeRead ? " with a no-op Read<T> facade" : ""}` +
          `${invented.length ? ` and ${invented.length} invented persistent ids` : ""}` +
          `${repositories.length ? ` through local record arrays: ${repositories.join(", ")}` : ""}`
      });
    }
    return found;
  }
});
