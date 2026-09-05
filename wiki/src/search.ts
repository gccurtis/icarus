import { checks, files, fileRoute, generators, meta, styles, tests, units, vocabulary, TREE_ORDER, TREE_TITLES } from "./data";
import { PAGES } from "./pages/registry";

export type SearchEntry = {
  kind: string;
  title: string;
  route: string;
  path?: string;
  text: string;
  weight: number;
};

const entries: SearchEntry[] = [];

for (const page of PAGES) {
  entries.push({ kind: "page", title: page.title, route: page.route, text: `${page.title} ${page.summary} ${page.keywords ?? ""}`, weight: 3 });
  for (const heading of page.headings ?? []) {
    entries.push({ kind: "heading", title: heading.text, route: `${page.route}#${heading.id}`, path: page.title, text: `${heading.text} ${page.title}`, weight: 2 });
  }
}

for (const tree of TREE_ORDER) {
  entries.push({ kind: "tree", title: TREE_TITLES[tree], route: `/trees/${tree}`, text: `${tree} ${TREE_TITLES[tree]} tree`, weight: 3 });
}

for (const entry of files) {
  entries.push({
    kind: entry.kind === "test" ? "test" : entry.kind === "document" ? "document" : "file",
    title: entry.name,
    route: fileRoute(entry.id),
    path: entry.app,
    text: `${entry.app} ${entry.role} ${entry.exports.join(" ")} ${entry.symbols.map((symbol) => symbol.name).join(" ")} ${entry.headings.map((heading) => heading.text).join(" ")}`,
    weight: 1
  });
  for (const symbol of entry.symbols) {
    if (!symbol.exported) continue;
    entries.push({
      kind: "symbol",
      title: symbol.name,
      route: `${fileRoute(entry.id)}#symbol-${symbol.name}`,
      path: entry.app,
      text: `${symbol.name} ${symbol.kind} ${entry.app}`,
      weight: 1.5
    });
  }
}

for (const check of checks.checks) {
  entries.push({
    kind: "check",
    title: check.name,
    route: `/checks/${check.tree}/${check.name}`,
    path: `${check.tree}`,
    text: `${check.name} ${check.says} ${Object.entries(check.subjects).map(([key, value]) => `${key} ${value}`).join(" ")}`,
    weight: 2.5
  });
}

for (const domain of styles.tokens) {
  for (const declaration of domain.declarations) {
    entries.push({
      kind: "token",
      title: declaration.name,
      route: `/design-system/tokens#${encodeURIComponent(declaration.name)}`,
      path: domain.domain,
      text: `${declaration.name} ${declaration.value} token ${domain.domain}`,
      weight: 1.5
    });
  }
}

for (const slot of styles.slotTable) {
  entries.push({ kind: "slot", title: slot.name, route: `/design-system/slots#${encodeURIComponent(slot.name)}`, text: `${slot.name} ${slot.value}`, weight: 1 });
}

for (const theme of styles.themes) {
  for (const [hue, steps] of Object.entries(theme.palette)) {
    for (const [step, value] of Object.entries(steps)) {
      entries.push({ kind: "palette", title: `--palette-${hue}-${step}`, route: `/design-system/themes#${theme.name}`, path: theme.name, text: `--palette-${hue}-${step} ${value} ${theme.name}`, weight: 0.8 });
    }
  }
  for (const token of theme.themeTokens) {
    entries.push({ kind: "theme", title: token.name, route: `/design-system/themes#${theme.name}`, path: theme.name, text: `${token.name} ${token.value} ${theme.name}`, weight: 0.8 });
  }
}

for (const table of units.tables) {
  entries.push({ kind: "table", title: table.name, route: `/data-model#table-${table.name}`, text: `${table.name} ${table.fields.map((field) => field.name).join(" ")} table`, weight: 2 });
}

