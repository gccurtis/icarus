#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse as parseYaml } from "yaml";

import { loadTree } from "../../app/scripts/lint/shared/tree.mjs";
import { homeOf } from "../../app/scripts/lint/shared/home.mjs";
import {
  CONCERNS,
  ENVIRONMENTS,
  TEST_KINDS,
  VIEW_SURFACES,
  VIEW_TREES,
  capabilities,
  categories,
  domains,
  generalViews,
  integrations,
  objects,
  procedureEntries,
  surfaces,
  themes,
  vendored,
  viewLeaves,
  vocabularies
} from "../../app/scripts/lint/shared/trees.mjs";
import { vocabulary } from "../../app/scripts/lint/shared/keys.mjs";
import { declarationsIn, importsIn, referencesIn } from "../../app/scripts/lint/shared/css.mjs";
import {
  BRAND_ROLES,
  IDENTITY_ROLES,
  MEANING_ROLES,
  ROLES,
  SLOTS,
  STAGES,
  TOKEN_FILES,
  stageOf,
  stylesheets
} from "../../app/scripts/lint/shared/styles.mjs";
import { pathsNamedIn } from "../../app/scripts/lint/shared/docs.mjs";
import {
  constructionsIn,
  firstComment,
  headerComment,
  headingsOf,
  paragraphs,
  returnedFields,
  symbolsOf,
  testNames,
  typeAliases,
  typeMembers,
  usageLines,
  valueNamed
} from "./code.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, "..", "..");
const appRoot = join(repository, "app");
const output = join(here, "..", "src", "data");

const tree = await loadTree(appRoot);

const rel = (path) => relative(repository, path).split(sep).join("/");
const appRel = (path) => relative(appRoot, path).split(sep).join("/");
const read = (path) => readFileSync(path, "utf8");

const LIB_TREES = tree.dirsIn(tree.lib);

const kindOf = (path) => {
  const name = basename(path);
  if (/\.test\.ts$/.test(name)) return "test";
  if (name.endsWith(".md")) return "document";
  if (name.endsWith(".css")) return "stylesheet";
  if (name.endsWith(".svelte")) return "component";
  if (name.endsWith(".svelte.ts")) return "reactive module";
  if (name === "index.remote.ts") return "remote index";
  if (/\.server\.ts$/.test(name) || /^\+server\.ts$/.test(name) || name === "hooks.server.ts") return "server module";
  if (name.endsWith(".ts")) return "module";
  if (name.endsWith(".html")) return "html";
  return "file";
};

const treeOf = (segments) => {
  if (segments[1] === "lib") return segments[2];
  if (segments[1] === "routes") return "routes";
  if (segments[1] === "test") return "test";
  return "root";
};

const unitOf = (treeName, segments) => {
  const inside = segments.slice(3);
  switch (treeName) {
    case "capabilities":
    case "surfaces":
    case "development-views":
      return inside.length > 1 || (inside.length === 1 && !inside[0].endsWith(".md")) ? inside[0] : null;
    case "model":
      return inside.length >= 2 && !["test", "docs"].includes(inside[1]) ? `${inside[0]}/${inside[1]}` : null;
    case "components":
      return inside.length >= 2 ? `${inside[0]}/${inside[1]}` : inside[0] === "development" ? "development" : null;
    case "representation":
      if (inside[0] === "data" && inside.length >= 3) return `${inside[1]}/${inside[2]}`;
      if (inside[0] === "store") return "store";
      return null;
    case "app-views":
      if (inside[0] === "categories" && inside.length >= 2) return `categories/${inside[1]}`;
      if (inside[0] === "general" && inside.length >= 2) return `general/${inside[1]}`;
      return null;
    case "styles":
      if (inside[0] === "chromatic-themes" && inside.length >= 2 && !inside[1].endsWith(".css") && !inside[1].endsWith(".md")) return `chromatic-themes/${inside[1]}`;
      if (inside[0] === "x-integrations" && inside.length >= 2 && !inside[1].endsWith(".md")) return `x-integrations/${inside[1]}`;
      return inside[0].endsWith(".css") ? null : inside[0];
    case "runtime":
      return inside[0] && !inside[0].endsWith(".md") ? inside[0] : null;
    default:
      return null;
  }
};

