import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

/**
 * Every rule this module can report, in pipeline order.
 *
 * Named rather than numbered, and each starts with the verb for what it does to
 * the thing it names, so a failure says what was violated without a lookup
 * table. Exported so the rule table in the style-system document can be checked
 * against the rules that actually exist.
 */
export const RULE_NAMES = [
  "restrict-stage-entries",
  "require-stage-document",
  "confine-style-door",
  "require-manifest-import",
  "order-stage-imports",
  "match-declaration-namespace",
  "restrict-stage-references",
  "confine-literal-colors",
  "match-theme-interface",
  "match-theme-registration",
  "require-role-slots",
  "pin-meaning-hues",
  "confine-integration-boundary",
  "quarantine-generated-css",
  "restrict-consumer-surface",
  "restrict-registry-surface"
];

const TOKEN_STAGE = "semantic-tokens";
const TOKEN_DOCUMENT = `${TOKEN_STAGE}.md`;
const STAGES = ["chromatic-themes", TOKEN_STAGE, "x-integrations"];
const TOKEN_FILES = ["color.css", "typography.css", "spacing.css", "shape.css", "motion.css"];
const PRIVATE = /--(?:palette|theme|chromatic)-(?:[a-z0-9-]+|\{)/g;

/**
 * The complete role assignment. Roles are a pure function of the palette: each
 * binds directly to one chromatic family, and this table is the only place a
 * hue is chosen. Meaning roles are fixed; identity and brand roles may share a
 * hue with one another but never with a meaning role.
 */
const MEANING_ROLES = { success: "green", danger: "red", attention: "amber", inactive: "grey" };
const IDENTITY_ROLES = { interactive: "blue", active: "cyan", intelligence: "violet" };
const BRAND_ROLES = { primary: "blue", secondary: "cyan", "accent-1": "pink", "accent-2": "teal" };
const ROLES = { ...MEANING_ROLES, ...IDENTITY_ROLES, ...BRAND_ROLES };
const SLOTS = ["surface", "surface-hover", "border", "fill", "fill-hover", "text", "on-fill"];
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

export const checkStyleStructure = ({ stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  if (!existsSync(stylesRoot)) {
    out.fail("restrict-stage-entries", stylesRoot, "missing styles root");
    return out.failures;
  }

  const requiredRootFiles = new Set(["app.css"]);
  for (const name of files(stylesRoot)) if (!requiredRootFiles.has(name)) {
    out.fail("restrict-stage-entries", join(stylesRoot, name), "unexpected root file");
  }
  for (const required of requiredRootFiles) if (!existsSync(join(stylesRoot, required))) {
    out.fail("restrict-stage-entries", stylesRoot, `missing '${required}'`);
  }
  for (const name of dirs(stylesRoot)) if (!STAGES.includes(name)) {
    out.fail("restrict-stage-entries", join(stylesRoot, name), "unexpected root directory");
  }
  for (const stage of STAGES) if (!existsSync(join(stylesRoot, stage))) {
    out.fail("restrict-stage-entries", stylesRoot, `missing '${stage}/'`);
  }

  const themesRoot = join(stylesRoot, "chromatic-themes");
  if (!existsSync(join(themesRoot, "chromatic-themes.md")) || !existsSync(join(themesRoot, "slots.css"))) {
    out.fail("require-stage-document", themesRoot, "missing chromatic stage document or slots.css");
  }
  for (const name of files(themesRoot)) if (!["chromatic-themes.md", "slots.css"].includes(name)) {
    out.fail("restrict-stage-entries", join(themesRoot, name), "unexpected chromatic-stage file");
  }
  for (const name of dirs(themesRoot)) {
    if (!KEBAB.test(name)) out.fail("restrict-stage-entries", join(themesRoot, name), "theme name must be kebab-case");
    for (const required of [`${name}.css`, `${name}.md`]) if (!existsSync(join(themesRoot, name, required))) {
      out.fail("require-stage-document", join(themesRoot, name), `missing '${required}'`);
    }
    for (const child of files(join(themesRoot, name))) if (![`${name}.css`, `${name}.md`].includes(child)) {
      out.fail("restrict-stage-entries", join(themesRoot, name, child), "theme directories contain only their entry CSS and document");
    }
    for (const child of dirs(join(themesRoot, name))) {
      out.fail("restrict-stage-entries", join(themesRoot, name, child), "theme directories cannot contain subdirectories");
    }
  }

  const tokensRoot = join(stylesRoot, TOKEN_STAGE);
  for (const required of [TOKEN_DOCUMENT, ...TOKEN_FILES]) if (!existsSync(join(tokensRoot, required))) {
    out.fail("require-stage-document", tokensRoot, `missing '${required}'`);
  }
  for (const name of files(tokensRoot)) if (![TOKEN_DOCUMENT, ...TOKEN_FILES].includes(name)) {
    out.fail("restrict-stage-entries", join(tokensRoot, name), "unexpected token-domain file");
  }
  for (const name of dirs(tokensRoot)) out.fail("restrict-stage-entries", join(tokensRoot, name), "token domains remain flat files");

  const integrationsRoot = join(stylesRoot, "x-integrations");
  if (!existsSync(join(integrationsRoot, "x-integrations.md"))) out.fail("require-stage-document", integrationsRoot, "missing x-integrations.md");
  for (const name of dirs(integrationsRoot)) {
    if (!KEBAB.test(name)) out.fail("restrict-stage-entries", join(integrationsRoot, name), "integration name must be kebab-case");
    if (!existsSync(join(integrationsRoot, name, `${name}.md`))) out.fail("require-stage-document", join(integrationsRoot, name), `missing '${name}.md'`);
    const document = join(integrationsRoot, name, `${name}.md`);
    if (existsSync(document)) {
      const text = source(document);
      for (const child of files(join(integrationsRoot, name)).filter((file) => file !== `${name}.md`)) {
        if (!text.includes(`\`${child}\``)) out.fail("confine-integration-boundary", document, `integration document does not name '${child}'`);
      }
    }
  }

  const systemDocument = join(packageRoot, "docs", "styles-directory", "styles-directory.md");
  if (!existsSync(systemDocument)) out.fail("require-stage-document", systemDocument, "missing style-system document");

  const oldDocs = join(packageRoot, "docs", "style");
  if (walk(oldDocs, (path) => path.endsWith(".md")).length > 0) out.fail("require-stage-document", oldDocs, "legacy style documentation remains");
  return out.failures;
};

const defaultBySelector = (paths, selector) => paths.filter((path) => cssFacts(path).root.nodes.some(
  (node) => node.type === "rule" && node.selector.includes(":root") && node.selector.includes(selector)
));

export const expectedManifest = (stylesRoot) => {
  const themes = themeFiles(stylesRoot);
  const defaultThemes = defaultBySelector(themes, "data-theme");
  const alternateThemes = themes.filter((path) => !defaultThemes.includes(path)).sort();
  const paths = [
    ...defaultThemes,
    ...alternateThemes,
    join(stylesRoot, "chromatic-themes", "slots.css"),
    ...TOKEN_FILES.map((name) => join(stylesRoot, TOKEN_STAGE, name)),
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
    out.fail("order-stage-imports", app, "local imports do not match the complete stage order");
  }
  const counts = new Map();
  for (const path of local) counts.set(path, (counts.get(path) ?? 0) + 1);
  for (const path of expected) if (counts.get(path) !== 1) out.fail("require-manifest-import", app, `expected exactly one import of '${posix(relative(stylesRoot, path))}'`);

  for (const path of walk(stylesRoot, (candidate) => candidate.endsWith(".css") && candidate !== app)) {
    for (const item of cssFacts(path).imports) if (item.specifier?.startsWith(".")) {
      out.fail("require-manifest-import", path, "stage stylesheets cannot hide local imports", item.line);
    }
  }

  const sourceRoot = join(packageRoot, "src");
  const door = join(sourceRoot, "routes", "+layout.svelte");
  const expectedImport = 'import "$lib/styles/app.css"';
  const doorCount = existsSync(door) ? source(door).split(expectedImport).length - 1 : 0;
  if (doorCount !== 1) out.fail("confine-style-door", door, "root layout must import the style door exactly once");
  for (const path of walk(sourceRoot, (candidate) => /\.(?:svelte|ts|js|css)$/.test(candidate))) {
    if (path === door || path.startsWith(stylesRoot + sep)) continue;
    if (/\$lib\/styles\/[^"']+\.css/.test(source(path))) out.fail("confine-style-door", path, "application code may import only the style door");
  }

  const generated = join(stylesRoot, "x-integrations", "shadcn", "generated.css");
  const config = join(packageRoot, "components.json");
  const target = existsSync(config) ? JSON.parse(source(config)).tailwind?.css : null;
  if (resolve(packageRoot, target ?? "") !== resolve(generated)) out.fail("quarantine-generated-css", config, "components.json must target quarantined generated.css");
  if (local.includes(resolve(generated))) out.fail("quarantine-generated-css", app, "generated.css must never execute");
  if (!existsSync(generated) || !source(generated).includes("Quarantine file")) out.fail("quarantine-generated-css", generated, "generated.css must retain its quarantine header");
  return out.failures;
};

const customDeclarations = (path) => cssFacts(path).declarations.filter(({ property }) => property.startsWith("--"));
const selectorIncludes = (path, fragment) => {
  let found = false;
  cssFacts(path).root.walkRules((node) => { if (node.selector.includes(fragment)) found = true; });
  return found;
};
const themeName = (path) => path.split(sep).at(-2);

export const checkStyleDeclarations = ({ stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const generated = join(stylesRoot, "x-integrations", "shadcn", "generated.css");
  const paths = walk(stylesRoot, (path) => path.endsWith(".css") && path !== generated);
  const declared = new Set();
  for (const path of paths) for (const item of customDeclarations(path)) declared.add(item.property);

  const slots = join(stylesRoot, "chromatic-themes", "slots.css");
  const tokensRoot = join(stylesRoot, TOKEN_STAGE) + sep;
  const integrationsRoot = join(stylesRoot, "x-integrations") + sep;
  for (const path of paths) {
    const isTheme = themeFiles(stylesRoot).includes(path);
    const isSlots = path === slots;
    const isToken = path.startsWith(tokensRoot);
    const isIntegration = path.startsWith(integrationsRoot);
    for (const item of cssFacts(path).declarations) {
      if (item.property.startsWith("--")) {
        const validOwner = isTheme ? /^--(?:palette|theme)-/.test(item.property)
          : isSlots ? item.property.startsWith("--chromatic-")
          : isToken ? item.property.startsWith("--token-")
          : isIntegration ? !/^--(?:palette|theme|chromatic|token)-/.test(item.property)
          : true;
        if (!validOwner) out.fail(isIntegration ? "confine-integration-boundary" : "match-declaration-namespace", path, `'${item.property}' is declared by the wrong stage`, item.line);
      }
      const allowedReference = (name) => isTheme ? name.startsWith("--palette-")
        : isSlots ? /^--(?:palette|theme)-/.test(name)
        : isToken ? /^--(?:token|theme|chromatic)-/.test(name)
        : isIntegration ? name.startsWith("--token-")
        : name.startsWith("--token-");
      for (const name of item.references) {
        if (!allowedReference(name)) out.fail(isIntegration ? "confine-integration-boundary" : "restrict-stage-references", path, `'${name}' crosses an invalid stage boundary`, item.line);
        if (!declared.has(name)) out.fail("restrict-stage-references", path, `'${name}' is not declared by the style graph`, item.line);
      }
      if (!isTheme && literalColor(item.value)) out.fail("confine-literal-colors", path, "literal colors belong only to theme implementations", item.line);
    }
  }

  const themes = themeFiles(stylesRoot);
  const interfaces = themes.map((path) => new Set(customDeclarations(path).map(({ property }) => property)));
  const baseline = [...(interfaces[0] ?? [])].sort().join("\n");
  let defaultTheme = null;
  const darkThemes = [];
  for (const [index, path] of themes.entries()) {
    const name = themeName(path);
    if (!selectorIncludes(path, `[data-theme="${name}"]`)) out.fail("match-theme-interface", path, "theme selector must match its directory");
    const facts = cssFacts(path);
    const roots = facts.root.nodes.filter((node) => node.type === "rule" && node.selector.includes(":root"));
    if (roots.length > 0) defaultTheme = defaultTheme === null ? name : "__multiple__";
    const schemes = facts.declarations.filter(({ property }) => property === "color-scheme").map(({ value }) => value.trim());
    if (schemes.length !== 1 || !["light", "dark"].includes(schemes[0])) out.fail("match-theme-interface", path, "theme must declare exactly one light or dark color-scheme");
    if (schemes[0] === "dark") darkThemes.push(name);
    if ([...interfaces[index]].sort().join("\n") !== baseline) out.fail("match-theme-interface", path, "theme custom-property interface differs from the default");
  }
  if (!defaultTheme || defaultTheme === "__multiple__") out.fail("match-theme-interface", join(stylesRoot, "chromatic-themes"), "exactly one theme must bind :root");
  const appHtml = join(packageRoot, "src", "app.html");
  const htmlTheme = existsSync(appHtml) ? source(appHtml).match(/data-theme="([^"]+)"/)?.[1] : null;
  if (htmlTheme !== defaultTheme) out.fail("match-theme-registration", appHtml, "app.html theme must match the default theme");
  const tailwind = join(stylesRoot, "x-integrations", "tailwind", "tailwind.css");
  const registeredDark = existsSync(tailwind) ? [...source(tailwind).matchAll(/data-theme="([^"]+)"/g)].map((match) => match[1]) : [];
  if ([...new Set(registeredDark)].sort().join("\n") !== darkThemes.sort().join("\n")) out.fail("match-theme-registration", tailwind, "Tailwind dark variant must list exactly the dark themes");

  const color = join(stylesRoot, TOKEN_STAGE, "color.css");
  if (existsSync(color)) {
    const bound = new Map();
    for (const item of customDeclarations(color)) {
      if (!item.property.startsWith("--token-color-")) continue;
      const role = Object.keys(ROLES).find((name) => item.property.startsWith(`--token-color-${name}-`));
      const slot = role ? item.property.slice(`--token-color-${role}-`.length) : null;
      if (!role || !SLOTS.includes(slot)) {
        out.fail("require-role-slots", color, `'${item.property}' is not a declared role and slot`, item.line);
        continue;
      }
      const alias = item.value.match(/^var\(--chromatic-([a-z]+)-(.+)\)$/);
      if (!alias || alias[2] !== slot) {
        out.fail("require-role-slots", color, `'${item.property}' must alias --chromatic-<hue>-${slot} directly`, item.line);
        continue;
      }
      bound.set(`${role}/${slot}`, alias[1]);
    }
    for (const role of Object.keys(ROLES)) for (const slot of SLOTS) {
      if (!bound.has(`${role}/${slot}`)) out.fail("require-role-slots", color, `role '${role}' is missing the '${slot}' slot`);
    }

    const meaningHues = new Set(Object.values(MEANING_ROLES));
    for (const [role, hue] of Object.entries(ROLES)) {
      const actual = bound.get(`${role}/surface`);
      if (!actual) continue;
      if (role in MEANING_ROLES && actual !== hue) {
        out.fail("pin-meaning-hues", color, `meaning role '${role}' is fixed to ${hue}, not ${actual}`);
      }
      if (!(role in MEANING_ROLES) && meaningHues.has(actual)) {
        out.fail("pin-meaning-hues", color, `role '${role}' cannot reuse the fixed-meaning hue ${actual}`);
      }
      const inconsistent = SLOTS.filter((slot) => bound.get(`${role}/${slot}`) !== actual);
      if (inconsistent.length > 0) {
        out.fail("pin-meaning-hues", color, `role '${role}' spans more than one hue (${inconsistent.join(", ")})`);
      }
    }
  }
  return out.failures;
};

export const checkStyleConsumers = ({ sourceRoot, stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const diagnostic = join(
    sourceRoot, "lib", "views", "development", "demo", "components", "palette.svelte"
  );
  for (const path of walk(sourceRoot, (candidate) => /\.(?:svelte|ts|js|css)$/.test(candidate))) {
    if (
      path.startsWith(stylesRoot + sep) ||
      path.includes(`${sep}components${sep}vendor${sep}`)
    ) {
      continue;
    }
    const text = source(path);
    const privateNames = [...text.matchAll(PRIVATE)].map((match) => match[0]);
    for (const name of privateNames) {
      if (path === diagnostic && name.startsWith("--palette-")) continue;
      out.fail("restrict-consumer-surface", path, `authored consumer references private '${name}'`, text.slice(0, text.indexOf(name)).split("\n").length);
    }
    if (/\$lib\/styles\/(?!app\.css)[^"']+\.css/.test(text)) out.fail("restrict-consumer-surface", path, "authored consumer imports an internal stylesheet");
    const color = text.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i);
    if (color) out.fail("restrict-consumer-surface", path, "authored consumer contains a literal color", text.slice(0, color.index).split("\n").length);
  }
  return out.failures;
};

/**
 * Registry components speak shadcn's vocabulary only.
 *
 * A registry component that looks wrong is a bridge bug, so its color must be
 * decidable in exactly one place: `x-integrations/shadcn/bridge.css`. Reaching
 * past the bridge for a first-party utility puts a second place in play.
 *
 * The forbidden roots are read off the Tailwind adapter rather than listed
 * here, so the rule cannot drift when a role is added or renamed. Exact-root
 * matching is what keeps bridge names legal: `text-primary-foreground` and
 * `bg-secondary-hover` come from the bridge and match no first-party root,
 * while `bg-primary-fill` and `text-ink-muted` do.
 */
export const checkRegistrySurface = ({ sourceRoot, stylesRoot, packageRoot }) => {
  const out = collector(packageRoot);
  const registryRoot = join(sourceRoot, "lib", "components", "vendor");
  const tailwind = join(stylesRoot, "x-integrations", "tailwind", "tailwind.css");
  if (!existsSync(registryRoot) || !existsSync(tailwind)) return out.failures;

  // Longest first, so `bg-active-surface-hover` matches the hover root rather
  // than stopping at `active-surface`.
  const roots = customDeclarations(tailwind)
    .map(({ property }) => property.match(/^--color-(.+)$/)?.[1])
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (roots.length === 0) return out.failures;
  const pattern = new RegExp(`(?<![\\w-])[a-z-]+-(${roots.map((root) => root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "g");

  for (const path of walk(registryRoot, (candidate) => /\.(?:svelte|ts|js)$/.test(candidate))) {
    const text = source(path);
    for (const match of text.matchAll(pattern)) {
      out.fail("restrict-registry-surface", path, `registry component uses first-party '${match[0]}'; change bridge.css instead`, text.slice(0, match.index).split("\n").length);
    }
  }
  return out.failures;
};

export const checkStyles = (scope) => {
  const sourceRoot = join(scope.packageRoot, "src");
  return [
    ...checkStyleStructure(scope),
    ...checkStyleImports(scope),
    ...checkStyleDeclarations(scope),
    ...checkStyleConsumers({ ...scope, sourceRoot }),
    ...checkRegistrySurface({ ...scope, sourceRoot })
  ].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));
};
