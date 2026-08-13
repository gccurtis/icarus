#!/usr/bin/env node
/**
 * Enforces the path rules in README.md. No dependencies — just Node.
 *
 * 1. No relative imports. They encode where the importing file sits, so moving it
 *    changes what they mean.
 * 2. No `import.meta.url` outside paths.ts. Deriving a filesystem path from a
 *    module's own location is the bug that broke startup twice; `tsc` cannot see
 *    it, because a path is a string and a string is valid wherever it points.
 * 3. `package.json` imports and `tsconfig.json` paths must declare the same
 *    aliases. Node resolves one and TypeScript the other, so a mismatch compiles
 *    cleanly and fails at runtime.
 * 4. Every alias import must resolve to a file that exists. Renaming a directory
 *    without rewriting its importers left 72 dead specifiers behind while this
 *    script still reported "39 files clean" — the alias was declared, so rule 3
 *    was satisfied, and nothing checked where it pointed. `tsc` did catch it, as
 *    97 TS7016 errors naming `dist/` paths that explain nothing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(packageRoot, name), "utf8");

// Both trees are linted. `test/` was excluded before, which is how relative
// imports survived there — the rule existed but nothing applied it.
const collect = (dir, found = []) => {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, found);
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return found;
};

const sourceFiles = [
  ...collect(join(packageRoot, "src")),
  ...collect(join(packageRoot, "test"))
];

const failures = [];

const packageJson = JSON.parse(read("package.json"));
const importsMap = packageJson.imports ?? {};

/**
 * The source-tree target of an alias. Conditional entries list `development`
 * and `types` pointing into `src/`, and `default` pointing into `dist/`; only
 * the source side can be checked, because `dist/` is a build artifact that is
 * legitimately absent.
 */
const sourceTarget = (value) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value.development ?? value.types ?? value.default ?? null;
  }
  return null;
};

const resolveAlias = (specifier) => {
  if (Object.hasOwn(importsMap, specifier)) {
    return { declared: true, target: sourceTarget(importsMap[specifier]) };
  }
  for (const [key, value] of Object.entries(importsMap)) {
    if (!key.endsWith("/*")) continue;
    const prefix = key.slice(0, -1);
    if (!specifier.startsWith(prefix)) continue;
    const target = sourceTarget(value);
    if (target === null) return { declared: true, target: null };
    return { declared: true, target: target.replace(/\*$/, specifier.slice(prefix.length)) };
  }
  return { declared: false, target: null };
};

/**
 * The alias a `#capabilities/...` specifier should have used. Resolved through
 * the map rather than guessed from the path, so the message is the exact text to
 * paste — `#rich-content/errors.js`, not a shape to work out.
 */
const directAlias = (specifier) => {
  const { target } = resolveAlias(specifier);
  if (target === null) return "the capability's own alias";
  for (const [key, value] of Object.entries(importsMap)) {
    if (!key.endsWith("/*") || key === "#capabilities/*") continue;
    const prefix = sourceTarget(value)?.replace(/\*$/, "");
    if (!prefix || !target.startsWith(prefix)) continue;
    const rest = target.slice(prefix.length);
    // The index is reached by the bare alias; anything else keeps its subpath.
    return rest === "index.js" || rest === "index.ts"
      ? key.slice(0, -2)
      : `${key.slice(0, -1)}${rest}`;
  }
  return "the capability's own alias";
};

// An import writes `.js` because that is what Node resolves at runtime; the file
// on disk is the `.ts` it is compiled from.
const resolvesOnDisk = (target) => {
  const candidates = [target];
  if (target.endsWith(".js")) candidates.push(`${target.slice(0, -3)}.ts`);
  return candidates.some((candidate) => existsSync(join(packageRoot, candidate)));
};

// 1, 2, and 4: per-file rules.
const PATHS_MODULE = join("src", "initialization", "paths.ts");
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)"(#[^"]+)"/g;

for (const file of sourceFiles) {
  const shown = relative(packageRoot, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const at = `${shown}:${index + 1}`;
      if (/\bfrom\s+"\.{1,2}\//.test(line)) {
        failures.push(`${at}  relative import — use an alias from package.json imports`);
      }
      if (line.includes("import.meta.url") && shown !== PATHS_MODULE) {
        failures.push(`${at}  import.meta.url — take the path from #initialization/paths.js`);
      }
      for (const [, specifier] of line.matchAll(SPECIFIER)) {
        // Every capability owns a direct alias: `#web-server` is its index, and
        // `#web-server/...` reaches inside it. Going through `#capabilities/`
        // spells out the grouping directory, so regrouping a capability would
        // rewrite every import that mentions it — the exact breakage this
        // migration started by repairing.
        if (specifier.startsWith("#capabilities/")) {
          failures.push(`${at}  "${specifier}" — use ${directAlias(specifier)} instead`);
          continue;
        }
        const { declared, target } = resolveAlias(specifier);
        if (!declared) {
          failures.push(`${at}  "${specifier}" matches no alias in package.json imports`);
        } else if (target === null) {
          failures.push(`${at}  "${specifier}" resolves to no source target`);
        } else if (!resolvesOnDisk(target)) {
          failures.push(`${at}  "${specifier}" resolves to ${target} — no such file`);
        }
      }
    });
}

// 3: the two resolution maps must agree.
const nodeAliases = Object.keys(importsMap);
const tsAliases = Object.keys(
  JSON.parse(read("tsconfig.json").replace(/^\s*\/\/.*$/gm, "")).compilerOptions?.paths ?? {}
);
for (const alias of nodeAliases.filter((a) => !tsAliases.includes(a))) {
  failures.push(`tsconfig.json  paths is missing "${alias}", which package.json imports declares`);
}
for (const alias of tsAliases.filter((a) => !nodeAliases.includes(a))) {
  failures.push(`package.json  imports is missing "${alias}", which tsconfig.json paths declares`);
}

if (failures.length > 0) {
  console.error(`lint-paths: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nSee apps/backend/README.md — Never use a relative path.");
  process.exit(1);
}

console.log(
  `lint-paths: ${sourceFiles.length} files clean; ${nodeAliases.length} aliases agree across both maps`
);