const roleOf = (path, treeName, segments, text) => {
  const name = basename(path);
  const inside = segments.slice(3);
  const kind = kindOf(path);
  if (kind === "test") {
    const kindIndex = inside.indexOf("test");
    const testKind = kindIndex >= 0 ? inside[kindIndex + 1] : undefined;
    return TEST_KINDS.includes(testKind) ? `${testKind} test` : "test";
  }
  if (kind === "document") {
    if (name === `${inside.at(-2)}.md` && inside.length >= 2) return "directory document";
    if (inside.length === 1) return "tree document";
    return "document";
  }
  if (text.includes("Generated — do not edit")) return "generated vocabulary";
  switch (treeName) {
    case "capabilities": {
      if (name === "index.remote.ts" || name === "index.ts") return "capability index";
      if (inside[1] === "api") {
        if (inside[2] === "shared") return "shared step";
        if (name.startsWith("validate-")) return "validator";
        if (name === `${inside.at(-2)}.ts`) return "procedure entry";
        return "procedure step";
      }
      if (inside[1] === "types") return "capability types";
      if (inside[1] === "constants") return "capability constant";
      return "capability file";
    }
    case "model": {
      if (name === "index.ts" || name === "index.server.ts") return "object index";
      if (name === "types.ts") return "object types";
      if (name.startsWith("definition.")) return "object definition";
      if (name === "constructor.ts") return "object constructor";
      if (inside[2] === "methods") {
        if (inside[3] === "shared") return "shared method step";
        if (inside.length > 5) return "method step";
        if (name === `${inside.at(-2)}.ts` && inside.length === 5) return "method entry";
        return "method";
      }
      return "object file";
    }
    case "components": {
      if (inside[0] === "authored") {
        if (name === "index.ts") return "vocabulary index";
        if (name.endsWith(".svelte")) return "authored component";
        return "authored helper";
      }
      if (inside[0] === "vendored") {
        if (name === "utils.ts") return "registry utility";
        if (name === "index.ts") return "vendored index";
        if (name.endsWith(".svelte")) return "vendored component part";
        return "vendored helper";
      }
      if (inside[0] === "development") return name.endsWith(".svelte") ? "test fixture component" : "development component";
      return "component file";
    }
    case "representation": {
      if (inside[0] === "data" && inside[1] === "types") return "type declaration";
      if (inside[0] === "data" && inside[1] === "behavior") return "pure behavior";
      if (inside[0] === "store") {
        if (name === "tables.ts") return "table declarations";
        if (name === "admission.ts") return "store admission";
        if (name === "path.ts") return "store path algebra";
        return "store file";
      }
      return "representation file";
    }
    case "runtime": {
      if (name.startsWith("start.")) return "composition root";
      if (name === "types.ts") return "graph aggregate";
      if (name === "scope.server.ts") return "request scope";
      return "runtime file";
    }
    case "styles": {
      if (name === "app.css") return "stylesheet entry";
      if (name === "slots.css") return "slot table";
      if (inside[0] === "chromatic-themes") return "chromatic theme";
      if (inside[0] === "semantic-tokens") return "token domain";
      if (name === "generated.css") return "quarantined generated css";
      if (inside[0] === "x-integrations") return "integration adapter";
      return "stylesheet";
    }
    case "surfaces":
    case "development-views": {
      if (name === `${inside[0]}.svelte`) return treeName === "surfaces" ? "surface root" : "development surface root";
      if (name === "types.ts") return "surface types";
      if (CONCERNS.includes(inside[1])) {
        const concern = inside[1].replace(/s$/, "");
        return `${concern}${inside[1] === "shared" ? " state" : ""}`.replace("component", "surface component").replace("shared state", "shared state constructor");
      }
      return "surface file";
    }
    case "app-views": {
      if (inside[0] === "categories") {
        if (VIEW_SURFACES.includes(inside[2]) && name.endsWith(".svelte")) {
          return inside[2] === "content" ? "content view" : inside[2] === "context" ? "context view" : "inspector lens";
        }
        if (inside[2] === "procedures") return "view procedure";
        return "category file";
      }
      if (inside[0] === "general") return name.endsWith(".svelte") ? "general view" : "general view procedure";
      return "view file";
    }
    case "routes": {
      if (name === "+page.svelte") return "page route";
      if (name === "+layout.svelte") return "layout route";
      if (name === "+layout.ts") return "layout options";
      if (name === "+layout.server.ts") return "layout server load";
      if (name === "+page.server.ts") return "page server load";
      if (name === "+server.ts") return "endpoint";
      return "route file";
    }
    case "test":
      return "route-wide test";
    default: {
      if (name === "hooks.server.ts") return "server hooks";
      if (name === "app.html") return "html shell";
      if (name === "app.d.ts") return "ambient types";
      return "file";
    }
  }
};

