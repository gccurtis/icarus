import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

const STAGES = ["chromatic-themes", "semantic-sets", "tokens", "x-integrations"];
const TOKEN_FILES = ["color.css", "typography.css", "spacing.css", "shape.css", "motion.css"];
const PRIVATE = /--(?:palette|theme|chromatic|semantic)-(?:[a-z0-9-]+|\{)/g;
const COLOR_FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"]);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const entries = (path) => existsSync(path) ? readdirSync(path, { withFileTypes: true }) : [];
const files = (path) => entries(path).filter((entry) => entry.isFile()).map((entry) => entry.name);
const dirs = (path) => entries(path).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const walk = (root, accept = () => true, found = []) => {
  for (const entry of entries(root)) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, accept, found);
    else if (entry.isFile() && accept(path)) found.push(path);
  }
  return found;
};
const source = (path) => readFileSync(path, "utf8");
const css = (path) => postcss.parse(source(path), { from: path });
const posix = (path) => path.split(sep).join("/");
const lineOf = (node) => node?.source?.start?.line ?? 1;
const quotedImport = (params) => params.trim().match(/^(["'])(.*?)\1/)?.[2] ?? null;

const collector = (base) => {
  const failures = [];
  return {
    failures,
    fail(rule, path, message, line = 1) {
      failures.push({ rule, path: posix(relative(base, path) || "."), line, message });
    }
  };
};

export const cssFacts = (path) => {
  const root = css(path);
  const declarations = [];
  const imports = [];
  const variants = [];
  root.walkDecls((node) => {
    const references = [];
    valueParser(node.value).walk((part) => {
      if (part.type === "function" && part.value === "var") {
        const name = valueParser.stringify(part.nodes).split(",")[0].trim();
        if (name.startsWith("--")) references.push(name);
      }
    });
    declarations.push({ property: node.prop, value: node.value, references, line: lineOf(node), node });
  });
  root.walkAtRules("import", (node) => imports.push({ specifier: quotedImport(node.params), line: lineOf(node) }));
  root.walkAtRules("custom-variant", (node) => variants.push({ params: node.params, line: lineOf(node) }));
  return { root, declarations, imports, variants };
};

const literalColor = (value) => {
  let found = false;
  valueParser(value).walk((node) => {
    if (node.type === "word" && /^#[0-9a-f]{3,8}$/i.test(node.value)) found = true;
    if (node.type === "function" && COLOR_FUNCTIONS.has(node.value.toLowerCase())) found = true;
  });
  return found;
};

const themeFiles = (stylesRoot) => dirs(join(stylesRoot, "chromatic-themes"))
  .map((name) => join(stylesRoot, "chromatic-themes", name, `${name}.css`))
  .filter(existsSync);
const setFiles = (stylesRoot) => files(join(stylesRoot, "semantic-sets"))
  .filter((name) => name.endsWith(".css"))
  .map((name) => join(stylesRoot, "semantic-sets", name));

export const checkStyleStructure = ({ stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  if (!existsSync(stylesRoot)) {
    out.fail("STY001", stylesRoot, "missing styles root");
    return out.failures;
  }

  const allowedRootFiles = new Set(["styles.md", "app.css"]);
  for (const name of files(stylesRoot)) if (!allowedRootFiles.has(name)) {
    out.fail("STY001", join(stylesRoot, name), "unexpected root file");
  }
  for (const required of allowedRootFiles) if (!existsSync(join(stylesRoot, required))) {
    out.fail("STY001", stylesRoot, `missing '${required}'`);
  }
  for (const name of dirs(stylesRoot)) if (!STAGES.includes(name)) {
    out.fail("STY001", join(stylesRoot, name), "unexpected root directory");
  }
  for (const stage of STAGES) if (!existsSync(join(stylesRoot, stage))) {
    out.fail("STY001", stylesRoot, `missing '${stage}/'`);
  }

  const themesRoot = join(stylesRoot, "chromatic-themes");
  if (!existsSync(join(themesRoot, "chromatic-themes.md")) || !existsSync(join(themesRoot, "slots.css"))) {
    out.fail("STY002", themesRoot, "missing chromatic stage document or slots.css");
  }
  for (const name of files(themesRoot)) if (!["chromatic-themes.md", "slots.css"].includes(name)) {
    out.fail("STY001", join(themesRoot, name), "unexpected chromatic-stage file");
  }
  for (const name of dirs(themesRoot)) {
    if (!KEBAB.test(name)) out.fail("STY001", join(themesRoot, name), "theme name must be kebab-case");
    for (const required of [`${name}.css`, `${name}.md`]) if (!existsSync(join(themesRoot, name, required))) {
      out.fail("STY002", join(themesRoot, name), `missing '${required}'`);
    }
    for (const child of files(join(themesRoot, name))) if (![`${name}.css`, `${name}.md`].includes(child)) {
      out.fail("STY001", join(themesRoot, name, child), "theme directories contain only their entry CSS and document");
    }
    for (const child of dirs(join(themesRoot, name))) {
      out.fail("STY001", join(themesRoot, name, child), "theme directories cannot contain subdirectories");
    }
  }

  const setsRoot = join(stylesRoot, "semantic-sets");
  if (!existsSync(join(setsRoot, "semantic-sets.md"))) out.fail("STY002", setsRoot, "missing semantic-sets.md");
  for (const name of files(setsRoot)) if (name !== "semantic-sets.md" && (!name.endsWith(".css") || !KEBAB.test(name.slice(0, -4)))) {
    out.fail("STY001", join(setsRoot, name), "semantic sets are kebab-case CSS files");
  }
  for (const name of dirs(setsRoot)) out.fail("STY001", join(setsRoot, name), "semantic sets remain flat files");

  const tokensRoot = join(stylesRoot, "tokens");
  for (const required of ["tokens.md", ...TOKEN_FILES]) if (!existsSync(join(tokensRoot, required))) {
    out.fail("STY002", tokensRoot, `missing '${required}'`);
  }
  for (const name of files(tokensRoot)) if (!["tokens.md", ...TOKEN_FILES].includes(name)) {
    out.fail("STY001", join(tokensRoot, name), "unexpected token-domain file");
  }
  for (const name of dirs(tokensRoot)) out.fail("STY001", join(tokensRoot, name), "token domains remain flat files");

  const integrationsRoot = join(stylesRoot, "x-integrations");
  if (!existsSync(join(integrationsRoot, "x-integrations.md"))) out.fail("STY002", integrationsRoot, "missing x-integrations.md");
  for (const name of dirs(integrationsRoot)) {
    if (!KEBAB.test(name)) out.fail("STY001", join(integrationsRoot, name), "integration name must be kebab-case");
    if (!existsSync(join(integrationsRoot, name, `${name}.md`))) out.fail("STY002", join(integrationsRoot, name), `missing '${name}.md'`);
    const document = join(integrationsRoot, name, `${name}.md`);
    if (existsSync(document)) {
      const text = source(document);
      for (const child of files(join(integrationsRoot, name)).filter((file) => file !== `${name}.md`)) {
        if (!text.includes(`\`${child}\``)) out.fail("STY013", document, `integration document does not name '${child}'`);
      }
    }
  }

  const oldDocs = join(packageRoot, "docs", "style");
  if (walk(oldDocs, (path) => path.endsWith(".md")).length > 0) out.fail("STY002", oldDocs, "legacy style documentation remains");
  return out.failures;
};

const defaultBySelector = (paths, selector) => paths.filter((path) => cssFacts(path).root.nodes.some(
  (node) => node.type === "rule" && node.selector.includes(":root") && node.selector.includes(selector)
));

export const expectedManifest = (stylesRoot) => {
  const themes = themeFiles(stylesRoot);
  const defaultThemes = defaultBySelector(themes, "data-theme");
  const alternateThemes = themes.filter((path) => !defaultThemes.includes(path)).sort();
  const sets = setFiles(stylesRoot);
  const defaultSets = defaultBySelector(sets, "data-set");
  const alternateSets = sets.filter((path) => !defaultSets.includes(path)).sort();
  const paths = [
    ...defaultThemes,
    ...alternateThemes,
    join(stylesRoot, "chromatic-themes", "slots.css"),
    ...defaultSets,
    ...alternateSets,
    ...TOKEN_FILES.map((name) => join(stylesRoot, "tokens", name)),
    join(stylesRoot, "x-integrations", "tailwind", "tailwind.css"),
    join(stylesRoot, "x-integrations", "shadcn", "variants.css"),
    join(stylesRoot, "x-integrations", "shadcn", "bridge.css")
  ];
  const included = new Set(paths.map((path) => resolve(path)));
  const extras = walk(join(stylesRoot, "x-integrations"), (path) => path.endsWith(".css") && !path.endsWith("generated.css"))
    .filter((path) => !included.has(resolve(path))).sort();
  return [...paths, ...extras].filter(existsSync);
};

export const checkStyleImports = ({ stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const app = join(stylesRoot, "app.css");
  if (!existsSync(app)) return out.failures;
  const facts = cssFacts(app);
  const local = facts.imports.filter(({ specifier }) => specifier?.startsWith(".")).map(({ specifier }) => resolve(dirname(app), specifier));
  const expected = expectedManifest(stylesRoot).map((path) => resolve(path));
  if (local.length !== expected.length || local.some((path, index) => path !== expected[index])) {
    out.fail("STY005", app, "local imports do not match the complete stage order");
  }
  const counts = new Map();
  for (const path of local) counts.set(path, (counts.get(path) ?? 0) + 1);
  for (const path of expected) if (counts.get(path) !== 1) out.fail("STY004", app, `expected exactly one import of '${posix(relative(stylesRoot, path))}'`);

  for (const path of walk(stylesRoot, (candidate) => candidate.endsWith(".css") && candidate !== app)) {
    for (const item of cssFacts(path).imports) if (item.specifier?.startsWith(".")) {
      out.fail("STY004", path, "stage stylesheets cannot hide local imports", item.line);
    }
  }

  const sourceRoot = join(packageRoot, "src");
  const door = join(sourceRoot, "routes", "+layout.svelte");
  const expectedImport = 'import "$lib/styles/app.css"';
  const doorCount = existsSync(door) ? source(door).split(expectedImport).length - 1 : 0;
  if (doorCount !== 1) out.fail("STY003", door, "root layout must import the style door exactly once");
  for (const path of walk(sourceRoot, (candidate) => /\.(?:svelte|ts|js|css)$/.test(candidate))) {
    if (path === door || path.startsWith(stylesRoot + sep)) continue;
    if (/\$lib\/styles\/[^"']+\.css/.test(source(path))) out.fail("STY003", path, "application code may import only the style door");
  }

  const generated = join(stylesRoot, "x-integrations", "shadcn", "generated.css");
  const config = join(packageRoot, "components.json");
  const target = existsSync(config) ? JSON.parse(source(config)).tailwind?.css : null;
  if (resolve(packageRoot, target ?? "") !== resolve(generated)) out.fail("STY014", config, "components.json must target quarantined generated.css");
  if (local.includes(resolve(generated))) out.fail("STY014", app, "generated.css must never execute");
  if (!existsSync(generated) || !source(generated).includes("Quarantine file")) out.fail("STY014", generated, "generated.css must retain its quarantine header");
  return out.failures;
};

const customDeclarations = (path) => cssFacts(path).declarations.filter(({ property }) => property.startsWith("--"));
const selectorIncludes = (path, fragment) => {
  let found = false;
  cssFacts(path).root.walkRules((node) => { if (node.selector.includes(fragment)) found = true; });
  return found;
};
const themeName = (path) => path.split(sep).at(-2);
const setName = (path) => path.split(sep).at(-1).replace(/\.css$/, "");

export const checkStyleDeclarations = ({ stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const generated = join(stylesRoot, "x-integrations", "shadcn", "generated.css");
  const paths = walk(stylesRoot, (path) => path.endsWith(".css") && path !== generated);
  const declared = new Set();
  for (const path of paths) for (const item of customDeclarations(path)) declared.add(item.property);

  const slots = join(stylesRoot, "chromatic-themes", "slots.css");
  const setsRoot = join(stylesRoot, "semantic-sets") + sep;
  const tokensRoot = join(stylesRoot, "tokens") + sep;
  const integrationsRoot = join(stylesRoot, "x-integrations") + sep;
  for (const path of paths) {
    const isTheme = themeFiles(stylesRoot).includes(path);
    const isSlots = path === slots;
    const isSet = path.startsWith(setsRoot) && path.endsWith(".css");
    const isToken = path.startsWith(tokensRoot);
    const isIntegration = path.startsWith(integrationsRoot);
    for (const item of cssFacts(path).declarations) {
      if (item.property.startsWith("--")) {
        const validOwner = isTheme ? /^--(?:palette|theme)-/.test(item.property)
          : isSlots ? item.property.startsWith("--chromatic-")
          : isSet ? item.property.startsWith("--semantic-")
          : isToken ? item.property.startsWith("--token-")
          : isIntegration ? !/^--(?:palette|theme|chromatic|semantic|token)-/.test(item.property)
          : true;
        if (!validOwner) out.fail(isIntegration ? "STY013" : "STY006", path, `'${item.property}' is declared by the wrong stage`, item.line);
      }
      const allowedReference = (name) => isTheme ? name.startsWith("--palette-")
        : isSlots ? /^--(?:palette|theme)-/.test(name)
        : isSet ? name.startsWith("--chromatic-")
        : isToken ? /^--(?:token|theme|chromatic|semantic)-/.test(name)
        : isIntegration ? name.startsWith("--token-")
        : name.startsWith("--token-");
      for (const name of item.references) {
        if (!allowedReference(name)) out.fail(isIntegration ? "STY013" : "STY007", path, `'${name}' crosses an invalid stage boundary`, item.line);
        if (!declared.has(name)) out.fail("STY007", path, `'${name}' is not declared by the style graph`, item.line);
      }
      if (!isTheme && literalColor(item.value)) out.fail("STY008", path, "literal colors belong only to theme implementations", item.line);
    }
  }

  const themes = themeFiles(stylesRoot);
  const interfaces = themes.map((path) => new Set(customDeclarations(path).map(({ property }) => property)));
  const baseline = [...(interfaces[0] ?? [])].sort().join("\n");
  let defaultTheme = null;
  const darkThemes = [];
  for (const [index, path] of themes.entries()) {
    const name = themeName(path);
    if (!selectorIncludes(path, `[data-theme="${name}"]`)) out.fail("STY009", path, "theme selector must match its directory");
    const facts = cssFacts(path);
    const roots = facts.root.nodes.filter((node) => node.type === "rule" && node.selector.includes(":root"));
    if (roots.length > 0) defaultTheme = defaultTheme === null ? name : "__multiple__";
    const schemes = facts.declarations.filter(({ property }) => property === "color-scheme").map(({ value }) => value.trim());
    if (schemes.length !== 1 || !["light", "dark"].includes(schemes[0])) out.fail("STY009", path, "theme must declare exactly one light or dark color-scheme");
    if (schemes[0] === "dark") darkThemes.push(name);
    if ([...interfaces[index]].sort().join("\n") !== baseline) out.fail("STY009", path, "theme custom-property interface differs from the default");
  }
  if (!defaultTheme || defaultTheme === "__multiple__") out.fail("STY009", join(stylesRoot, "chromatic-themes"), "exactly one theme must bind :root");
  const appHtml = join(packageRoot, "src", "app.html");
  const htmlTheme = existsSync(appHtml) ? source(appHtml).match(/data-theme="([^"]+)"/)?.[1] : null;
  if (htmlTheme !== defaultTheme) out.fail("STY010", appHtml, "app.html theme must match the default theme");
  const tailwind = join(stylesRoot, "x-integrations", "tailwind", "tailwind.css");
  const registeredDark = existsSync(tailwind) ? [...source(tailwind).matchAll(/data-theme="([^"]+)"/g)].map((match) => match[1]) : [];
  if ([...new Set(registeredDark)].sort().join("\n") !== darkThemes.sort().join("\n")) out.fail("STY010", tailwind, "Tailwind dark variant must list exactly the dark themes");

  const sets = setFiles(stylesRoot);
  let defaultSetCount = 0;
  for (const path of sets) {
    const name = setName(path);
    if (!selectorIncludes(path, `[data-set="${name}"]`)) out.fail("STY011", path, "set selector must match its filename");
    if (selectorIncludes(path, ":root")) defaultSetCount += 1;
    const declarations = customDeclarations(path);
    if (declarations.length !== 35) out.fail("STY011", path, "semantic set must declare exactly 35 aliases");
    const anchors = new Map();
    for (const item of declarations) {
      const match = item.property.match(/^--semantic-(primary|secondary|tertiary|accent-1|accent-2)-(surface-hover|fill-hover|on-fill|surface|border|fill|text)$/);
      const value = item.value.match(/^var\(--chromatic-([a-z0-9-]+?)-(surface-hover|fill-hover|on-fill|surface|border|fill|text)\)$/);
      if (!match || !value || match[2] !== value[2]) out.fail("STY011", path, "every semantic declaration must be a direct matching chromatic alias", item.line);
      else if (match[2] === "surface") anchors.set(match[1], value[1]);
    }
    const identity = [anchors.get("primary"), anchors.get("secondary"), anchors.get("tertiary")];
    if (new Set(identity).size !== 3) out.fail("STY012", path, "primary, secondary, and tertiary hues must be distinct");
    for (const anchor of ["accent-1", "accent-2"]) if (["green", "red", "amber", "grey"].includes(anchors.get(anchor))) {
      out.fail("STY012", path, `${anchor} cannot reuse a fixed-meaning hue`);
    }
  }
  if (defaultSetCount !== 1) out.fail("STY011", join(stylesRoot, "semantic-sets"), "exactly one semantic set must bind :root");
  return out.failures;
};

export const checkStyleConsumers = ({ sourceRoot, stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const diagnostic = join(sourceRoot, "lib", "demo", "palette.svelte");
  for (const path of walk(sourceRoot, (candidate) => /\.(?:svelte|ts|js|css)$/.test(candidate))) {
    if (path.startsWith(stylesRoot + sep) || path.includes(`${sep}simple-components${sep}`)) continue;
    const text = source(path);
    const privateNames = [...text.matchAll(PRIVATE)].map((match) => match[0]);
    for (const name of privateNames) {
      if (path === diagnostic && name.startsWith("--palette-")) continue;
      out.fail("STY015", path, `authored consumer references private '${name}'`, text.slice(0, text.indexOf(name)).split("\n").length);
    }
    if (/\$lib\/styles\/(?!app\.css)[^"']+\.css/.test(text)) out.fail("STY015", path, "authored consumer imports an internal stylesheet");
    const color = text.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i);
    if (color) out.fail("STY015", path, "authored consumer contains a literal color", text.slice(0, color.index).split("\n").length);
  }
  return out.failures;
};

export const checkStyles = (scope) => [
  ...checkStyleStructure(scope),
  ...checkStyleImports(scope),
  ...checkStyleDeclarations(scope),
  ...checkStyleConsumers({ ...scope, sourceRoot: join(scope.packageRoot, "src") })
].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));