for (const capability of units.capabilities) {
  entries.push({ kind: "capability", title: capability.name, route: `/trees/capabilities#${capability.name}`, text: `${capability.name} capability ${capability.remote.map((remote) => remote.name).join(" ")}`, weight: 2 });
  for (const remote of capability.remote) {
    entries.push({ kind: "procedure", title: remote.name, route: `/trees/capabilities#${capability.name}`, path: capability.name, text: `${remote.name} ${remote.factory} ${capability.name}`, weight: 1.5 });
  }
}

for (const object of units.objects) {
  entries.push({ kind: "object", title: object.id, route: `/trees/model#${object.environment}-${object.name}`, text: `${object.id} model object ${object.methods.map((method) => method.name).join(" ")}`, weight: 2 });
}

for (const vocabularyUnit of units.vocabularies) {
  entries.push({ kind: "vocabulary", title: vocabularyUnit.name, route: `/trees/components#${vocabularyUnit.name}`, text: `${vocabularyUnit.name} vocabulary ${vocabularyUnit.exports.map((entry) => entry.name).join(" ")}`, weight: 2 });
  for (const item of vocabularyUnit.exports) {
    if (!item.component) continue;
    entries.push({ kind: "component", title: item.name, route: `/trees/components#${vocabularyUnit.name}`, path: vocabularyUnit.name, text: `${item.name} ${vocabularyUnit.name} component`, weight: 1.2 });
  }
}

for (const vendoredUnit of units.vendored) {
  entries.push({ kind: "vendored", title: vendoredUnit.name, route: `/trees/components#vendored-${vendoredUnit.name}`, text: `${vendoredUnit.name} vendored shadcn`, weight: 1 });
}

for (const domain of units.domains) {
  entries.push({ kind: "domain", title: domain.name, route: `/trees/representation#domain-${domain.name}`, text: `${domain.name} domain ${domain.declarations.map((declaration) => declaration.name).join(" ")}`, weight: 2 });
}

for (const surface of units.surfaces) {
  entries.push({ kind: surface.development ? "development view" : "surface", title: surface.name, route: `/trees/${surface.development ? "development-views" : "surfaces"}#${surface.name}`, text: `${surface.name} surface`, weight: 2 });
}

for (const category of units.categories) {
  entries.push({ kind: "category", title: category.name, route: `/trees/app-views#${category.name}`, text: `${category.name} category`, weight: 2 });
}

for (const view of [...vocabulary.contextViews, ...vocabulary.inspectorViews, ...vocabulary.contentViews]) {
  entries.push({ kind: "view key", title: view.key, route: `/views#${view.key.replace(".", "-")}`, text: `${view.key} view key`, weight: 1 });
}

for (const generator of generators.generators) {
  if (generator.shared) continue;
  entries.push({ kind: "generator", title: generator.command ? `pnpm ${generator.command}` : generator.name, route: `/generators#${generator.name}`, text: `${generator.name} ${generator.command ?? ""} ${generator.usage.join(" ")}`, weight: 2 });
}

for (const test of tests) {
  for (const name of test.names) {
    entries.push({ kind: "test name", title: name.name, route: fileRoute(test.id), path: test.id.replace(/^app\//, ""), text: `${name.name} ${test.id}`, weight: 0.7 });
  }
}

for (const [alias, target] of Object.entries(meta.aliases)) {
  entries.push({ kind: "alias", title: alias, route: "/architecture#aliases", text: `${alias} ${target}`, weight: 1 });
}

const tokenize = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9$#@._-]+/).filter(Boolean);

const indexed = entries.map((entry) => ({ entry, tokens: tokenize(entry.text), title: entry.title.toLowerCase() }));

export const search = (query: string, limit = 40): SearchEntry[] => {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const { entry, tokens, title } of indexed) {
    let score = 0;
    for (const term of terms) {
      if (title === term) score += 12;
      else if (title.startsWith(term)) score += 6;
      else if (title.includes(term)) score += 4;
      else if (tokens.some((token) => token === term)) score += 3;
      else if (tokens.some((token) => token.startsWith(term))) score += 1.5;
      else if (tokens.some((token) => token.includes(term))) score += 0.5;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0) scored.push({ entry, score: score * entry.weight });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return scored.slice(0, limit).map(({ entry }) => entry);
};

export const searchSize = entries.length;