const routeOf = (path) => {
  const inside = appRel(path).replace(/^src\/routes/, "");
  const directory = dirname(inside).replace(/\\/g, "/");
  return directory === "/" || directory === "." ? "/" : directory;
};

const files = [];
const byAbsolute = new Map();

for (const path of tree.files) {
  const text = read(path);
  const segments = appRel(path).split("/");
  const treeName = treeOf(segments);
  const kind = kindOf(path);
  const isSvelte = path.endsWith(".svelte");
  const imports = tree.imports(path).map((record) => {
    const resolved = tree.resolve(record.specifier, path);
    return {
      specifier: record.specifier,
      line: record.line,
      names: record.names,
      type: record.type,
      resolved: resolved ? rel(resolved) : null,
      external: !resolved && !record.specifier.startsWith(".") && !record.specifier.startsWith("$")
        ? record.specifier.split("/").slice(0, record.specifier.startsWith("@") ? 2 : 1).join("/")
        : null,
      provided: /^\$(app|env|service-worker)\b/.test(record.specifier)
    };
  });
  const entry = {
    id: rel(path),
    app: appRel(path),
    name: basename(path),
    tree: treeName,
    unit: LIB_TREES.includes(treeName) ? unitOf(treeName, segments) : null,
    kind,
    role: roleOf(path, treeName, segments, text),
    home: homeOf(tree, path).home,
    lines: text.split("\n").length,
    bytes: Buffer.byteLength(text),
    imports,
    exports: [...tree.exports(path)],
    symbols: symbolsOf(tree, path),
    blurb: firstComment(text, isSvelte).slice(0, 1600),
    generated: text.includes("Generated — do not edit"),
    headings: kind === "document" ? headingsOf(text) : [],
    text: kind === "document" || kind === "stylesheet" || kind === "html" ? text : undefined,
    route: treeName === "routes" ? routeOf(path) : undefined,
    tests: kind === "test" ? testNames(text) : undefined,
    namedPaths: kind === "document" ? pathsNamedIn(text).map(({ target, line }) => ({ target, line })) : undefined
  };
  files.push(entry);
  byAbsolute.set(path, entry);
}

const byId = new Map(files.map((entry) => [entry.id, entry]));
for (const entry of files) entry.importedBy = [];
for (const entry of files) {
  for (const record of entry.imports) {
    if (!record.resolved) continue;
    const target = byId.get(record.resolved);
    if (target && !target.importedBy.includes(entry.id)) target.importedBy.push(entry.id);
  }
}

const filesUnder = (directory) => tree.under(directory).map((path) => rel(path));
const filesIn = (directory) => (existsSync(directory) ? tree.filesIn(directory).map((name) => rel(join(directory, name))) : []);
const documentIn = (directory, name) => {
  const path = join(directory, `${name}.md`);
  return tree.isFile(path) ? rel(path) : null;
};

const remoteExports = (indexPath) => {
  const text = read(indexPath);
  const found = [];
  for (const match of text.matchAll(/export const (\w+) = (query|command|form|prerender)\(/g)) {
    found.push({ name: match[1], factory: match[2] });
  }
  return found;
};

const capabilityUnits = capabilities(tree).map(({ name, path }) => {
  const index = ["index.remote.ts", "index.ts"].map((file) => join(path, file)).find((candidate) => tree.isFile(candidate));
  const entries = procedureEntries(tree).filter((entry) => tree.within(path, entry));
  return {
    name,
    root: rel(path),
    document: documentIn(path, name),
    index: index ? rel(index) : null,
    remote: index ? remoteExports(index) : [],
    procedures: entries.map((entry) => {
      const directory = dirname(entry);
      return {
        name: basename(directory),
        entry: rel(entry),
        files: filesUnder(directory)
      };
    }),
    shared: filesIn(join(path, "api", "shared")),
    types: filesIn(join(path, "types")),
    constants: filesIn(join(path, "constants")),
    tests: filesUnder(join(path, "test")),
    files: filesUnder(path)
  };
});

const methodsOf = (directory) => {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const name of tree.filesIn(directory)) {
    if (name.endsWith(".md")) continue;
    found.push({ name: name.replace(/\.svelte\.ts$|\.ts$/, ""), file: rel(join(directory, name)), shape: "file" });
  }
  for (const name of tree.dirsIn(directory)) {
    if (name === "shared") continue;
    found.push({ name, file: rel(join(directory, name, `${name}.ts`)), shape: "directory", files: filesUnder(join(directory, name)) });
  }
  return found;
};

