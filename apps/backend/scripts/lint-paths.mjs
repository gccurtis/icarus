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
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(packageRoot, name), "utf8");

const sourceFiles = (function collect(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, found);
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return found;
})(join(packageRoot, "src"));

const failures = [];

// 1 + 2: per-file rules.
const PATHS_MODULE = join("src", "initialization", "paths.ts");
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
    });
}

// 3: the two resolution maps must agree.
const nodeAliases = Object.keys(JSON.parse(read("package.json")).imports ?? {});
const tsAliases = Object.keys(
  JSON.parse(read("tsconfig.json").replace(/^\s*\/\/.*$/gm, "")).compilerOptions?.paths ?? {}
);
const missingFromTs = nodeAliases.filter((a) => !tsAliases.includes(a));
const missingFromNode = tsAliases.filter((a) => !nodeAliases.includes(a));
for (const alias of missingFromTs) {
  failures.push(`tsconfig.json  paths is missing "${alias}", which package.json imports declares`);
}
for (const alias of missingFromNode) {
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
