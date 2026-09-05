#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadTree } from "../../app/scripts/lint/shared/tree.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, "..", "..");
const appRoot = join(repository, "app");
const wikiRoot = join(here, "..");
const source = join(wikiRoot, "src");
const data = join(source, "data");

const findings = [];
const finding = (check, path, message) => findings.push({ check, path, message });

const readJson = (name) => JSON.parse(readFileSync(join(data, name), "utf8"));
const rel = (path) => relative(repository, path).split(sep).join("/");

const walk = (directory, keep = () => true) => {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "data") continue;
      found.push(...walk(path, keep));
    } else if (keep(path)) found.push(path);
  }
  return found;
};

for (const name of ["files.json", "units.json", "vocabulary.json", "styles.json", "checks.json", "generators.json", "tests.json", "configuration.json", "meta.json"]) {
  if (!existsSync(join(data, name))) {
    console.error(`check: ${name} is missing — run node extract/extract.mjs first`);
    process.exit(2);
  }
}

const files = readJson("files.json");
const checks = readJson("checks.json");
const styles = readJson("styles.json");
const registry = JSON.parse(readFileSync(join(source, "pages", "registry.json"), "utf8"));
const browserTrees = JSON.parse(readFileSync(join(source, "browser-trees.json"), "utf8")).trees;

const fileIds = new Set(files.map((entry) => entry.id));
const symbolsByFile = new Map(files.map((entry) => [entry.id, new Set(entry.symbols.map((symbol) => symbol.name))]));
const checkNames = new Map();
for (const check of checks.checks) checkNames.set(check.name, [...(checkNames.get(check.name) ?? []), check.tree]);
const tokenNames = new Set(styles.tokens.flatMap((domain) => domain.declarations.map((declaration) => declaration.name)));
const routes = new Set(registry.map((page) => page.route));
const dynamicRoutePrefixes = ["/files/", "/checks/", "/trees/", "/browse/"];

const tree = await loadTree(appRoot);
const onDisk = new Set(tree.files.map((path) => rel(path)));

for (const id of onDisk) {
  if (!fileIds.has(id)) finding("every-file-is-extracted", id, "on disk under app/src but absent from files.json — re-run the extractor");
}
for (const id of fileIds) {
  if (!onDisk.has(id)) finding("every-file-is-extracted", id, "in files.json but no longer on disk — re-run the extractor");
}

for (const entry of files) {
  if (!browserTrees.includes(entry.tree)) finding("every-file-is-reachable", entry.id, `tree "${entry.tree}" has no browse page in browser-trees.json`);
}
for (const treeName of browserTrees) {
  if (!routes.has(`/browse/${treeName}`)) finding("every-file-is-reachable", `/browse/${treeName}`, "browser tree has no registry entry");
}

const proseFiles = walk(join(source, "prose"), (path) => path.endsWith(".md"));
const codeFiles = walk(source, (path) => /\.(tsx?|css)$/.test(path));