const objectUnits = objects(tree).map(({ name, path, environment, id }) => {
  const files = tree.filesIn(path);
  const definition = ["definition.svelte.ts", "definition.ts"].find((candidate) => files.includes(candidate));
  const index = ["index.ts", "index.server.ts"].find((candidate) => files.includes(candidate));
  const constructorFile = join(path, "constructor.ts");
  const typesPath = join(path, "types.ts");
  const modelType = tree.isFile(typesPath)
    ? typeAliases(tree, typesPath).filter((alias) => alias.exported)
    : [];
  return {
    id,
    name,
    environment,
    root: rel(path),
    document: documentIn(path, name),
    index: index ? rel(join(path, index)) : null,
    types: tree.isFile(typesPath) ? rel(typesPath) : null,
    definition: definition ? rel(join(path, definition)) : null,
    reactive: definition === "definition.svelte.ts",
    constructor: tree.isFile(constructorFile) ? rel(constructorFile) : null,
    constructors: tree.isFile(constructorFile) ? symbolsOf(tree, constructorFile).filter((symbol) => symbol.exported && symbol.kind === "function").map((symbol) => symbol.name) : [],
    methods: methodsOf(join(path, "methods")),
    shared: filesIn(join(path, "methods", "shared")),
    methodsDocument: documentIn(join(path, "methods"), "methods"),
    sharedDocument: documentIn(join(path, "methods", "shared"), "shared"),
    tests: filesUnder(join(path, "test")),
    surface: modelType,
    files: filesUnder(path)
  };
});

const runtimeRoots = [
  { environment: "client", start: tree.path("runtime", "client", "start.ts"), types: tree.path("runtime", "client", "types.ts"), builder: "buildClientModel", initializer: "initClientModel", accessor: "clientModel", aggregate: "ClientModel" },
  { environment: "server", start: tree.path("runtime", "server", "start.server.ts"), types: tree.path("runtime", "server", "types.ts"), builder: "buildServerModel", initializer: "initServerModel", accessor: "serverModel", closer: "closeServerModel", aggregate: "ServerModel" }
].map((root) => ({
  environment: root.environment,
  start: rel(root.start),
  types: rel(root.types),
  builder: root.builder,
  initializer: root.initializer,
  accessor: root.accessor,
  closer: root.closer ?? null,
  aggregate: root.aggregate,
  aggregateFields: typeMembers(tree, root.types, root.aggregate) ?? [],
  constructions: constructionsIn(tree, root.start, root.builder),
  returned: returnedFields(tree, root.start, root.builder),
  files: filesUnder(tree.path("runtime", root.environment))
}));

const exportsOfIndex = (indexPath) => {
  const text = read(indexPath);
  const found = [];
  for (const match of text.matchAll(/export \{ default as (\w+) \} from "([^"]+)"/g)) {
    found.push({ name: match[1], from: match[2], component: true });
  }
  for (const match of text.matchAll(/export \{([^}]+)\} from "([^"]+)"/g)) {
    if (match[1].includes("default as")) continue;
    for (const piece of match[1].split(",")) {
      const name = piece.trim().replace(/^type /, "").split(/\s+as\s+/).at(-1);
      if (name) found.push({ name, from: match[2], component: false, type: /^\s*type /.test(piece) });
    }
  }
  const defaults = new Map();
  for (const match of text.matchAll(/import (\w+) from "([^"]+)"/g)) defaults.set(match[1], match[2]);
  for (const match of text.matchAll(/export \{([^}]+)\};/g)) {
    for (const piece of match[1].split(",")) {
      const [local, alias] = piece.trim().split(/\s+as\s+/);
      const name = alias ?? local;
      const from = defaults.get(local);
      if (name && from) found.push({ name, from, component: from.endsWith(".svelte") });
    }
  }
  return found;
};

const vocabularyUnits = vocabularies(tree).map(({ name, path }) => {
  const index = join(path, "index.ts");
  return {
    name,
    root: rel(path),
    index: tree.isFile(index) ? rel(index) : null,
    exports: tree.isFile(index) ? exportsOfIndex(index) : [],
    blurb: tree.isFile(index) ? headerComment(read(index)) : "",
    files: filesUnder(path)
  };
});

