import ts from "typescript";

const STORE_GATE_ROUTES = [
  {
    path: ["model", "server", "store", "methods", "shared", "load.server.ts"],
    name: "load",
    required: /tables\.set\(table,\s*admitAnyRows\(table,\s*stored\)\)/
  },
  {
    path: ["model", "server", "store", "methods", "shared", "state.ts"],
    name: "replaceRows",
    required: /const current = admitAnyRows\(table,\s*rows\)/
  },
  {
    path: ["model", "server", "store", "methods", "transaction", "commit.server.ts"],
    name: "commit",
    required: /rows:\s*admitAnyRows\(table,\s*unit\.tables\.get\(table\) \?\? \[\]\)/
  },
  {
    path: ["model", "server", "store", "methods", "transaction", "journal.server.ts"],
    name: "recovery",
    required: /return admitAnyRows\(table,\s*value\)/
  }
];

const stringArrayFor = (source, name) => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      let initializer = declaration.initializer;
      while (initializer !== undefined && ts.isAsExpression(initializer)) {
        initializer = initializer.expression;
      }
      if (!ts.isArrayLiteralExpression(initializer)) return [];
      return initializer.elements.filter(ts.isStringLiteral).map((entry) => entry.text);
    }
  }
  return [];
};

const objectKeysFor = (source, name) => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      let initializer = declaration.initializer;
      while (initializer !== undefined && ts.isSatisfiesExpression(initializer)) {
        initializer = initializer.expression;
      }
      if (!ts.isObjectLiteralExpression(initializer)) return [];
      return initializer.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
          return [];
        }
        const held = property.name;
        return ts.isIdentifier(held) || ts.isStringLiteral(held) ? [held.text] : [];
      });
    }
  }
  return [];
};

export const storeGateFindings = (tree) => {
  const found = [];
  for (const route of STORE_GATE_ROUTES) {
    const path = tree.path(...route.path);
    if (route.required.test(tree.read(path))) continue;
    found.push({
      path,
      fingerprint: `current-store-gate:${route.name}`,
      message: `the Store ${route.name} path bypasses exact current-row admission`
    });
  }

  const tablesPath = tree.path("representation", "store", "tables.ts");
  const valuesPath = tree.path("representation", "store", "current-values.ts");
  const tables = stringArrayFor(tree.source(tablesPath), "TABLE_NAMES").sort();
  const validators = objectKeysFor(tree.source(valuesPath), "CURRENT_ROW_VALUE_VALIDATORS").sort();
  const valuesText = tree.read(valuesPath);
  if (
    tables.length === 0 ||
    tables.length !== validators.length ||
    tables.some((table, index) => table !== validators[index]) ||
    !/satisfies Record<TableName,\s*CurrentRowValueValidator>/.test(valuesText) ||
    !/CURRENT_ROW_VALUE_VALIDATORS\[table\]\(value\)/.test(valuesText) ||
    /\?\?\s*true/.test(valuesText)
  ) {
    found.push({
      path: valuesPath,
      fingerprint: "current-store-gate:exhaustive-values",
      message: "the Store current-value registry is not exhaustive or permits an unregistered-table fallback"
    });
  }
  return found;
};