const MARKER = /\[\[(file|check|token|symbol|tree|page):([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const BACKTICK_PATH = /`((?:app|src|scripts|configuration|seed|wiki)\/[A-Za-z0-9_./\[\]+-]+)`/g;

const resolveNamed = (target) => {
  if (fileIds.has(target)) return true;
  if (fileIds.has(`app/${target}`)) return true;
  const absolute = join(repository, target);
  if (existsSync(absolute)) return true;
  if (existsSync(join(appRoot, target))) return true;
  return false;
};

for (const path of proseFiles) {
  const text = readFileSync(path, "utf8");
  const where = rel(path);
  for (const match of text.matchAll(MARKER)) {
    const [, kind, body] = match;
    const value = body.trim();
    switch (kind) {
      case "file":
        if (!resolveNamed(value)) finding("named-path-exists", where, `[[file:${value}]] names nothing on disk`);
        break;
      case "check": {
        const [first, second] = value.split("/");
        const name = second ?? first;
        const trees = checkNames.get(name);
        if (!trees) finding("named-check-exists", where, `[[check:${value}]] names no check`);
        else if (second && !trees.includes(first)) finding("named-check-exists", where, `[[check:${value}]] names a tree that check is not in`);
        break;
      }
      case "token":
        if (!tokenNames.has(value)) finding("named-token-exists", where, `[[token:${value}]] names no --token-*`);
        break;
      case "symbol": {
        const [name, id] = value.split("@");
        if (!fileIds.has(id)) finding("named-symbol-exists", where, `[[symbol:${value}]] names a file that does not exist`);
        else if (!symbolsByFile.get(id)?.has(name)) finding("named-symbol-exists", where, `[[symbol:${value}]] names no symbol in that file`);
        break;
      }
      case "tree":
        if (!routes.has(`/trees/${value}`)) finding("named-page-exists", where, `[[tree:${value}]] has no tree page`);
        break;
      case "page": {
        const [route] = value.split("#");
        if (!routes.has(route) && !dynamicRoutePrefixes.some((prefix) => route.startsWith(prefix))) finding("named-page-exists", where, `[[page:${value}]] has no registry entry`);
        break;
      }
    }
  }
  for (const match of text.matchAll(BACKTICK_PATH)) {
    const target = match[1].replace(/[.,;:]+$/, "");
    if (/[*<>{}]/.test(target)) continue;
    if (target.endsWith("/")) {
      const directory = target.replace(/\/$/, "");
      if (!existsSync(join(repository, directory)) && !existsSync(join(appRoot, directory))) finding("named-path-exists", where, `\`${target}\` names no directory`);
      continue;
    }
    if (!resolveNamed(target)) finding("named-path-exists", where, `\`${target}\` names nothing on disk`);
  }
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
for (const path of codeFiles) {
  const text = readFileSync(path, "utf8");
  const where = rel(path);
  if (path.endsWith("resolve.ts")) continue;
  for (const match of text.matchAll(/--token-[a-z0-9-]+/g)) {
    if (match[0].endsWith("-") || text[match.index + match[0].length] === "$") continue;
    if (!tokenNames.has(match[0])) finding("named-token-exists", where, `${match[0]} is not declared under semantic-tokens/`);
  }
  if (/var\(--palette-/.test(text) || /var\(--theme-/.test(text) || /var\(--chromatic-/.test(text)) finding("only-public-tokens", where, "references a variable behind the public boundary");
  if (path.endsWith(".css")) {
    for (const match of text.matchAll(HEX)) finding("no-literal-colour", where, `literal colour ${match[0]}`);
    if (/\b(rgb|hsl|oklch)\(/.test(text)) finding("no-literal-colour", where, "literal colour function");
  } else {
    for (const match of text.matchAll(/["'`](#[0-9a-fA-F]{3,8})["'`]/g)) finding("no-literal-colour", where, `literal colour ${match[1]}`);
  }
  if (path.endsWith(".css") && /^\s*\/\*/m.test(text)) finding("no-comments", where, "holds a comment");
  if (/\.(tsx?|mjs)$/.test(path) && /^\s*\/\/(?!\/)/m.test(text)) finding("no-comments", where, "holds a line comment");
}

for (const page of registry) {
  const pageFile = join(source, page.file);
  if (!existsSync(pageFile)) finding("registry-page-exists", page.route, `${page.file} does not exist`);
}

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const headingsOf = (text) => {
  const found = [];
  let fence = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    if (!fence && /^## /.test(line)) found.push(slug(line.slice(3).trim()));
  }
  return found;
};

const proseFor = {
  "/": "prose/overview.md",
  "/architecture": "prose/architecture.md",
  "/checks": "prose/checks.md",
  "/generators": "prose/generators.md",
  "/tests": "prose/tests.md",
  "/design-system": "prose/design/overview.md",
  "/design-system/themes": "prose/design/themes.md",
  "/design-system/slots": "prose/design/slots.md",
  "/design-system/tokens": "prose/design/tokens.md",
  "/design-system/integrations": "prose/design/integrations.md",
  "/data-model": "prose/data-model.md",
  "/views": "prose/views.md",
  "/configuration": "prose/configuration.md",
  "/algorithms/document-editor": "prose/algorithms/document-editor.md",
  "/algorithms/semantic-overlay": "prose/algorithms/semantic-overlay.md",
  "/algorithms/slide-deck": "prose/algorithms/slide-deck.md",
  "/algorithms/charts": "prose/algorithms/charts.md",
  "/algorithms/workspace": "prose/algorithms/workspace.md",
  "/algorithms/revisions": "prose/algorithms/revisions.md",
  "/traces/capability": "prose/traces/capability.md",
  "/traces/view": "prose/traces/view.md",
  "/gaps": "prose/gaps.md"
};
for (const page of registry) {
  const prose = proseFor[page.route] ?? (page.route.startsWith("/trees/") ? `prose/trees/${page.route.slice("/trees/".length)}.md` : null);
  if (!prose) continue;
  const path = join(source, prose);
  if (!existsSync(path)) {
    finding("prose-exists", page.route, `${prose} does not exist`);
    continue;
  }
  const headings = headingsOf(readFileSync(path, "utf8"));
  const registered = page.headings.map((heading) => heading.id);
  for (const id of registered) if (!headings.includes(id)) finding("registry-headings-match-prose", page.route, `registry names heading "${id}" that ${prose} does not have`);
  for (const id of headings) if (!registered.includes(id)) finding("registry-headings-match-prose", page.route, `${prose} has heading "${id}" the registry does not name`);
}

const tokensProse = readFileSync(join(source, "prose", "design", "tokens.md"), "utf8");
const tokensRegistered = registry.find((page) => page.route === "/design-system/tokens")?.headings.map((heading) => heading.id) ?? [];
for (const domain of styles.tokens) {
  if (!tokensRegistered.includes(domain.domain) && !headingsOf(tokensProse).includes(domain.domain)) finding("every-token-domain-has-a-section", "/design-system/tokens", `domain ${domain.domain} has no section`);
}

const checksProse = readFileSync(join(source, "prose", "checks.md"), "utf8");
const explained = new Map();
let currentTree = null;
for (const line of checksProse.split("\n")) {
  if (/^## /.test(line)) currentTree = slug(line.slice(3).trim());
  if (/^### /.test(line) && currentTree) explained.set(`${currentTree}/${slug(line.slice(4).trim())}`, true);
}
for (const check of checks.checks) {
  if (!explained.has(`${check.tree}/${check.name}`)) finding("every-check-is-explained", check.name, `no ### ${check.name} under ## ${check.tree} in prose/checks.md`);
}
for (const key of explained.keys()) {
  const [treeName, name] = key.split("/");
  if (!checks.checks.some((check) => check.tree === treeName && check.name === name)) finding("every-check-is-explained", key, "explained in prose/checks.md but no such check exists");
}
for (const check of checks.checks) {
  if (!checks.mutations.some((mutation) => mutation.check === check.name)) finding("every-check-has-a-mutation", check.name, "no mutation proves it fires");
}

for (const page of registry) {
  if (page.route.startsWith("/browse/")) continue;
  const routePattern = page.route.replace(/\/[^/]+$/, "/:tree");
  const appSource = readFileSync(join(source, "App.tsx"), "utf8");
  if (!appSource.includes(`path="${page.route}"`) && !appSource.includes(`path="${routePattern}"`)) finding("registry-route-is-mounted", page.route, "App.tsx mounts no such route");
}

const seen = new Set();
for (const check of findings) seen.add(check.check);
const checkList = [
  "every-file-is-extracted",
  "every-file-is-reachable",
  "named-path-exists",
  "named-check-exists",
  "named-token-exists",
  "named-symbol-exists",
  "named-page-exists",
  "only-public-tokens",
  "no-literal-colour",
  "no-comments",
  "registry-page-exists",
  "prose-exists",
  "registry-headings-match-prose",
  "every-token-domain-has-a-section",
  "every-check-is-explained",
  "every-check-has-a-mutation",
  "registry-route-is-mounted"
];

if (findings.length === 0) {
  console.log(`wiki check: ${checkList.length} checks · ${checkList.length} clean · 0 findings · ${onDisk.size} files reachable`);
  process.exit(0);
}

for (const entry of findings) console.log(`${entry.check}  ${entry.path}\n    ${entry.message}`);
console.log(`\nwiki check: ${checkList.length} checks · ${checkList.length - seen.size} clean · ${findings.length} findings`);
process.exit(1);