const vendoredUnits = vendored(tree).map(({ name, path }) => ({
  name,
  root: rel(path),
  index: tree.isFile(join(path, "index.ts")) ? rel(join(path, "index.ts")) : null,
  files: filesUnder(path),
  exports: tree.isFile(join(path, "index.ts")) ? [...tree.exports(join(path, "index.ts"))] : []
}));

const developmentComponents = filesUnder(tree.path("components", "development"));

const declaredDomains = (() => {
  const path = join(appRoot, "configuration", "representation.yaml");
  const document = parseYaml(read(path));
  return document?.representation?.domains ?? {};
})();

const domainUnits = (() => {
  const { types, behavior } = domains(tree);
  const names = [...new Set([...types.map((entry) => entry.name), ...behavior.map((entry) => entry.name)])].sort();
  return names.map((name) => {
    const typesPath = tree.path("representation", "data", "types", name);
    const behaviorPath = tree.path("representation", "data", "behavior", name);
    const typeFiles = existsSync(typesPath) ? filesUnder(typesPath) : [];
    return {
      name,
      declares: declaredDomains[name] ?? [],
      types: typeFiles,
      behavior: existsSync(behaviorPath) ? filesUnder(behaviorPath) : [],
      declarations: typeFiles
        .filter((id) => id.endsWith(".ts"))
        .flatMap((id) => typeAliases(tree, join(repository, id)).filter((alias) => alias.exported).map((alias) => ({ ...alias, file: id })))
    };
  });
})();

const tablesPath = tree.path("representation", "store", "tables.ts");
const tableNames = valueNamed(tree, tablesPath, "TABLE_NAMES") ?? [];
const tableFields = typeMembers(tree, tablesPath, "TableFields") ?? [];
const tables = tableNames.map((name) => {
  const fieldsType = tableFields.find((member) => member.name === name)?.type ?? null;
  const rowTypeName = fieldsType ? fieldsType.replace(/Fields$/, "") : null;
  return {
    name,
    fieldsType,
    rowType: rowTypeName,
    fields: fieldsType ? (typeMembers(tree, tablesPath, fieldsType) ?? []) : []
  };
});

const surfaceUnits = surfaces(tree).map(({ name, path, development }) => ({
  name,
  development,
  root: rel(path),
  document: documentIn(path, name),
  component: tree.isFile(join(path, `${name}.svelte`)) ? rel(join(path, `${name}.svelte`)) : null,
  types: tree.isFile(join(path, "types.ts")) ? rel(join(path, "types.ts")) : null,
  concerns: Object.fromEntries(
    CONCERNS.map((concern) => [concern, existsSync(join(path, concern)) ? filesUnder(join(path, concern)) : []])
  ),
  tests: filesUnder(join(path, "test")),
  files: filesUnder(path)
}));

const leaves = viewLeaves(tree);
const categoryUnits = categories(tree).map(({ name, path }) => ({
  name,
  root: rel(path),
  document: documentIn(path, name),
  content: leaves.filter((leaf) => leaf.category === name && leaf.surface === "content").map((leaf) => ({ key: `${name}.${leaf.name}`, file: rel(leaf.path) })),
  context: leaves.filter((leaf) => leaf.category === name && leaf.surface === "context").map((leaf) => ({ key: `${name}.${leaf.name}`, file: rel(leaf.path) })),
  inspector: leaves.filter((leaf) => leaf.category === name && leaf.surface === "inspector").map((leaf) => ({ key: `${name}.${leaf.name}`, file: rel(leaf.path) })),
  procedures: existsSync(join(path, "procedures")) ? tree.filesIn(join(path, "procedures")).map((file) => rel(join(path, "procedures", file))) : [],
  tests: filesUnder(join(path, "procedures", "test")),
  files: filesUnder(path)
}));

const generalUnits = generalViews(tree).map(({ name, path }) => ({
  name,
  root: rel(path),
  component: tree.isFile(join(path, `${name}.svelte`)) ? rel(join(path, `${name}.svelte`)) : null,
  files: filesUnder(path)
}));

