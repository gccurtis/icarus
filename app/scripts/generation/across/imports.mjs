#!/usr/bin/env node
/**
 * Rewrites every import in `src/` to its canonical alias spelling.
 *
 *     pnpm imports
 *     pnpm imports -- --check
 *
 * The canonical spelling is the most specific alias whose target contains the
 * file: `src/lib/app-views/panels/x.svelte` is `$panels/x.svelte`, not
 * `$app-views/panels/x.svelte`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { loadTree } from "../../lint/shared/tree.mjs";
import { invocation, usage } from "../shared/cli.mjs";

/** Aliases that no longer exist, so a specifier still using one can be resolved. */
const RETIRED = {
  $components: "src/lib/components",
  "$lib/components/vendor": "src/lib/components/vendored"
};

/** Provided by SvelteKit; there is no file to resolve and no alias to rewrite to. */
const PROVIDED = /^\$(app|env|service-worker)\b/;

/** SvelteKit names these by position; neither has an alias to be spelled through. */
const framework = (specifier) =>
  /^\.{1,2}\/\$types(\.js)?$/.test(specifier) || /^\.\/\+[a-z]/.test(specifier);

const { positional, flags } = invocation();
if (positional.length > 0) usage("pnpm imports [-- --check]");

const tree = await loadTree();

const targets = Object.entries(tree.aliases)
  .map(([alias, path]) => ({ alias, root: resolve(tree.base, path) }))
  .sort((a, b) => b.root.length - a.root.length);

const trimmed = (rest) => {
  if (rest.endsWith(".svelte.ts")) return rest.slice(0, -3);
  if (rest.endsWith(".ts")) return rest.slice(0, -3);
  return rest;
};

const canonical = (file) => {
  for (const { alias, root } of targets) {
    if (!tree.within(root, file)) continue;
    const rest = relative(root, file).split(sep).join("/");
    if (!rest) return alias;
    const spelled = trimmed(rest);
    for (const index of ["/index", "/index.remote"]) {
      if (spelled.endsWith(index)) return `${alias}/${spelled.slice(0, -index.length)}`;
    }
    return `${alias}/${spelled}`;
  }
  return null;
};

const viaRetired = (specifier, from) => {
  const alias = Object.keys(RETIRED)
    .sort((a, b) => b.length - a.length)
    .find((name) => specifier === name || specifier.startsWith(`${name}/`));
  if (!alias) return null;
  const mapped = `${RETIRED[alias]}${specifier.slice(alias.length)}`;
  return tree.resolve(`$lib/${mapped.slice("src/lib/".length)}`, from);
};

const rewritten = [];
const unresolved = [];
const broken = [];

for (const path of tree.files) {
  if (!/\.(ts|js|svelte)$/.test(path) || path.endsWith(".d.ts")) continue;

  const inRoutes = tree.within(tree.routes, path);
  // The CLI writes and rewrites every specifier in its own tree.
  if (tree.within(tree.path("components", "vendored"), path)) continue;
  const changes = [];

  for (const record of tree.imports(path)) {
    const { specifier } = record;
    if (inRoutes && framework(specifier)) continue;
    if (PROVIDED.test(specifier)) continue;

    const file = tree.resolve(specifier, path) ?? viaRetired(specifier, path);
    if (!file) {
      if (specifier.startsWith(".") || specifier.startsWith("$")) {
        unresolved.push({ path, specifier });
      }
      continue;
    }

    const wanted = canonical(file);
    if (!wanted || wanted === specifier) continue;

    // The rewrite has to land on the file the old spelling did.
    if (tree.resolve(wanted, path) !== file) {
      broken.push({ path, specifier, wanted, file });
      continue;
    }
    changes.push({ specifier, wanted });
  }

  if (changes.length === 0) continue;

  let text = readFileSync(path, "utf8");
  for (const { specifier, wanted } of changes) {
    for (const quote of ['"', "'"]) {
      text = text.split(`${quote}${specifier}${quote}`).join(`${quote}${wanted}${quote}`);
    }
  }
  rewritten.push({ path, count: changes.length, text });
}

if (broken.length > 0) {
  console.error(`imports: ${broken.length} rewrite(s) would resolve somewhere else\n`);
  for (const { path, specifier, wanted } of broken) {
    console.error(`  ${tree.rel(path)}  ${specifier} → ${wanted}`);
  }
  process.exit(1);
}

const total = rewritten.reduce((sum, { count }) => sum + count, 0);

const report = () => {
  if (unresolved.length === 0) return;
  const byFile = new Map();
  for (const { path, specifier } of unresolved) {
    if (!byFile.has(path)) byFile.set(path, new Set());
    byFile.get(path).add(specifier);
  }
  console.log(`\n  ${byFile.size} file(s) hold a specifier that resolves to nothing:\n`);
  for (const [path, specifiers] of byFile) console.log(`  ${tree.rel(path)}  ${[...specifiers].join(", ")}`);
};

if (flags.has("check")) {
  if (total === 0) {
    console.log("imports: every import in src/ is spelled canonically");
    report();
    process.exit(unresolved.length > 0 ? 1 : 0);
  }
  console.error(`imports: ${total} import(s) in ${rewritten.length} file(s) are not spelled canonically\n`);
  for (const { path, count } of rewritten.slice(0, 20)) console.error(`  ${tree.rel(path)}  ${count}`);
  if (rewritten.length > 20) console.error(`  … and ${rewritten.length - 20} more`);
  console.error("\nRun 'pnpm imports' to rewrite them.");
  process.exit(1);
}

for (const { path, text } of rewritten) writeFileSync(path, text);

console.log(`imports: rewrote ${total} import(s) in ${rewritten.length} file(s)`);
report();