const keys = vocabulary(tree);
const hasLeaf = (surface, key) => leaves.some((leaf) => leaf.surface === surface && `${leaf.category}.${leaf.name}` === key);
const openingPath = tree.path("representation", "data", "behavior", "workspace", "opening.ts");
const opening = valueNamed(tree, openingPath, "OPENING") ?? {};
const startingFrame = valueNamed(tree, openingPath, "STARTING_FRAME") ?? {};
const singletons = valueNamed(tree, tree.path("representation", "data", "behavior", "workspace", "starting.ts"), "SINGLETONS") ?? [];
const commandsTypes = tree.path("model", "client", "commands", "types.ts");
const commandIds = valueNamed(tree, commandsTypes, "COMMAND_IDS") ?? [];
const defaultBindings = valueNamed(tree, commandsTypes, "DEFAULT_BINDINGS") ?? {};
const publishedKeys = valueNamed(tree, join(tree.routes, "app", "[project]", "+layout.server.ts"), "PUBLISHED_KEYS") ?? [];
const railEntriesRaw = valueNamed(tree, tree.path("surfaces", "context", "procedures", "rail-entries.ts"), "RAIL_ENTRIES") ?? {};
const railEntries = Object.fromEntries(
  Object.entries(railEntriesRaw).map(([key, value]) => [key, { label: value?.label ?? "", icon: value?.icon?.identifier ?? "" }])
);
const categoryEntriesRaw = valueNamed(tree, tree.path("surfaces", "tab-bar", "procedures", "category-entries.ts"), "CATEGORY_ENTRIES") ?? {};
const themeNames = valueNamed(tree, tree.path("surfaces", "top-bar", "effects", "apply-theme.svelte.ts"), "THEMES") ?? [];
const seriesColors = valueNamed(tree, tree.path("components", "authored", "chart", "palette.ts"), "SERIES_COLORS") ?? [];
const translationConfiguration = typeMembers(tree, tree.path("representation", "data", "types", "semantic", "translation.ts"), "TranslationConfiguration") ?? [];

const vocabularyData = {
  categories: (keys.categories ?? []).map((name) => ({ key: name, singleton: singletons.includes(name), opening: opening[name] ?? null })),
  contentViews: (keys.contentViews ?? []).map((key) => ({ key, file: hasLeaf("content", key) ? rel(leaves.find((leaf) => leaf.surface === "content" && `${leaf.category}.${leaf.name}` === key).path) : null })),
  contextViews: (keys.contexts ?? []).map((key) => ({
    key,
    file: hasLeaf("context", key) ? rel(leaves.find((leaf) => leaf.surface === "context" && `${leaf.category}.${leaf.name}` === key).path) : null,
    onRail: Object.values(opening).some((entry) => (entry?.rail ?? []).includes(key)),
    label: railEntries[key]?.label ?? null,
    icon: railEntries[key]?.icon ?? null
  })),
  inspectorViews: (keys.inspections ?? []).map((key) => ({
    key,
    file: hasLeaf("inspector", key)
      ? rel(leaves.find((leaf) => leaf.surface === "inspector" && `${leaf.category}.${leaf.name}` === key).path)
      : key.startsWith("general.") && tree.isFile(tree.path("app-views", "general", key.split(".")[1], `${key.split(".")[1]}.svelte`))
        ? rel(tree.path("app-views", "general", key.split(".")[1], `${key.split(".")[1]}.svelte`))
        : null
  })),
  keysFile: rel(keys.path),
  viewKeysFile: rel(keys.viewPath),
  opening,
  startingFrame,
  singletons,
  commandIds,
  defaultBindings,
  publishedKeys,
  categoryEntries: Object.fromEntries(Object.entries(categoryEntriesRaw).map(([key, value]) => [key, value?.icon?.identifier ?? ""])),
  themes: themeNames,
  seriesColors,
  translationConfiguration
};

const sheets = stylesheets(tree, { includeGenerated: true }).map((path) => {
  const text = read(path);
  return {
    id: rel(path),
    stage: stageOf(tree, path),
    generated: path.endsWith("generated.css"),
    declarations: declarationsIn(text, path).map(({ name, value, selectors, line }) => ({ name, value, selectors, line })),
    references: referencesIn(text, path).map(({ name, prop, line }) => ({ name, prop, line })),
    imports: importsIn(text, path)
  };
});

const themeUnits = themes(tree).map(({ name, path, css }) => {
  const text = read(css);
  const declarations = declarationsIn(text, css);
  const scheme = (text.match(/color-scheme:\s*(light|dark)/) ?? [])[1] ?? null;
  const palette = {};
  const themeTokens = [];
  for (const { name: prop, value } of declarations) {
    const ramp = prop.match(/^--palette-([a-z]+)-([a-z]+)$/);
    if (ramp) {
      palette[ramp[1]] ??= {};
      palette[ramp[1]][ramp[2]] = value;
      continue;
    }
    if (prop.startsWith("--theme-")) themeTokens.push({ name: prop, value });
  }
  return {
    name,
    root: rel(path),
    css: rel(css),
    document: documentIn(path, name),
    scheme,
    bindsRoot: declarations.some(({ selectors }) => selectors.some((selector) => selector.split(",").some((part) => part.includes(":root") && !part.includes("[data-theme")))),
    palette,
    themeTokens
  };
});

const slotsPath = tree.path("styles", "chromatic-themes", "slots.css");
const slotDeclarations = declarationsIn(read(slotsPath), slotsPath).map(({ name, value }) => ({ name, value }));
const tokenDomains = TOKEN_FILES.map((file) => {
  const path = tree.path("styles", "semantic-tokens", file);
  return {
    domain: file.replace(/\.css$/, ""),
    id: rel(path),
    declarations: declarationsIn(read(path), path).map(({ name, value, line }) => ({ name, value, line }))
  };
});
const integrationUnits = integrations(tree).map(({ name, path }) => ({
  name,
  root: rel(path),
  document: documentIn(path, name),
  files: filesUnder(path),
  declarations: filesUnder(path)
    .filter((id) => id.endsWith(".css") && !id.endsWith("generated.css"))
    .flatMap((id) => declarationsIn(read(join(repository, id)), id).map(({ name: prop, value, selectors }) => ({ file: id, name: prop, value, selectors })))
}));
const appCssPath = tree.path("styles", "app.css");
const stylesData = {
  entry: rel(appCssPath),
  entryImports: importsIn(read(appCssPath), appCssPath),
  stages: STAGES,
  tokenFiles: TOKEN_FILES,
  roles: { meaning: MEANING_ROLES, identity: IDENTITY_ROLES, brand: BRAND_ROLES, all: ROLES },
  slots: SLOTS,
  themes: themeUnits,
  slotTable: slotDeclarations,
  tokens: tokenDomains,
  integrations: integrationUnits,
  sheets
};

const lintRoot = join(appRoot, "scripts", "lint");
const lintOrder = valueNamed(tree, join(appRoot, "scripts", "lint.mjs"), "TREES") ?? [];
const checks = [];
for (const treeName of lintOrder) {
  for (const file of readdirSync(join(lintRoot, treeName)).sort()) {
    if (!file.endsWith(".mjs")) continue;
    const path = join(lintRoot, treeName, file);
    const module = await import(pathToFileURL(path).href);
    const definition = module.default;
    checks.push({
      tree: treeName,
      name: definition.name,
      says: definition.says,
      subjects: definition.subjects ?? {},
      file: rel(path),
      source: read(path),
      blurb: headerComment(read(path))
    });
  }
}
const mutationsModule = await import(pathToFileURL(join(appRoot, "scripts", "test", "mutations.mjs")).href);
const mutations = mutationsModule.MUTATIONS.map((mutation) => ({
  check: mutation.check,
  tree: mutation.tree ?? null,
  subject: mutation.subject ?? null,
  says: mutation.says,
  names: mutation.names,
  changes: mutation.changes.map((change) => ({ path: change.path, write: change.write ?? null, edit: Boolean(change.edit), remove: Boolean(change.remove) }))
}));
const lintShared = readdirSync(join(lintRoot, "shared")).filter((name) => name.endsWith(".mjs")).map((name) => {
  const path = join(lintRoot, "shared", name);
  return { id: rel(path), name, blurb: headerComment(read(path)), symbols: symbolsOf(tree, path).filter((symbol) => symbol.exported).map((symbol) => symbol.name) };
});

const appPackage = JSON.parse(read(join(appRoot, "package.json")));
const generationRoot = join(appRoot, "scripts", "generation");
const generatorFiles = [];
for (const group of readdirSync(generationRoot, { withFileTypes: true })) {
  if (!group.isDirectory()) continue;
  for (const file of readdirSync(join(generationRoot, group.name)).sort()) {
    if (!file.endsWith(".mjs")) continue;
    const path = join(generationRoot, group.name, file);
    const comment = headerComment(read(path));
    const script = Object.entries(appPackage.scripts).find(([, command]) => command.includes(`scripts/generation/${group.name}/${file}`));
    generatorFiles.push({
      id: rel(path),
      group: group.name,
      name: file.replace(/\.mjs$/, ""),
      command: script ? script[0] : null,
      usage: usageLines(comment),
      description: paragraphs(comment),
      shared: group.name === "shared"
    });
  }
}
const scriptTests = [];
const scriptTestRoots = [join(appRoot, "scripts", "test"), join(generationRoot, "representation", "test")];
for (const root of scriptTestRoots) {
  if (!existsSync(root)) continue;
  for (const file of readdirSync(root).sort()) {
    const path = join(root, file);
    const text = read(path);
    scriptTests.push({
      id: rel(path),
      name: file,
      test: file.endsWith(".test.mjs"),
      blurb: headerComment(text),
      tests: file.endsWith(".test.mjs") ? testNames(text) : []
    });
  }
}
const otherScripts = ["lint.mjs", "seed.mjs"].map((name) => {
  const path = join(appRoot, "scripts", name);
  return { id: rel(path), name, blurb: headerComment(read(path)), usage: usageLines(headerComment(read(path))) };
});

const testFiles = files
  .filter((entry) => entry.kind === "test")
  .map((entry) => ({
    id: entry.id,
    tree: entry.tree,
    unit: entry.unit,
    kind: entry.role,
    names: entry.tests ?? [],
    exercises: entry.imports.filter((record) => record.resolved && !record.resolved.endsWith(".test.ts")).map((record) => record.resolved),
    mocks: entry.imports.filter((record) => record.specifier === "vitest").length > 0 ? "vitest" : "unknown"
  }));

const configurationRoot = join(appRoot, "configuration");
const configuration = readdirSync(configurationRoot)
  .filter((name) => name.endsWith(".yaml"))
  .sort()
  .map((name) => {
    const path = join(configurationRoot, name);
    const text = read(path);
    return { id: rel(path), name, text, value: parseYaml(text) };
  });
const configurationReadme = rel(join(configurationRoot, "README.md"));

const seedTables = existsSync(join(appRoot, "seed"))
  ? readdirSync(join(appRoot, "seed")).filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, "")).sort()
  : [];

const routes = files
  .filter((entry) => entry.tree === "routes")
  .map((entry) => ({ id: entry.id, route: entry.route, role: entry.role, name: entry.name, renders: entry.imports.filter((record) => record.resolved).map((record) => record.resolved) }));

const counts = {};
for (const entry of files) {
  counts[entry.tree] ??= { files: 0, kinds: {} };
  counts[entry.tree].files += 1;
  counts[entry.tree].kinds[entry.kind] = (counts[entry.tree].kinds[entry.kind] ?? 0) + 1;
}

const treeDocuments = Object.fromEntries(
  LIB_TREES.map((name) => [name, documentIn(tree.path(name), name)])
);

const meta = {
  extractedAt: new Date().toISOString(),
  totalFiles: files.length,
  counts,
  trees: LIB_TREES,
  treeDocuments,
  aliases: tree.aliases,
  lintOrder,
  environments: ENVIRONMENTS,
  testKinds: TEST_KINDS,
  concerns: CONCERNS,
  viewSurfaces: VIEW_SURFACES,
  viewTrees: VIEW_TREES,
  packageScripts: appPackage.scripts,
  dependencies: appPackage.dependencies,
  devDependencies: appPackage.devDependencies,
  seedTables,
  configurationReadme
};

mkdirSync(output, { recursive: true });
const write = (name, value) => writeFileSync(join(output, name), `${JSON.stringify(value, null, 1)}\n`);
write("files.json", files);
write("units.json", {
  capabilities: capabilityUnits,
  objects: objectUnits,
  runtime: runtimeRoots,
  vocabularies: vocabularyUnits,
  vendored: vendoredUnits,
  developmentComponents,
  domains: domainUnits,
  tables,
  tablesFile: rel(tablesPath),
  surfaces: surfaceUnits,
  categories: categoryUnits,
  general: generalUnits,
  routes
});
write("vocabulary.json", vocabularyData);
write("styles.json", stylesData);
write("checks.json", { checks, mutations, shared: lintShared, order: lintOrder });
write("generators.json", { generators: generatorFiles, scriptTests, otherScripts });
write("tests.json", testFiles);
write("configuration.json", configuration);
write("meta.json", meta);

console.log(`extract: ${files.length} files, ${checks.length} checks, ${tables.length} tables, ${testFiles.length} test files → ${rel(output)}`);
